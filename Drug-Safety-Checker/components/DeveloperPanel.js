/**
 * DeveloperPanel component
 * Collapsible panel showing raw API request/response data.
 * Hidden on mobile.
 */

export class DeveloperPanel {
  constructor(container) {
    this.container = container;
    this.requests = [];
    this._panelEl = null;
    this._bodyEl = null;
    this._render();
  }

  _render() {
    const panel = document.createElement('div');
    panel.className = 'dev-panel';
    panel.innerHTML = `
      <button class="dev-panel-toggle" aria-expanded="false" aria-controls="dev-panel-body" id="dev-panel-toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        &lt;/&gt; Developer Panel — ${this.requests.length} API calls
      </button>
      <div class="dev-panel-body" id="dev-panel-body"></div>
    `;
    this.container.appendChild(panel);
    this._panelEl = panel;
    this._bodyEl = panel.querySelector('#dev-panel-body');

    panel.querySelector('#dev-panel-toggle').addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      panel.querySelector('#dev-panel-toggle').setAttribute('aria-expanded', String(isOpen));
    });
  }

  /**
   * Add a logged API request.
   * @param {Object} req
   * @param {string} req.label  - Human-readable label
   * @param {string} req.method - HTTP method
   * @param {string} req.url    - Request URL
   * @param {number|null} req.status - HTTP status or null
   * @param {*} req.response    - Parsed response data or error string
   */
  addRequest(req) {
    this.requests.push(req);
    this._appendEntry(req);
    this._updateToggleLabel();
  }

  _appendEntry(req) {
    const el = document.createElement('div');
    el.className = 'dev-request';

    const isOk = req.status >= 200 && req.status < 300;
    const statusText = req.status ? String(req.status) : 'ERR';
    const preview = typeof req.response === 'object'
      ? JSON.stringify(req.response, null, 2).slice(0, 2000)
      : String(req.response).slice(0, 2000);

    el.innerHTML = `
      <div class="dev-request-header">
        <span class="dev-method">${req.method || 'GET'}</span>
        <span class="dev-url" title="${this._esc(req.url)}">${this._esc(req.url)}</span>
        <span class="dev-status ${isOk ? 'ok' : 'err'}">${statusText}</span>
      </div>
      <div class="dev-response">${this._esc(preview)}</div>
    `;
    this._bodyEl.appendChild(el);
  }

  _updateToggleLabel() {
    const toggle = this._panelEl.querySelector('#dev-panel-toggle');
    if (toggle) {
      toggle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        &lt;/&gt; Developer Panel — ${this.requests.length} API call${this.requests.length !== 1 ? 's' : ''}
      `;
    }
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
