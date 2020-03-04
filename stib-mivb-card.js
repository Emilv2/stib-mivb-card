class STIBMIVBCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get SP() {
    return "&nbsp;";  // HTML non-braking space
  }

  static get MIN() {
    return "&#8217;";  // HTML single right quote to indicate minutes
  }

  NoMessageException() {
    this.name = 'NoMessageException';
  }

  filterMessages(next_passages) {
    var messages = {};
    var message_list = [];
    for (const passage of next_passages) {
        for (const message of passage['messages']) {
	   messages[passage['line_number']] = [message, passage['line_color'], passage['line_text_color']];
	}
    }
    for (const [ key, value ] of Object.entries(messages)) {
       message_list.push({'line_number': key, 'message': value[0], 'line_color': value[1], 'line_text_color': value[2]});
    }
    return message_list;
  }


  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }

    const root = this.shadowRoot;
    if (root.lastChild)
      root.removeChild(root.lastChild);

    const cardConfig = Object.assign({}, config);
    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        /* sample css */
      }
      table {
        width: 100%;
        padding: 0 32px 0 32px;
        text-align: left;
      }
      thead th {
        text-align: left;
      }
      tbody tr {
        background-color: var(--paper-card-background-color);
      }
      td a {
        color: var(--primary-text-color);
        text-decoration-line: none;
        font-weight: normal;
      }
      .line-number{
        display:block;
        float:left;
        min-width:2.75em;
        text-align:center;
        font-weight:bold;
        color:#fff;
        border-radius:4px;
        border:3px solid #000;
        margin-left:0px;
        margin-right:12px;
        margin-left:0rem;
        margin-right:0.75rem;
        font-size:12px;
        font-size:0.75rem;
        line-height:1.6em
      }
    `;

    content.id = "container";
    cardConfig.title ? card.header = cardConfig.title : null;
    card.appendChild(content);
    card.appendChild(style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    const config = this._config;
    const root = this.shadowRoot;
    const card = root.lastChild;
    this.style.display = 'block';

    const entityState = hass.states[config.entity];
    const config_type = config.config_type;
    // set of default columns

  var columns = [{'field': 'line_number', 'title': 'Line'},
             {'field': 'line_type', 'title': 'Type'},
             {'field': 'next_passing_destination', 'title': 'Towards'},
             {'field': 'waiting_time', 'title': 'Due in (min)'}];

  var message_columns = [{'field': 'line_number', 'title': 'Line'},
             {'field': 'message', 'title': 'Message'}];

    if (config_type == "columns") {
      columns = config.columns;
    }
    else if (config_type == "raw") {
      try {
        const firstEntry = entityState.attributes.next_passages[0];
        columns = this.getRawColumns(firstEntry);
      }
      catch (warning) {
        columns = [{'field': 'no_columns', 'title': 'No Columns'}];
        console.warn('No columns: ' + warning);
      }
    }

    const tableHeader = this.createTableHeader(columns);
    let tableBody = `<tr><td colspan="${columns.length}"><i>No passages</i></td></tr>`;

    try {
      tableBody = this.createTableBody(entityState.attributes.next_passages, columns);
    }
    catch(warning) {
      console.warn('No passages: ' + warning);
    }
    const messageTableHeader = this.createTableHeader(message_columns);
    let card_content = "<table>" + tableHeader + tableBody + "</table>";

    let messages = this.filterMessages(entityState.attributes.next_passages);
    if (messages.length != 0) {
      let messageTableBody = this.createTableBody(messages, message_columns);
      card_content += "<table>" + messageTableHeader + messageTableBody + "</table>";
    }

    root.lastChild.hass = hass;

    root.getElementById('container').innerHTML = card_content;
  }

  getCardSize() {
    return 1;
  }

  createTableHeader(columns) {
    const headerPrefix = '<thread><tr>';
    const headerSuffix = '</tr></thead>';
    return columns.reduce(function (html, column) {
      return html + `<th>${column.title}</th>`;
    }, headerPrefix) + headerSuffix;
  }

  getRawColumns(passageEntry) {
    return Object.keys(passageEntry).map(function(key){
      return {'field': key, 'title': key.split('_').map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ')};
    });
  }

  formatMessageCell(field, passage) {
    let cell = "";
  }

  formatCell(field, passage) {
    let cell = "";
    // show proper line number format of STIB for the line_number_public
    if (field == 'line_number') {
      //const bordercol = passage.line_color;
      const backcol   = `#${passage.line_color}`;
      const bordercol   = `#${passage.line_color}`;
      const color     = `#${passage.line_text_color}`;
      cell = `<td class="line-number" style="border-color: ${bordercol}; background-color: ${backcol}; color: ${color};">${passage[field]}</td>`;
    }
    else if (field == 'line_type') {
      // show icons for the different types
      cell = `<td class="${field}"><ha-icon icon="mdi:${passage[field]}"></ha-icon></td>`;
    }
    else if (field == 'waiting_time') {
      if (passage[field]) {
        cell = `<td class="${field}">${passage[field]}${STIBMIVBCard.SP}${STIBMIVBCard.MIN}</td>`;
      }
      else if (passage['next_passing_message']) {
        cell = `<td class="${field}">${passage['next_passing_message']}</td>`;
      }
    }
    else if (field == 'next_passing_destination') {
      if (passage[field]) {
        cell = `<td class="${field}">${passage[field]}</td>`;
      }
      else {
        cell = `<td class="${field}">${passage['line_name']}</td>`;
      }
    }
    else {
      cell = `<td class="${field}">${passage[field]}</td>`;
   }
    return cell;
  }

  createTableBody(passages, columns) {
    const tableBodyPrefix = '<tbody>';
    const tableBodySuffix = '</tbody>';
    return passages.reduce(function (htmlTableRows, passage) {
      const rowPrefix = '<tr>';
      const rowSuffix = '</tr>';
      return htmlTableRows + columns.reduce(function (htmlTableCells, column) {
        return htmlTableCells + this.formatCell(column.field, passage);
      }.bind(this), rowPrefix) + rowSuffix;
    }.bind(this), tableBodyPrefix) + tableBodySuffix;
  }

  createMessageTableBody(passages, columns) {
    const tableBodyPrefix = '<tbody>';
    const tableBodySuffix = '</tbody>';
    return passages.reduce(function (htmlTableRows, passage) {
      const rowPrefix = '<tr>';
      const rowSuffix = '</tr>';
      return htmlTableRows + columns.reduce(function (htmlTableCells, column) {
        return htmlTableCells + this.formatMessageCell(column.field, passage);
      }.bind(this), rowPrefix) + rowSuffix;
    }.bind(this), tableBodyPrefix) + tableBodySuffix;
  }

}


customElements.define('stib-mivb-card', STIBMIVBCard)
