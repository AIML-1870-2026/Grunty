/**
 * SearchForm component
 * Drug input fields with RxNorm-backed autocomplete
 */

import { getDrugSuggestions, getSpellingSuggestions } from '../api/rxnorm.js';

const DEBOUNCE_MS = 320;

export class SearchForm {
  constructor(container, onSubmit) {
    this.container = container;
    this.onSubmit = onSubmit;
    this.drugA = { name: '', rxcui: null };
    this.drugB = { name: '', rxcui: null };
    this._debounceTimers = {};
    this._activeDropdown = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <form class="search-form" id="drug-search-form" novalidate>
        <div class="drug-inputs-row">
          <div class="drug-input-wrap" id="wrap-a">
            <label class="drug-input-label" for="drug-a-input">First Drug</label>
            <svg class="drug-input-icon has-label" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
              <circle cx="18" cy="18" r="3"/><path d="m22 22-1.5-1.5"/>
            </svg>
            <input
              type="text"
              id="drug-a-input"
              class="drug-input"
              placeholder="e.g. Warfarin, Metformin…"
              autocomplete="off"
              spellcheck="false"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="dropdown-a"
              role="combobox"
            >
            <div id="dropdown-a" class="autocomplete-dropdown" role="listbox" aria-label="Drug A suggestions" style="display:none"></div>
            <div class="input-error" id="error-a"></div>
          </div>

          <button type="button" class="swap-btn" id="swap-btn" aria-label="Swap drugs" title="Swap drugs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
              <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
            </svg>
          </button>

          <div class="drug-input-wrap" id="wrap-b">
            <label class="drug-input-label" for="drug-b-input">Second Drug</label>
            <svg class="drug-input-icon has-label" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
              <circle cx="18" cy="18" r="3"/><path d="m22 22-1.5-1.5"/>
            </svg>
            <input
              type="text"
              id="drug-b-input"
              class="drug-input"
              placeholder="e.g. Aspirin, Ibuprofen…"
              autocomplete="off"
              spellcheck="false"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="dropdown-b"
              role="combobox"
            >
            <div id="dropdown-b" class="autocomplete-dropdown" role="listbox" aria-label="Drug B suggestions" style="display:none"></div>
            <div class="input-error" id="error-b"></div>
          </div>
        </div>

        <div class="search-form-actions">
          <button type="submit" class="btn-primary" id="check-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Check Interaction
          </button>
        </div>
      </form>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const form    = this.container.querySelector('#drug-search-form');
    const inputA  = this.container.querySelector('#drug-a-input');
    const inputB  = this.container.querySelector('#drug-b-input');
    const swapBtn = this.container.querySelector('#swap-btn');

    inputA.addEventListener('input', () => this._onInput('a', inputA));
    inputB.addEventListener('input', () => this._onInput('b', inputB));

    inputA.addEventListener('keydown', e => this._onKeyDown(e, 'a'));
    inputB.addEventListener('keydown', e => this._onKeyDown(e, 'b'));

    inputA.addEventListener('blur', () => setTimeout(() => this._closeDropdown('a'), 200));
    inputB.addEventListener('blur', () => setTimeout(() => this._closeDropdown('b'), 200));

    swapBtn.addEventListener('click', () => this._swap());

    form.addEventListener('submit', e => {
      e.preventDefault();
      this._submit();
    });
  }

  _onInput(which, input) {
    const val = input.value.trim();
    this[`drug${which.toUpperCase()}`] = { name: val, rxcui: null };
    input.classList.toggle('has-value', val.length > 0);
    this._hideError(which);

    clearTimeout(this._debounceTimers[which]);
    if (val.length < 2) { this._closeDropdown(which); return; }

    this._debounceTimers[which] = setTimeout(async () => {
      this._showDropdownLoading(which);
      const suggestions = await getDrugSuggestions(val);
      if (input.value.trim() !== val) return; // stale
      this._showDropdownItems(which, suggestions, input);
    }, DEBOUNCE_MS);
  }

