/**
 * DrugSafe — Main Application
 * Orchestrates routing, API calls, and component rendering
 */

import { SearchForm }      from './components/SearchForm.js';
import { ResultsHeader }   from './components/ResultsHeader.js';
import { AccordionPanel }  from './components/AccordionPanel.js';
import { DeveloperPanel }  from './components/DeveloperPanel.js';
import { renderReactionsChart, renderOutcomesDonut, renderTimeSeriesChart, renderSingleDrugBar, renderComparisonBar } from './components/FaersCharts.js';

import { resolveRxCui, getDrugSuggestions } from './api/rxnorm.js';
import { getDrugProfile }  from './api/rxnorm.js';
import { getDDinterInteraction } from './api/ddinter.js';
import { getDrugLabel, getFaersReactions, getFaersSerious, getFaersTimeSeries, getDrugRecalls, getSingleDrugAdverseEvents, getApiKey, setApiKey, getUsage } from './api/openfda.js';

import { fromDDinterSeverity, fromDDinterLabel, fromLabelText, getSeverityMeta } from './utils/severity.js';
import { HELP } from './components/HelpSystem.js';
import { formatNumber, formatFdaDate, truncate, titleCase } from './utils/normalize.js';

/* ============================================================
   Router — toggle screens
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   Toast notifications
   ============================================================ */
function showToast(message, type = 'info', durationMs = 4000) {
  const container = document.getElementById('toast-container');
  const icons = {
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type] || ''} <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}

/* ============================================================
   Modal helpers
   ============================================================ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  const firstFocusable = el.querySelector('button, input, [tabindex]:not([tabindex="-1"])');
  firstFocusable?.focus();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function trapFocus(modal) {
  const focusables = modal.querySelectorAll('button, input, a, [tabindex]:not([tabindex="-1"])');
  const first = focusables[0];
  const last  = focusables[focusables.length - 1];
  modal.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });
}

/* ============================================================
   Settings helpers
   ============================================================ */
function updateUsageDisplay() {
  const usage  = getUsage();
  const hasKey = !!getApiKey();
  const limit  = hasKey ? 120000 : 1000;
  const pct    = Math.min(100, (usage / limit) * 100);
  const bar    = document.getElementById('usage-bar');
  const count  = document.getElementById('usage-count');
  if (bar)   bar.style.width = `${pct}%`;
  if (count) count.textContent = `${formatNumber(usage)} / ${formatNumber(limit)}`;
  if (bar) {
    bar.style.background = pct > 80 ? 'var(--color-danger)' : pct > 50 ? 'var(--color-warn)' : 'var(--color-accent)';
  }
}

/* ============================================================
   Severity helper — pick best available source
   ============================================================ */
function deriveSeverity(ddinterData, labelA, labelB) {
  if (ddinterData && ddinterData.fromCors !== false) {
    if (ddinterData.severity != null) return fromDDinterSeverity(ddinterData.severity);
    if (ddinterData.severityLabel)    return fromDDinterLabel(ddinterData.severityLabel);
  }
  // Fall back to FDA label text
  const combined = [labelA?.interactions, labelA?.warnings, labelA?.contraindications,
                    labelB?.interactions, labelB?.warnings, labelB?.contraindications]
    .filter(Boolean).join(' ');
  if (combined) return fromLabelText(combined);
  return 'unknown';
}

/* ============================================================
   Panel renderers
   ============================================================ */

function renderDDinterPanel(panel, ddinterData, nameA, nameB) {
  if (!ddinterData || ddinterData.error === 'cors' || ddinterData.error === 'timeout') {
    panel.setUnavailable(
      `DDinter 2.0 data is unavailable (CORS restriction). <br>
       <a href="https://ddinter2.scbdd.com" target="_blank" rel="noopener" class="external-link">
         Browse DDinter 2.0 directly
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
       </a>`
    );
    return;
  }

  if (!ddinterData.mechanism && !ddinterData.management) {
    panel.setUnavailable(`No interaction record found in DDinter 2.0 for <strong>${nameA}</strong> + <strong>${nameB}</strong>.`);
    return;
  }

  const stars = ddinterData.severity ? _stars(parseInt(ddinterData.severity, 10)) : '';
  const refs = Array.isArray(ddinterData.references)
    ? ddinterData.references.slice(0, 5)
        .map(id => `<a href="https://pubmed.ncbi.nlm.nih.gov/${id}/" target="_blank" rel="noopener" class="meta-tag">${id}</a>`)
        .join(' ')
    : '';

  panel.setContent(`
    <div class="panel-section">
      ${ddinterData.severityLabel
        ? `<div class="panel-meta">
             <span class="meta-tag">${ddinterData.severityLabel}</span>
             ${ddinterData.type ? `<span class="meta-tag">${ddinterData.type}</span>` : ''}
           </div>` : ''}
      ${stars}
    </div>
    ${ddinterData.mechanism ? `
    <div class="panel-section">
      <div class="panel-section-title">Mechanism</div>
      <p class="panel-text">${_esc(ddinterData.mechanism)}</p>
    </div>` : ''}
    ${ddinterData.management ? `
    <div class="panel-section">
      <div class="panel-section-title">Clinical Management</div>
      <p class="panel-text">${_esc(ddinterData.management)}</p>
    </div>` : ''}
    ${refs ? `
    <div class="panel-section">
      <div class="panel-section-title">References (PubMed)</div>
      <div class="panel-meta">${refs}</div>
    </div>` : ''}
    <a href="${ddinterData.url || 'https://ddinter2.scbdd.com'}" target="_blank" rel="noopener" class="external-link">
      View full record on DDinter 2.0
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>
  `);
}

