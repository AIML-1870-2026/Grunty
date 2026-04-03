/**
 * ResultsHeader component
 * Severity banner + drug name display + action guidance card
 */

import { getSeverityMeta } from '../utils/severity.js';
import { ACTION_GUIDANCE } from './HelpSystem.js';

export class ResultsHeader {
  constructor(container, onBack) {
    this.container = container;
    this.onBack = onBack;
  }

  render(drugA, drugB, severity = 'unknown', description = '') {
    const meta = getSeverityMeta(severity);
    const desc = description || meta.description;

    this.container.innerHTML = `
      <div class="results-nav fade-in">
        <button class="back-btn" id="back-btn" aria-label="Start a new search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" aria-hidden="true">
            <path d="M19 12H5m7-7-7 7 7 7"/>
          </svg>
          New Search
        </button>
        <div class="results-drug-labels" aria-label="Checking interaction between ${drugA} and ${drugB}">
          <span class="results-drug-name">${this._esc(drugA)}</span>
          <span class="drug-divider" aria-hidden="true">⇄</span>
          <span class="results-drug-name">${this._esc(drugB)}</span>
        </div>
      </div>

      <div class="severity-banner ${meta.cssClass} fade-in" role="status" aria-live="polite">
        <div class="severity-icon-wrap" aria-hidden="true">${meta.icon}</div>
        <div class="severity-text">
          <div class="severity-level">${meta.label}</div>
          <div class="severity-desc">${this._esc(desc)}</div>
          <div class="severity-badge-pill" aria-label="Severity: ${meta.label}">
            <span>${meta.label.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div id="action-guidance-container"></div>
    `;

    this.container.querySelector('#back-btn').addEventListener('click', () => this.onBack());
    this._renderActionCard(severity);
  }

  updateSeverity(severity, description) {
    const banner = this.container.querySelector('.severity-banner');
    if (!banner) return;
    const meta = getSeverityMeta(severity);
    const desc = description || meta.description;

    banner.className = `severity-banner ${meta.cssClass} fade-in`;
    banner.querySelector('.severity-icon-wrap').innerHTML = meta.icon;
    banner.querySelector('.severity-level').textContent  = meta.label;
    banner.querySelector('.severity-desc').textContent   = desc;
    banner.querySelector('.severity-badge-pill').innerHTML = `<span>${meta.label.toUpperCase()}</span>`;

    this._renderActionCard(severity);
  }

  _renderActionCard(severity) {
    const container = this.container.querySelector('#action-guidance-container');
    if (!container) return;

    const guidance = ACTION_GUIDANCE[severity];
    if (!guidance) { container.innerHTML = ''; return; }

    const steps = guidance.steps.map(s => `
      <div class="action-step">
        <span class="action-step-icon" aria-hidden="true">${s.icon}</span>
        <span class="action-step-text">${s.text}</span>
      </div>
    `).join('');

    // Poison control callout only for major
    const emergency = severity === 'major' ? `
      <div class="action-emergency">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <div>
          <strong>Poison Control (US):</strong> 1-800-222-1222 &nbsp;·&nbsp; <strong>Emergency:</strong> 911
        </div>
      </div>` : '';

    container.innerHTML = `
      <div class="action-card ${guidance.cssClass} fade-in" role="complementary" aria-label="${guidance.heading}">
        <div class="action-card-header">
          ${guidance.icon}
          <h3 class="action-card-title">${guidance.heading}</h3>
        </div>
        <div class="action-steps">${steps}</div>
        ${emergency}
        <p class="action-disclaimer">This is general guidance only. Your pharmacist or doctor has your full health picture — always consult them before making medication decisions.</p>
      </div>
    `;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