  _onKeyDown(e, which) {
    const dropdown = this.container.querySelector(`#dropdown-${which}`);
    if (dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.autocomplete-item');
    const current = dropdown.querySelector('[aria-selected="true"]');
    let idx = [...items].indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = (idx + 1) % items.length;
      this._setSelected(items, idx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
      this._setSelected(items, idx);
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      current.click();
    } else if (e.key === 'Escape') {
      this._closeDropdown(which);
    }
  }

  _setSelected(items, idx) {
    items.forEach((item, i) => item.setAttribute('aria-selected', i === idx ? 'true' : 'false'));
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  _showDropdownLoading(which) {
    const dropdown = this.container.querySelector(`#dropdown-${which}`);
    dropdown.innerHTML = `
      <div class="autocomplete-loading">
        <div class="skeleton skeleton-line w-full" style="height:10px"></div>
      </div>`;
    dropdown.style.display = 'block';
    this.container.querySelector(`#drug-${which}-input`).setAttribute('aria-expanded', 'true');
  }

  _showDropdownItems(which, items, input) {
    const dropdown = this.container.querySelector(`#dropdown-${which}`);
    if (!items.length) {
      dropdown.innerHTML = `<div class="autocomplete-empty">No matches found. Try a different spelling.</div>`;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = items.map((item, i) => `
      <div
        class="autocomplete-item"
        role="option"
        aria-selected="false"
        data-name="${this._esc(item.name)}"
        data-rxcui="${this._esc(item.rxcui)}"
        tabindex="-1"
      >
        <span class="autocomplete-name">${this._highlight(item.name, input.value)}</span>
        <span class="autocomplete-rxcui">RxCUI: ${item.rxcui}${item.tty ? ' · ' + item.tty : ''}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');

    dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
      el.addEventListener('click', () => {
        this._selectItem(which, el.dataset.name, el.dataset.rxcui, input);
      });
    });
  }

  _selectItem(which, name, rxcui, input) {
    const key = `drug${which.toUpperCase()}`;
    this[key] = { name, rxcui };
    input.value = name;
    input.classList.add('has-value');
    this._closeDropdown(which);
    this._hideError(which);
    // Auto-focus next input
    if (which === 'a') this.container.querySelector('#drug-b-input').focus();
  }

  _closeDropdown(which) {
    const dropdown = this.container.querySelector(`#dropdown-${which}`);
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      this.container.querySelector(`#drug-${which}-input`)?.setAttribute('aria-expanded', 'false');
    }
  }

  _swap() {
    const inputA = this.container.querySelector('#drug-a-input');
    const inputB = this.container.querySelector('#drug-b-input');
    [inputA.value, inputB.value] = [inputB.value, inputA.value];
    [this.drugA, this.drugB] = [this.drugB, this.drugA];
    inputA.classList.toggle('has-value', inputA.value.length > 0);
    inputB.classList.toggle('has-value', inputB.value.length > 0);
  }

  _submit() {
    const nameA = this.container.querySelector('#drug-a-input').value.trim();
    const nameB = this.container.querySelector('#drug-b-input').value.trim();
    let valid = true;

    if (!nameA) { this._showError('a', 'Please enter the first drug name.'); valid = false; }
    if (!nameB) { this._showError('b', 'Please enter the second drug name.'); valid = false; }
    if (nameA && nameB && nameA.toLowerCase() === nameB.toLowerCase()) {
      this._showError('b', 'Please enter two different drugs.');
      valid = false;
    }

    if (!valid) return;

    const drugAFinal = this.drugA.name === nameA ? this.drugA : { name: nameA, rxcui: null };
    const drugBFinal = this.drugB.name === nameB ? this.drugB : { name: nameB, rxcui: null };
    this.onSubmit(drugAFinal, drugBFinal);
  }

  _showError(which, msg) {
    const el = this.container.querySelector(`#error-${which}`);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }

  _hideError(which) {
    const el = this.container.querySelector(`#error-${which}`);
    if (el) el.classList.remove('visible');
  }

  /** Pre-fill the form (for popular check buttons) */
  prefill(nameA, nameB) {
    const inputA = this.container.querySelector('#drug-a-input');
    const inputB = this.container.querySelector('#drug-b-input');
    if (inputA) { inputA.value = nameA; inputA.classList.add('has-value'); }
    if (inputB) { inputB.value = nameB; inputB.classList.add('has-value'); }
    this.drugA = { name: nameA, rxcui: null };
    this.drugB = { name: nameB, rxcui: null };
  }

  _esc(str) { return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  _highlight(text, query) {
    if (!query) return this._esc(text);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this._esc(text).replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<mark style="background:rgba(59,130,246,.25);color:inherit;border-radius:2px">$1</mark>'
    );
  }
}