async function renderAdverseEffectsPanel(panel, labelA, labelB, faersSingleA, faersSingleB, nameA, nameB) {
  const body = panel.bodyEl;
  let hasAnyData = false;

  // Drug A = blue, Drug B = purple
  const COLORS = ['96,165,250', '167,139,250'];

  function parseLabelReactions(text) {
    if (!text) return [];
    return text
      .replace(/\([^)]*\)/g, '')
      .split(/[;,\n•·\-–]+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s.length > 3 && s.length < 80 && !/^\d+/.test(s))
      .slice(0, 24);
  }

  for (const [idx, [label, faers, name]] of [
    [labelA, faersSingleA, nameA],
    [labelB, faersSingleB, nameB],
  ].entries()) {
    const labelRx = label?.adverseReactions ? parseLabelReactions(label.adverseReactions) : [];
    const faersRx = faers?.reactions || [];
    if (!labelRx.length && !faersRx.length) continue;
    hasAnyData = true;

    const section = document.createElement('div');
    section.className = 'adverse-drug-section';

    // Section header with source badges
    const hdr = document.createElement('div');
    hdr.className = 'adverse-drug-header';
    hdr.innerHTML = `
      <span class="adverse-drug-name" style="color:rgba(${COLORS[idx]},1)">${_esc(name)}</span>
      ${label?.adverseReactions ? '<span class="source-badge fda">FDA Label</span>' : ''}
      ${faersRx.length ? `<span class="source-badge faers">FAERS · ${formatNumber(faers.total)} reports</span>` : ''}
    `;
    section.appendChild(hdr);

    // FDA label adverse reactions — pill tags (text-based, not numerical)
    if (labelRx.length) {
      const sub = document.createElement('div');
      sub.className = 'adverse-subsection';
      sub.innerHTML = `
        <div class="adverse-subsection-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          FDA Label — Known Adverse Reactions
        </div>
        <div class="adverse-reactions-list">
          ${labelRx.map(r => `<span class="adverse-reaction-pill">${_esc(r)}</span>`).join('')}
        </div>
      `;
      section.appendChild(sub);
    }

    // FAERS reactions — bar chart
    if (faersRx.length) {
      const sub = document.createElement('div');
      sub.className = 'adverse-subsection';
      sub.innerHTML = `
        <div class="adverse-subsection-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          FAERS — Top 10 Reported Reactions
        </div>
      `;
      section.appendChild(sub);
      await renderSingleDrugBar(sub, faersRx, name, COLORS[idx]);
    }

    body.appendChild(section);
  }

  if (!hasAnyData) {
    panel.setUnavailable('No adverse effect data found for either drug across FDA labels and FAERS.');
    return;
  }

  // Comparison chart — both drugs side by side
  const rxA = faersSingleA?.reactions || [];
  const rxB = faersSingleB?.reactions || [];
  if (rxA.length && rxB.length) {
    const compSection = document.createElement('div');
    compSection.className = 'adverse-drug-section';
    compSection.innerHTML = `
      <div class="adverse-subsection-title" style="margin-bottom:12px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        Side-by-Side Comparison — Top Reactions
      </div>
    `;
    body.appendChild(compSection);
    await renderComparisonBar(compSection, rxA, rxB, nameA, nameB);
  }

  // Footer note
  const note = document.createElement('p');
  note.className = 'panel-text';
  note.style.cssText = 'margin-top:18px; font-size:.75rem; border-top:1px solid var(--color-border); padding-top:12px;';
  note.innerHTML = `
    <strong>Sources:</strong> FDA Label adverse reactions section &amp; FAERS individual drug reports.
    FAERS counts reflect all reports for each drug alone — not limited to when both drugs are taken together.
  `;
  body.appendChild(note);
}

