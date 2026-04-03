/**
 * AccordionPanel component
 * Reusable expandable panel with icon, title, subtitle, lazy-loaded body,
 * and an optional educational help button.
 */

import { createHelpBtn } from './HelpSystem.js';

export class AccordionPanel {
  /**
   * @param {HTMLElement} container
   * @param {Object} opts
   * @param {string}  opts.id
   * @param {string}  opts.title
   * @param {string}  opts.subtitle
   * @param {string}  opts.iconHtml
   * @param {string}  opts.iconColorClass  blue|green|amber|red|purple
   * @param {number}  [opts.index]
   * @param {boolean} [opts.openByDefault]
   * @param {Object}  [opts.helpContent]   Entry from HelpSystem.HELP — adds a ? button
   */
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.panelEl = null;
    this.bodyEl  = null;
    this._render();
  }

  _render() {
    const { id, title, subtitle, iconHtml, iconColorClass,
            index = 0, openByDefault = false, helpContent } = this.opts;

    const panel = document.createElement('div');
    panel.className = `accordion-panel${openByDefault ? ' open' : ''}`;
    panel.style.animationDelay = `${index * 0.07}s`;
    panel.setAttribute('id', `panel-${id}`);

    panel.innerHTML = `
      <div class="accordion-header-row">
        <button
          class="accordion-header"
          aria-controls="body-${id}"
          aria-expanded="${openByDefault}"
          id="header-${id}"
        >
          <div class="accordion-panel-icon ${iconColorClass}" aria-hidden="true">
            ${iconHtml}
          </div>
          <div class="accordion-title-group">
            <div class="accordion-title">${title}</div>
            ${subtitle ? `<div class="accordion-subtitle">${subtitle}</div>` : ''}
          </div>
          <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        ${helpContent ? '<span class="accordion-help-slot"></span>' : ''}
      </div>
      <div class="accordion-body" id="body-${id}" role="region" aria-labelledby="header-${id}">
        ${this._skeletonHtml()}
      </div>
    `;

    this.container.appendChild(panel);
    this.panelEl = panel;
    this.bodyEl  = panel.querySelector(`#body-${id}`);

    panel.querySelector('.accordion-header').addEventListener('click', () => this.toggle());

    // Inject help button if provided
    if (helpContent) {
      const slot = panel.querySelector('.accordion-help-slot');
      slot.appendChild(createHelpBtn(helpContent));
    }
  }

  toggle() {
    const isOpen = this.panelEl.classList.contains('open');
    this.panelEl.classList.toggle('open', !isOpen);
    this.panelEl.querySelector('.accordion-header').setAttribute('aria-expanded', String(!isOpen));
  }

  open() {
    this.panelEl.classList.add('open');
    this.panelEl.querySelector('.accordion-header').setAttribute('aria-expanded', 'true');
  }

  setContent(html) { this.bodyEl.innerHTML = html; }

  setError(message) {
    this.bodyEl.innerHTML = `
      <div class="panel-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>
      </div>`;
  }

  setUnavailable(msg = 'Data unavailable for this query.') {
    this.bodyEl.innerHTML = `<div class="panel-unavailable">${msg}</div>`;
  }

  _skeletonHtml() {
    return `
      <div class="panel-loading" aria-label="Loading…">
        <div class="skeleton skeleton-line w-full"></div>
        <div class="skeleton skeleton-line w-3-4"></div>
        <div class="skeleton skeleton-line w-full"></div>
        <div class="skeleton skeleton-line w-1-2"></div>
      </div>`;
  }
}