function renderLabelPanel(panel, labelA, labelB, nameA, nameB) {
  const sections = [];

  for (const [label, name] of [[labelA, nameA], [labelB, nameB]]) {
    if (!label) continue;
    const parts = [];
    if (label.interactions) {
      parts.push(`
        <div class="panel-section-title">${_esc(label.genericName || name)} — Drug Interactions</div>
        <div class="label-excerpt">${_esc(truncate(label.interactions, 600))}</div>`);
    }
    if (label.contraindications) {
      parts.push(`
        <div class="panel-section-title" style="margin-top:12px">Contraindications</div>
        <div class="label-excerpt">${_esc(truncate(label.contraindications, 400))}</div>`);
    }
    if (label.warnings) {
      parts.push(`
        <div class="panel-section-title" style="margin-top:12px">Warnings & Precautions</div>
        <div class="label-excerpt">${_esc(truncate(label.warnings, 400))}</div>`);
    }
    if (parts.length) {
      sections.push(`
        <div class="panel-section">
          ${parts.join('')}
          ${label.effectiveTime ? `<p class="panel-text" style="margin-top:8px;font-size:.75rem">Label effective: ${formatFdaDate(label.effectiveTime)}</p>` : ''}
          ${label.labelUrl ? `<a href="${label.labelUrl}" target="_blank" rel="noopener" class="external-link">View full FDA label on DailyMed <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
        </div>`);
    }
  }

  if (!sections.length) {
    panel.setUnavailable('No drug label data found on openFDA for this combination.');
    return;
  }
  panel.setContent(sections.join('<hr class="divider">'));
}

async function renderFaersPanel(panel, reactions, serious, timeSeries, nameA, nameB) {
  const total = reactions?.total || 0;

  let html = `<div class="panel-section">
    <div class="faers-stats">
      <div class="faers-stat-card">
        <div class="faers-stat-number">${formatNumber(total)}</div>
        <div class="faers-stat-label">Co-reported events</div>
      </div>
      ${serious?.seriousCount != null ? `
      <div class="faers-stat-card">
        <div class="faers-stat-number">${formatNumber(serious.seriousCount)}</div>
        <div class="faers-stat-label">Serious reports</div>
      </div>` : ''}
      ${total > 0 && serious?.seriousCount != null ? `
      <div class="faers-stat-card">
        <div class="faers-stat-number">${total > 0 ? Math.round((serious.seriousCount / total) * 100) : 0}%</div>
        <div class="faers-stat-label">Serious rate</div>
      </div>` : ''}
    </div>
  </div>`;

  panel.setContent(html);

  // Append charts
  const body = panel.bodyEl;

  if (reactions?.reactions?.length) {
    const reactionSection = document.createElement('div');
    reactionSection.className = 'panel-section';
    reactionSection.innerHTML = '<div class="chart-title">Top 10 Adverse Reactions</div>';
    body.appendChild(reactionSection);
    await renderReactionsChart(reactionSection, reactions.reactions);
  }

  if (total > 0 && serious?.seriousCount != null) {
    const chartsRow = document.createElement('div');
    chartsRow.className = 'chart-row panel-section';

    const donutSection = document.createElement('div');
    donutSection.innerHTML = '<div class="chart-title">Outcome Breakdown</div>';
    chartsRow.appendChild(donutSection);
    await renderOutcomesDonut(donutSection, serious.seriousCount, total);

    const tsSection = document.createElement('div');
    tsSection.innerHTML = '<div class="chart-title">Reports Over Time</div>';
    chartsRow.appendChild(tsSection);
    await renderTimeSeriesChart(tsSection, timeSeries?.points || []);

    body.appendChild(chartsRow);
  }

  if (total > 0) {
    const queryParam = encodeURIComponent(`${nameA} ${nameB}`);
    const link = document.createElement('a');
    link.href = `https://fis.fda.gov/sense/app/95239e07-37cb-439d-b5e4-8e8c2e6c9bbc/sheet/45beaa11-1b49-4d55-aa99-f57b5bf1a6a4/state/analysis`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'external-link';
    link.innerHTML = `View on FAERS Public Dashboard <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    body.appendChild(link);
  }

  if (total === 0 && !reactions?.reactions?.length) {
    panel.setUnavailable('No co-reported adverse event records found for this drug combination in FAERS.');
  }
}

function renderRecallsPanel(panel, recallsA, recallsB, nameA, nameB) {
  const all = [...(recallsA?.recalls || []), ...(recallsB?.recalls || [])];

  if (!all.length) {
    panel.setContent(`
      <div class="panel-section">
        <div class="recall-safe-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          No active FDA recalls found for ${_esc(nameA)} or ${_esc(nameB)}
        </div>
      </div>`);
    return;
  }

  const items = all.map(r => {
    const cls = r.classification === 'Class I' ? 'class-i'
               : r.classification === 'Class II' ? 'class-ii' : 'class-iii';
    return `
      <div class="recall-item">
        <span class="recall-class ${cls}">${_esc(r.classification || 'Class Unknown')}</span>
        <p class="panel-text"><strong>${_esc(r.recalling_firm || 'Unknown firm')}</strong></p>
        <p class="panel-text" style="margin-top:4px">${_esc(truncate(r.reason_for_recall, 240))}</p>
        ${r.recall_initiation_date ? `<p class="panel-text" style="margin-top:4px;font-size:.75rem">Initiated: ${formatFdaDate(r.recall_initiation_date)}</p>` : ''}
      </div>`;
  }).join('');

  panel.setContent(`<div class="panel-section">${items}</div>`);
}

function renderProfilesPanel(panel, profileA, profileB, nameA, nameB) {
  const card = (profile, fallbackName) => {
    if (!profile) return `<div class="drug-profile-card"><p class="profile-drug-name">${_esc(fallbackName)}</p><p class="panel-text" style="color:var(--color-muted-2)">Profile data unavailable</p></div>`;
    return `
      <div class="drug-profile-card">
        <div class="profile-drug-name">${_esc(profile.name || fallbackName)}</div>
        <div class="profile-row">
          <div class="profile-key">RxCUI</div>
          <div class="profile-val"><span class="rxcui-code">${_esc(String(profile.rxcui || '–'))}</span></div>
        </div>
        ${profile.drugClass ? `
        <div class="profile-row">
          <div class="profile-key">Drug Class</div>
          <div class="profile-val">${_esc(profile.drugClass)}</div>
        </div>` : ''}
        ${profile.ingredients?.length ? `
        <div class="profile-row">
          <div class="profile-key">Active Ingredient(s)</div>
          <div class="profile-val">${profile.ingredients.map(i => _esc(i)).join(', ')}</div>
        </div>` : ''}
        ${profile.brandNames?.length ? `
        <div class="profile-row">
          <div class="profile-key">Brand Names</div>
          <div class="profile-val">${profile.brandNames.map(b => _esc(b)).join(', ')}</div>
        </div>` : ''}
        ${profile.forms?.length ? `
        <div class="profile-row">
          <div class="profile-key">Dosage Forms</div>
          <div class="profile-val">${profile.forms.map(f => _esc(f)).join(', ')}</div>
        </div>` : ''}
      </div>`;
  };

  panel.setContent(`
    <div class="panel-section">
      <div class="drug-profiles-grid">
        ${card(profileA, nameA)}
        ${card(profileB, nameB)}
      </div>
    </div>`);
}

/* ============================================================
   Main check orchestration
   ============================================================ */
async function runInteractionCheck(rawA, rawB, header, panelsContainer, devPanel) {
  panelsContainer.innerHTML = '';

  // Normalize drug names for display
  const displayA = titleCase(rawA.name);
  const displayB = titleCase(rawB.name);

  // --- Render skeleton header immediately ---
  header.render(displayA, displayB, 'unknown', 'Analyzing interaction data…');

  // --- Create all accordion panels ---
  const ddinterPanel  = new AccordionPanel(panelsContainer, {
    id: 'ddinter', index: 0, openByDefault: true,
    title: 'DDinter 2.0 — Interaction Mechanism',
    subtitle: '302,516 curated DDI records',
    iconColorClass: 'blue',
    helpContent: HELP.ddinter,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  });
  const adversePanel = new AccordionPanel(panelsContainer, {
    id: 'adverse', index: 1,
    title: 'Adverse Effects — Per-Drug Side Effects',
    subtitle: 'Compiled from FDA labels & FAERS individual reports',
    iconColorClass: 'red',
    helpContent: HELP.adverse,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M8.56 2.9A7 7 0 0 1 19 9v4"/><path d="M19 19a7 7 0 0 1-13.86-2"/><path d="m3 3 18 18"/></svg>`,
  });
  const labelPanel = new AccordionPanel(panelsContainer, {
    id: 'label', index: 2,
    title: 'FDA Drug Labeling — Warnings & Contraindications',
    subtitle: 'Official FDA label text',
    iconColorClass: 'amber',
    helpContent: HELP.label,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  });
  const faersPanel = new AccordionPanel(panelsContainer, {
    id: 'faers', index: 3,
    title: 'FAERS Adverse Events — Combined Reports',
    subtitle: 'Reports where BOTH drugs appear together',
    iconColorClass: 'purple',
    helpContent: HELP.faers,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  });
  const recallPanel = new AccordionPanel(panelsContainer, {
    id: 'recalls', index: 4,
    title: 'FDA Recalls & Enforcement Actions',
    subtitle: 'Active recall status for both drugs',
    iconColorClass: 'amber',
    helpContent: HELP.recalls,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  });
  const profilePanel = new AccordionPanel(panelsContainer, {
    id: 'profiles', index: 5,
    title: 'Drug Profiles — RxNorm Data',
    subtitle: 'RxCUI, drug class, dosage forms, ingredients',
    iconColorClass: 'green',
    helpContent: HELP.profiles,
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  });

  // --- Step 1: Resolve RxCUIs ---
  let rxcuiA = rawA.rxcui;
  let rxcuiB = rawB.rxcui;
  let resolvedA = rawA.name;
  let resolvedB = rawB.name;

  const [resolveResultA, resolveResultB] = await Promise.all([
    rxcuiA ? Promise.resolve({ rxcui: rxcuiA, name: rawA.name }) : resolveRxCui(rawA.name),
    rxcuiB ? Promise.resolve({ rxcui: rxcuiB, name: rawB.name }) : resolveRxCui(rawB.name),
  ]);

  if (resolveResultA) { rxcuiA = resolveResultA.rxcui; resolvedA = resolveResultA.name; }
  if (resolveResultB) { rxcuiB = resolveResultB.rxcui; resolvedB = resolveResultB.name; }

  devPanel.addRequest({
    label: 'RxNorm — Resolve A',
    method: 'GET',
    url: `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${rawA.name}&search=2`,
    status: resolveResultA ? 200 : 404,
    response: resolveResultA,
  });
  devPanel.addRequest({
    label: 'RxNorm — Resolve B',
    method: 'GET',
    url: `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${rawB.name}&search=2`,
    status: resolveResultB ? 200 : 404,
    response: resolveResultB,
  });

  // --- Step 2: DDinter (primary severity) ---
  const ddinterData = await getDDinterInteraction(resolvedA, resolvedB);
  devPanel.addRequest({
    label: 'DDinter 2.0',
    method: 'GET',
    url: `https://ddinter2.scbdd.com/api/interaction/?drug_a=${resolvedA}&drug_b=${resolvedB}`,
    status: ddinterData?.fromCors ? 200 : 0,
    response: ddinterData,
  });
  renderDDinterPanel(ddinterPanel, ddinterData, displayA, displayB);

  // --- Step 3: Parallel enrichment ---
  const [labelA, labelB, reactions, serious, timeSeries, recallsA, recallsB, profileA, profileB,
         adverseA, adverseB] =
    await Promise.allSettled([
      getDrugLabel(resolvedA),
      getDrugLabel(resolvedB),
      getFaersReactions(resolvedA, resolvedB),
      getFaersSerious(resolvedA, resolvedB),
      getFaersTimeSeries(resolvedA, resolvedB),
      getDrugRecalls(resolvedA),
      getDrugRecalls(resolvedB),
      rxcuiA ? getDrugProfile(rxcuiA, resolvedA) : Promise.resolve(null),
      rxcuiB ? getDrugProfile(rxcuiB, resolvedB) : Promise.resolve(null),
      getSingleDrugAdverseEvents(resolvedA),
      getSingleDrugAdverseEvents(resolvedB),
    ]);

  const v = r => r.status === 'fulfilled' ? r.value : null;

  devPanel.addRequest({ label: 'openFDA Label A', method: 'GET', url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${resolvedA}"`, status: v(labelA) ? 200 : 404, response: v(labelA) });
  devPanel.addRequest({ label: 'openFDA Label B', method: 'GET', url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${resolvedB}"`, status: v(labelB) ? 200 : 404, response: v(labelB) });
  devPanel.addRequest({ label: 'FAERS Reactions', method: 'GET', url: v(reactions)?.url || '', status: v(reactions) ? 200 : 500, response: v(reactions) });
  devPanel.addRequest({ label: 'FAERS Serious',   method: 'GET', url: v(serious)?.url   || '', status: v(serious)   ? 200 : 500, response: v(serious)   });
  devPanel.addRequest({ label: 'FAERS Time Series', method: 'GET', url: v(timeSeries)?.url || '', status: v(timeSeries) ? 200 : 500, response: v(timeSeries) });
  devPanel.addRequest({ label: `FAERS Single — ${displayA}`, method: 'GET', url: v(adverseA)?.url || '', status: v(adverseA) ? 200 : 500, response: v(adverseA) });
  devPanel.addRequest({ label: `FAERS Single — ${displayB}`, method: 'GET', url: v(adverseB)?.url || '', status: v(adverseB) ? 200 : 500, response: v(adverseB) });

  // Render adverse effects panel
  await renderAdverseEffectsPanel(adversePanel, v(labelA), v(labelB), v(adverseA), v(adverseB), displayA, displayB);

  // Render label panel
  renderLabelPanel(labelPanel, v(labelA), v(labelB), displayA, displayB);

  // Render FAERS panel
  await renderFaersPanel(faersPanel, v(reactions), v(serious), v(timeSeries), resolvedA, resolvedB);

  // Render recalls panel
  renderRecallsPanel(recallPanel, v(recallsA), v(recallsB), displayA, displayB);

  // Render profiles panel
  renderProfilesPanel(profilePanel, v(profileA), v(profileB), displayA, displayB);

  // Update severity header with best available data
  const severity = deriveSeverity(ddinterData, v(labelA), v(labelB));
  const sevMeta  = getSeverityMeta(severity);
  let desc = ddinterData?.mechanism
    ? truncate(ddinterData.mechanism, 120)
    : sevMeta.description;
  if (v(reactions)?.total > 0) {
    desc += ` ${formatNumber(v(reactions).total)} co-reported adverse events in FAERS.`;
  }
  header.updateSeverity(severity, desc);
}

/* ============================================================
   Utilities
   ============================================================ */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _stars(num) {
  const n = Math.max(1, Math.min(5, num || 1));
  let html = '<div class="ddinter-stars" aria-label="Severity: ' + n + ' of 5 stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<div class="star${i <= n ? ' filled' : ''}" aria-hidden="true"></div>`;
  }
  return html + '</div>';
}

/* ============================================================
   Single Drug — panel renderers
   ============================================================ */

async function renderSingleAdversePanel(panel, label, faers, drugName) {
  const body = panel.bodyEl;
  const COLOR = '96,165,250';
  let hasData = false;

  function parseLabelReactions(text) {
    if (!text) return [];
    return text
      .replace(/\([^)]*\)/g, '')
      .split(/[;,\n•·\-–]+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s.length > 3 && s.length < 80 && !/^\d+/.test(s))
      .slice(0, 24);
  }

  const labelRx = label?.adverseReactions ? parseLabelReactions(label.adverseReactions) : [];
  const faersRx = faers?.reactions || [];

  if (labelRx.length) {
    hasData = true;
    const sub = document.createElement('div');
    sub.className = 'adverse-subsection';
    sub.innerHTML = `
      <div class="adverse-subsection-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        FDA Label — Known Adverse Reactions
        ${faers?.total ? `<span class="source-badge faers">FAERS · ${formatNumber(faers.total)} reports</span>` : ''}
      </div>
      <div class="adverse-reactions-list">
        ${labelRx.map(r => `<span class="adverse-reaction-pill">${_esc(r)}</span>`).join('')}
      </div>
    `;
    body.appendChild(sub);
  }

  if (faersRx.length) {
    hasData = true;
    const sub = document.createElement('div');
    sub.className = 'adverse-subsection';
    sub.innerHTML = `
      <div class="adverse-subsection-title" style="margin-top:${labelRx.length ? '18px' : '0'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        FAERS — Top Reported Reactions
      </div>
    `;
    body.appendChild(sub);
    await renderSingleDrugBar(sub, faersRx, drugName, COLOR);
  }

  if (!hasData) {
    panel.setUnavailable(`No adverse effect data found for <strong>${_esc(drugName)}</strong> in FDA labels or FAERS.`);
    return;
  }

  const note = document.createElement('p');
  note.className = 'panel-text';
  note.style.cssText = 'margin-top:18px; font-size:.75rem; border-top:1px solid var(--color-border); padding-top:12px;';
  note.innerHTML = `<strong>Sources:</strong> FDA Label adverse reactions section &amp; FAERS individual drug reports.`;
  body.appendChild(note);
}

function renderSingleRecallsPanel(panel, recalls, drugName) {
  const all = recalls?.recalls || [];

  if (!all.length) {
    panel.setContent(`
      <div class="panel-section">
        <div class="recall-safe-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          No active FDA recalls found for ${_esc(drugName)}
        </div>
      </div>`);
    return;
  }

  const items = all.map(r => {
    const cls = r.classification === 'Class I' ? 'class-i'
               : r.classification === 'Class II' ? 'class-ii' : 'class-iii';
    return `
      <div class="recall-item">
        <span class="recall-class ${cls}">${_esc(r.classification || 'Class Unknown')}</span>
        <p class="panel-text"><strong>${_esc(r.recalling_firm || 'Unknown firm')}</strong></p>
        <p class="panel-text" style="margin-top:4px">${_esc(truncate(r.reason_for_recall, 240))}</p>
        ${r.recall_initiation_date ? `<p class="panel-text" style="margin-top:4px;font-size:.75rem">Initiated: ${formatFdaDate(r.recall_initiation_date)}</p>` : ''}
      </div>`;
  }).join('');

  panel.setContent(`<div class="panel-section">${items}</div>`);
}

function renderSingleLabelPanel(panel, label, drugName) {
  if (!label) {
    panel.setUnavailable(`No FDA label data found for <strong>${_esc(drugName)}</strong>.`);
    return;
  }

  const parts = [];
  if (label.adverseReactions) {
    parts.push(`
      <div class="panel-section-title">${_esc(label.genericName || drugName)} — Adverse Reactions</div>
      <div class="label-excerpt">${_esc(truncate(label.adverseReactions, 600))}</div>`);
  }
  if (label.warnings) {
    parts.push(`
      <div class="panel-section-title" style="margin-top:12px">Warnings &amp; Precautions</div>
      <div class="label-excerpt">${_esc(truncate(label.warnings, 400))}</div>`);
  }
  if (label.contraindications) {
    parts.push(`
      <div class="panel-section-title" style="margin-top:12px">Contraindications</div>
      <div class="label-excerpt">${_esc(truncate(label.contraindications, 400))}</div>`);
  }
  if (label.interactions) {
    parts.push(`
      <div class="panel-section-title" style="margin-top:12px">Drug Interactions</div>
      <div class="label-excerpt">${_esc(truncate(label.interactions, 400))}</div>`);
  }

  if (!parts.length) {
    panel.setUnavailable(`No detailed label sections found for <strong>${_esc(drugName)}</strong>.`);
    return;
  }

  panel.setContent(`
    <div class="panel-section">
      ${parts.join('')}
      ${label.effectiveTime ? `<p class="panel-text" style="margin-top:8px;font-size:.75rem">Label effective: ${formatFdaDate(label.effectiveTime)}</p>` : ''}
      ${label.labelUrl ? `<a href="${label.labelUrl}" target="_blank" rel="noopener" class="external-link">View full FDA label on DailyMed <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
    </div>`);
}

function renderSingleProfilePanel(panel, profile, drugName) {
  if (!profile) {
    panel.setUnavailable(`No RxNorm profile data found for <strong>${_esc(drugName)}</strong>.`);
    return;
  }

  panel.setContent(`
    <div class="panel-section">
      <div class="drug-profiles-grid" style="grid-template-columns:1fr">
        <div class="drug-profile-card">
          <div class="profile-drug-name">${_esc(profile.name || drugName)}</div>
          <div class="profile-row"><div class="profile-key">RxCUI</div><div class="profile-val"><span class="rxcui-code">${_esc(String(profile.rxcui || '–'))}</span></div></div>
          ${profile.drugClass ? `<div class="profile-row"><div class="profile-key">Drug Class</div><div class="profile-val">${_esc(profile.drugClass)}</div></div>` : ''}
          ${profile.ingredients?.length ? `<div class="profile-row"><div class="profile-key">Active Ingredient(s)</div><div class="profile-val">${profile.ingredients.map(i => _esc(i)).join(', ')}</div></div>` : ''}
          ${profile.brandNames?.length ? `<div class="profile-row"><div class="profile-key">Brand Names</div><div class="profile-val">${profile.brandNames.map(b => _esc(b)).join(', ')}</div></div>` : ''}
          ${profile.forms?.length ? `<div class="profile-row"><div class="profile-key">Dosage Forms</div><div class="profile-val">${profile.forms.map(f => _esc(f)).join(', ')}</div></div>` : ''}
        </div>
      </div>
    </div>`);
}

/* ============================================================
   Single Drug — main orchestration
   ============================================================ */
async function runSingleDrugLookup(raw, panelsContainer) {
  panelsContainer.innerHTML = '';
  const displayName = titleCase(raw.name);

  // Render header inline
  const headerEl = document.getElementById('single-results-header-container');
  headerEl.innerHTML = `
    <div class="single-drug-result-header">
      <button class="results-back-btn" id="single-back-btn" aria-label="Back to Drug Profile search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Back
      </button>
      <div class="single-drug-title-block">
        <div class="single-drug-badge">Drug Profile</div>
        <h2 class="single-drug-name">${_esc(displayName)}</h2>
        <p class="single-drug-subtitle">Adverse effects, FAERS reports &amp; FDA recalls</p>
      </div>
    </div>`;

  document.getElementById('single-back-btn').addEventListener('click', () => {
    showScreen('single-drug-screen');
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  // Create panels
  const adversePanel = new AccordionPanel(panelsContainer, {
    id: 'sd-adverse', index: 0, openByDefault: true,
    title: 'Adverse Effects',
    subtitle: 'FDA label reactions &amp; FAERS reports',
    iconColorClass: 'red',
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M8.56 2.9A7 7 0 0 1 19 9v4"/><path d="M19 19a7 7 0 0 1-13.86-2"/><path d="m3 3 18 18"/></svg>`,
  });

  const recallPanel = new AccordionPanel(panelsContainer, {
    id: 'sd-recalls', index: 1,
    title: 'FDA Recalls &amp; Enforcement',
    subtitle: 'Active recall status',
    iconColorClass: 'amber',
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  });

  const labelPanel = new AccordionPanel(panelsContainer, {
    id: 'sd-label', index: 2,
    title: 'FDA Drug Label',
    subtitle: 'Warnings, contraindications &amp; interaction text',
    iconColorClass: 'amber',
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  });

  const profilePanel = new AccordionPanel(panelsContainer, {
    id: 'sd-profile', index: 3,
    title: 'Drug Profile — RxNorm',
    subtitle: 'RxCUI, drug class, dosage forms, ingredients',
    iconColorClass: 'green',
    iconHtml: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  });

  // Resolve RxCUI
  let rxcui = raw.rxcui;
  let resolved = raw.name;
  if (!rxcui) {
    const r = await resolveRxCui(raw.name);
    if (r) { rxcui = r.rxcui; resolved = r.name; }
  }

  // Fetch all data in parallel
  const [label, faers, recalls, profile] = await Promise.allSettled([
    getDrugLabel(resolved),
    getSingleDrugAdverseEvents(resolved),
    getDrugRecalls(resolved),
    rxcui ? getDrugProfile(rxcui, resolved) : Promise.resolve(null),
  ]);

  const v = r => r.status === 'fulfilled' ? r.value : null;

  await renderSingleAdversePanel(adversePanel, v(label), v(faers), displayName);
  renderSingleRecallsPanel(recallPanel, v(recalls), displayName);
  renderSingleLabelPanel(labelPanel, v(label), displayName);
  renderSingleProfilePanel(profilePanel, v(profile), displayName);

  updateUsageDisplay();
}

/* ============================================================
   App bootstrap
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* --- Search Form --- */
  const searchFormContainer = document.getElementById('search-form-container');
  let searchForm;

  const resultsHeaderContainer = document.getElementById('results-header-container');
  const resultsPanelsContainer = document.getElementById('results-panels-container');
  const devPanelContainer      = document.getElementById('developer-panel-container');

  const resultsHeader = new ResultsHeader(resultsHeaderContainer, () => {
    showScreen('search-screen');
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  let devPanel;

  function initSearchScreen() {
    searchForm = new SearchForm(searchFormContainer, async (drugA, drugB) => {
      // Transition to results
      showScreen('results-screen');
      document.getElementById('disclaimer-banner').classList.remove('hidden');

      // Reset dev panel
      devPanelContainer.innerHTML = '';
      devPanel = new DeveloperPanel(devPanelContainer);

      try {
        await runInteractionCheck(drugA, drugB, resultsHeader, resultsPanelsContainer, devPanel);
      } catch (err) {
        console.error(err);
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
      updateUsageDisplay();
    });
  }

  initSearchScreen();

  /* --- Popular check buttons --- */
  document.querySelectorAll('.popular-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.drugA;
      const b = btn.dataset.drugB;
      searchForm.prefill(a, b);
      searchForm._submit();
    });
  });

  /* --- How It Works modal --- */
  document.getElementById('how-it-works-btn').addEventListener('click', () => openModal('how-it-works-modal'));
  document.getElementById('close-hiw-modal').addEventListener('click', () => closeModal('how-it-works-modal'));
  const hiwModal = document.getElementById('how-it-works-modal');
  hiwModal.addEventListener('click', e => { if (e.target === hiwModal) closeModal('how-it-works-modal'); });
  trapFocus(hiwModal);

  /* --- Settings modal --- */
  document.getElementById('settings-btn').addEventListener('click', () => {
    updateUsageDisplay();
    const existing = getApiKey();
    if (existing) document.getElementById('api-key-input').value = existing;
    openModal('settings-modal');
  });
  document.getElementById('close-settings-modal').addEventListener('click', () => closeModal('settings-modal'));
  const settingsModal = document.getElementById('settings-modal');
  settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeModal('settings-modal'); });
  trapFocus(settingsModal);

  document.getElementById('save-api-key-btn').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value.trim();
    setApiKey(key || null);
    showToast(key ? 'API key saved.' : 'API key removed.', 'success');
    updateUsageDisplay();
    closeModal('settings-modal');
  });

  /* --- Disclaimer minimize --- */
  document.getElementById('minimize-disclaimer').addEventListener('click', () => {
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  /* --- Keyboard: close modals on Escape --- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('how-it-works-modal');
      closeModal('settings-modal');
    }
  });

  /* --- Header tabs --- */
  const tabInteraction = document.getElementById('tab-interaction');
  const tabSingle      = document.getElementById('tab-single');

  function setActiveTab(which) {
    tabInteraction.classList.toggle('active', which === 'interaction');
    tabInteraction.setAttribute('aria-selected', which === 'interaction');
    tabSingle.classList.toggle('active', which === 'single');
    tabSingle.setAttribute('aria-selected', which === 'single');
  }

  tabInteraction.addEventListener('click', () => {
    setActiveTab('interaction');
    showScreen('search-screen');
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  tabSingle.addEventListener('click', () => {
    setActiveTab('single');
    showScreen('single-drug-screen');
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  /* --- Logo home button --- */
  document.getElementById('logo-home-btn').addEventListener('click', () => {
    setActiveTab('interaction');
    showScreen('search-screen');
    document.getElementById('disclaimer-banner').classList.add('hidden');
  });

  /* --- Single Drug Form --- */
  const singleFormContainer = document.getElementById('single-drug-form-container');
  const singlePanelsContainer = document.getElementById('single-results-panels-container');

  function buildSingleDrugForm() {
    singleFormContainer.innerHTML = `
      <form class="search-form single-search-form" id="single-drug-search-form" novalidate>
        <div class="drug-inputs-row single-input-row">
          <div class="drug-input-wrap" id="single-wrap">
            <label class="drug-input-label" for="single-drug-input">Drug Name</label>
            <svg class="drug-input-icon has-label" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            <input
              type="text"
              id="single-drug-input"
              class="drug-input"
              placeholder="e.g. Warfarin, Atorvastatin…"
              autocomplete="off"
              spellcheck="false"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="single-dropdown"
              role="combobox"
            >
            <div id="single-dropdown" class="autocomplete-dropdown" role="listbox" aria-label="Drug suggestions" style="display:none"></div>
            <div class="input-error" id="single-error"></div>
          </div>
        </div>
        <div class="search-form-actions">
          <button type="submit" class="btn-primary" id="single-check-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            Look Up Drug
          </button>
        </div>
      </form>`;

    let selectedDrug = { name: '', rxcui: null };
    let debounceTimer = null;
    const input    = singleFormContainer.querySelector('#single-drug-input');
    const dropdown = singleFormContainer.querySelector('#single-dropdown');
    const errorEl  = singleFormContainer.querySelector('#single-error');
    const form     = singleFormContainer.querySelector('#single-drug-search-form');

    function closeDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
    }

    function showItems(items) {
      if (!items.length) {
        dropdown.innerHTML = `<div class="autocomplete-empty">No matches found. Try a different spelling.</div>`;
        dropdown.style.display = 'block';
        return;
      }
      const val = input.value.trim();
      dropdown.innerHTML = items.map(item => `
        <div class="autocomplete-item" role="option" aria-selected="false"
          data-name="${String(item.name).replace(/"/g,'&quot;').replace(/</g,'&lt;')}"
          data-rxcui="${item.rxcui}" tabindex="-1">
          <span class="autocomplete-name">${String(item.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>
          <span class="autocomplete-rxcui">RxCUI: ${item.rxcui}${item.tty ? ' · ' + item.tty : ''}</span>
        </div>`).join('');
      dropdown.style.display = 'block';
      input.setAttribute('aria-expanded', 'true');
      dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedDrug = { name: el.dataset.name, rxcui: el.dataset.rxcui };
          input.value = el.dataset.name;
          input.classList.add('has-value');
          closeDropdown();
        });
      });
    }

    input.addEventListener('input', () => {
      const val = input.value.trim();
      selectedDrug = { name: val, rxcui: null };
      input.classList.toggle('has-value', val.length > 0);
      errorEl.classList.remove('visible');
      clearTimeout(debounceTimer);
      if (val.length < 2) { closeDropdown(); return; }
      debounceTimer = setTimeout(async () => {
        dropdown.innerHTML = `<div class="autocomplete-loading"><div class="skeleton skeleton-line w-full" style="height:10px"></div></div>`;
        dropdown.style.display = 'block';
        const suggestions = await getDrugSuggestions(val);
        if (input.value.trim() !== val) return;
        showItems(suggestions);
      }, 320);
    });

    input.addEventListener('keydown', e => {
      if (dropdown.style.display === 'none') return;
      const items = dropdown.querySelectorAll('.autocomplete-item');
      const current = dropdown.querySelector('[aria-selected="true"]');
      let idx = [...items].indexOf(current);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx+1)%items.length; items.forEach((it,i) => it.setAttribute('aria-selected', i===idx)); items[idx]?.scrollIntoView({block:'nearest'}); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx-1+items.length)%items.length; items.forEach((it,i) => it.setAttribute('aria-selected', i===idx)); items[idx]?.scrollIntoView({block:'nearest'}); }
      else if (e.key === 'Enter' && current) { e.preventDefault(); current.click(); }
      else if (e.key === 'Escape') closeDropdown();
    });

    input.addEventListener('blur', () => setTimeout(closeDropdown, 200));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) { errorEl.textContent = 'Please enter a drug name.'; errorEl.classList.add('visible'); return; }
      const drug = selectedDrug.name === name ? selectedDrug : { name, rxcui: null };
      showScreen('single-drug-results-screen');
      document.getElementById('disclaimer-banner').classList.remove('hidden');
      runSingleDrugLookup(drug, singlePanelsContainer).catch(err => {
        console.error(err);
        showToast('An unexpected error occurred. Please try again.', 'error');
      });
    });

    // expose a prefill+submit helper
    singleFormContainer._prefillAndSubmit = (drugName) => {
      input.value = drugName;
      input.classList.add('has-value');
      selectedDrug = { name: drugName, rxcui: null };
      form.dispatchEvent(new Event('submit'));
    };
  }

  buildSingleDrugForm();

  /* --- Popular single-drug buttons --- */
  document.querySelectorAll('.popular-single-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      singleFormContainer._prefillAndSubmit(btn.dataset.drug);
    });
  });

  /* --- Offline detection --- */
  window.addEventListener('offline', () => showToast('You appear to be offline. Check your connection and try again.', 'error', 6000));
  window.addEventListener('online',  () => showToast('Connection restored.', 'success'));
});
