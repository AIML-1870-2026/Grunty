/**
 * HelpSystem — Help buttons with educational popovers
 *
 * Usage:
 *   import { createHelpBtn, HELP } from './HelpSystem.js';
 *   const btn = createHelpBtn(HELP.ddinter);
 *   headerEl.appendChild(btn);
 */

/* ============================================================
   Educational content dictionary
   ============================================================ */
export const HELP = {
  ddinter: {
    title: 'About DDinter 2.0',
    body: `
      <p><strong>DDinter 2.0</strong> is a curated database of 302,516 drug-drug interaction (DDI) records covering 2,310 drugs, maintained by the Shanghai Center for Bioinformation Technology.</p>
      <h4>Severity stars explained</h4>
      <div class="help-stars-legend">
        <div class="help-legend-row"><span class="help-star-badge minor">★</span> <span><strong>1–2 stars — Minor:</strong> Minimal clinical effect. Standard monitoring is usually sufficient.</span></div>
        <div class="help-legend-row"><span class="help-star-badge moderate">★★★</span> <span><strong>3 stars — Moderate:</strong> May need dose adjustment or more frequent monitoring.</span></div>
        <div class="help-legend-row"><span class="help-star-badge major">★★★★★</span> <span><strong>4–5 stars — Major/Contraindicated:</strong> Serious risk. Combination should usually be avoided.</span></div>
      </div>
      <h4>Interaction types</h4>
      <ul>
        <li><strong>Pharmacokinetic</strong> — One drug changes how the body absorbs, distributes, or eliminates the other (e.g. one drug raises or lowers levels of the other).</li>
        <li><strong>Pharmacodynamic</strong> — Both drugs act on the same biological pathway, causing additive, synergistic, or opposing effects.</li>
        <li><strong>Mixed</strong> — Both mechanisms are involved.</li>
      </ul>
    `,
  },

  adverse: {
    title: 'Understanding Adverse Effects Data',
    body: `
      <p>This panel compiles known side effects for each drug <em>individually</em> from two sources:</p>
      <h4>FDA Drug Label</h4>
      <p>Lists adverse reactions observed in <strong>clinical trials</strong> and post-marketing surveillance, as reported in the official prescribing information. These are reactions the manufacturer is required to disclose. Frequency varies — some are common, others rare.</p>
      <h4>FAERS (Voluntary Reports)</h4>
      <p>The FDA's Adverse Event Reporting System contains <strong>voluntary reports</strong> from patients, doctors, and pharmacists. A high report count means more people mentioned that reaction — it does <strong>not</strong> prove the drug caused it.</p>
      <div class="help-callout help-callout-amber">
        <strong>Important:</strong> Seeing a side effect listed here does not mean you will experience it. Talk to your pharmacist about which adverse effects are most relevant to you personally.
      </div>
    `,
  },

  label: {
    title: 'Reading FDA Drug Labels',
    body: `
      <p>The FDA requires manufacturers to include specific safety sections in every drug's prescribing information. Here's what each section means:</p>
      <ul>
        <li><strong>Drug Interactions</strong> — Other medications that may alter this drug's effectiveness or safety.</li>
        <li><strong>Warnings & Precautions</strong> — Serious risks that require monitoring or special care, but don't necessarily make the drug prohibited.</li>
        <li><strong>Contraindications</strong> — Conditions or combinations where the drug must <em>not</em> be used. These are absolute restrictions.</li>
      </ul>
      <div class="help-callout help-callout-blue">
        Label text is written for healthcare professionals and can be dense. If something is unclear, ask your pharmacist — it's their specialty.
      </div>
    `,
  },

  faers: {
    title: 'About FAERS & Co-Reported Events',
    body: `
      <p><strong>FAERS</strong> (FDA Adverse Event Reporting System) is a database of voluntary safety reports submitted to the FDA by patients, doctors, pharmacists, and manufacturers.</p>
      <h4>What "co-reported" means</h4>
      <p>This panel shows events from reports where <strong>both drugs appear together</strong> in the same patient case — meaning the reporter listed both drugs the patient was taking. This is a signal, not proof of causation.</p>
      <h4>Key limitations to understand</h4>
      <ul>
        <li><strong>Voluntary reporting</strong> — Only a fraction of adverse events are ever reported. True numbers in the real world are higher.</li>
        <li><strong>No causation established</strong> — The drug combination may not have caused the event. Other factors (patient health, other drugs) aren't controlled for.</li>
        <li><strong>Duplicate reports</strong> — The same event may be filed multiple times by different reporters.</li>
      </ul>
      <div class="help-callout help-callout-amber">
        A high FAERS count for a combination is a reason to be cautious and ask questions — not to panic.
      </div>
    `,
  },

  recalls: {
    title: 'FDA Recall Classifications',
    body: `
      <p>The FDA classifies recalls into three classes based on the level of risk to consumers:</p>
      <div class="help-recall-grid">
        <div class="help-recall-item class-i">
          <strong>Class I</strong>
          <span>Most serious. Reasonable probability that using the product will cause serious adverse health consequences or death.</span>
        </div>
        <div class="help-recall-item class-ii">
          <strong>Class II</strong>
          <span>May cause temporary or medically reversible adverse health consequences. Remote probability of serious harm.</span>
        </div>
        <div class="help-recall-item class-iii">
          <strong>Class III</strong>
          <span>Unlikely to cause adverse health consequences. Often involves labeling or packaging issues.</span>
        </div>
      </div>
      <div class="help-callout help-callout-blue">
        If your medication is under recall, contact your pharmacist. Do not stop taking it without a plan — abruptly stopping some medications can be dangerous.
      </div>
    `,
  },

  profiles: {
    title: 'Understanding Drug Profile Data',
    body: `
      <p>Drug profile data is sourced from <strong>RxNorm</strong>, the National Library of Medicine's drug terminology system used across all U.S. healthcare systems.</p>
      <h4>Terms explained</h4>
      <ul>
        <li><strong>RxCUI</strong> — A unique numerical identifier assigned by NLM to each drug concept. Used to link records across databases.</li>
        <li><strong>Drug Class</strong> — The pharmacological category (e.g. "Beta-Adrenergic Blockers"). Drugs in the same class often have similar effects and interaction profiles.</li>
        <li><strong>Active Ingredients</strong> — The chemical(s) that produce the drug's effect. Generic and brand name versions share the same active ingredient.</li>
        <li><strong>Dosage Forms</strong> — How the drug is delivered: tablet, capsule, injection, patch, etc.</li>
      </ul>
    `,
  },
};

/* ============================================================
   Action guidance — shown below severity banner
   ============================================================ */
export const ACTION_GUIDANCE = {
  major: {
    cssClass: 'action-card-danger',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    heading: 'What to do — Major Interaction',
    steps: [
      { icon: '🚫', text: '<strong>Do not take both medications together</strong> without explicit guidance from your doctor or pharmacist.' },
      { icon: '📞', text: '<strong>Call your pharmacist now</strong> — they can review your full medication list and suggest alternatives or timing adjustments.' },
      { icon: '🩺', text: '<strong>Tell your prescribing doctor</strong> about all medications you\'re taking, including OTC drugs and supplements.' },
      { icon: '🚨', text: 'If you are already taking both and feel unwell, call <strong>Poison Control: 1-800-222-1222</strong> (US). For emergencies, call <strong>911</strong>.' },
      { icon: '⚠️', text: '<strong>Never stop a prescription medication abruptly</strong> without medical advice — stopping can sometimes be more dangerous than the interaction itself.' },
    ],
  },
  moderate: {
    cssClass: 'action-card-warn',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    heading: 'What to do — Moderate Interaction',
    steps: [
      { icon: '💊', text: '<strong>Talk to your pharmacist or doctor</strong> before taking both — they may adjust the dose, timing, or sequence.' },
      { icon: '👁️', text: '<strong>Monitor for symptoms</strong> such as dizziness, unusual bleeding, changes in heart rate, or any effects that seem abnormal.' },
      { icon: '📋', text: '<strong>Keep a medication list</strong> with doses and timing and share it with every healthcare provider you see.' },
      { icon: '⚠️', text: '<strong>Do not self-adjust doses</strong> or stop prescription medications without first consulting your doctor.' },
    ],
  },
  minor: {
    cssClass: 'action-card-info',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`,
    heading: 'Minor Interaction — Low Risk',
    steps: [
      { icon: '✅', text: 'This combination is generally considered <strong>safe to take together</strong> with standard precautions.' },
      { icon: '💬', text: '<strong>Mention it to your pharmacist</strong> at your next visit — they may have personalized advice based on your full health picture.' },
      { icon: '👀', text: 'If you notice any unexpected symptoms after starting both medications, report them to your healthcare provider.' },
    ],
  },
  safe: {
    cssClass: 'action-card-safe',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    heading: 'No Known Interaction Found',
    steps: [
      { icon: '✅', text: 'No clinically significant interaction was found across our data sources for this combination.' },
      { icon: '💬', text: 'Drug databases are not exhaustive. When in doubt, <strong>always confirm with your pharmacist</strong> — especially for new prescriptions.' },
      { icon: '📝', text: 'Individual factors like kidney/liver function, age, and other medications can affect safety even when no general interaction is known.' },
    ],
  },
  unknown: {
    cssClass: 'action-card-info',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
    heading: 'Interaction Status Unknown',
    steps: [
      { icon: '❓', text: 'No interaction record was found for this combination in the reviewed databases. This does <strong>not</strong> mean the combination is safe.' },
      { icon: '📞', text: '<strong>Consult your pharmacist</strong> — they have access to clinical resources beyond what\'s available in public databases.' },
      { icon: '📋', text: 'Share your complete medication list (including OTC drugs, vitamins, and supplements) with your prescriber at every appointment.' },
    ],
  },
};

/* ============================================================
   Help button factory
   ============================================================ */

let _activePopover = null;

/**
 * Create a help (?) button that shows an educational popover on click.
 * @param {Object} helpContent - An entry from HELP above
 * @returns {HTMLButtonElement}
 */
export function createHelpBtn(helpContent) {
  const btn = document.createElement('button');
  btn.className = 'help-btn';
  btn.setAttribute('aria-label', `Help: ${helpContent.title}`);
  btn.setAttribute('type', 'button');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (_activePopover) {
      _activePopover.remove();
      if (_activePopover._trigger === btn) { _activePopover = null; return; }
      _activePopover = null;
    }
    _showPopover(btn, helpContent);
  });

  return btn;
}

function _showPopover(triggerBtn, content) {
  const popover = document.createElement('div');
  popover.className = 'help-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.setAttribute('aria-label', content.title);
  popover.innerHTML = `
    <div class="help-popover-header">
      <h3 class="help-popover-title">${_esc(content.title)}</h3>
      <button class="help-popover-close" aria-label="Close help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="help-popover-body">${content.body}</div>
  `;

  document.body.appendChild(popover);
  popover._trigger = triggerBtn;
  _activePopover = popover;

  // Position near button
  _positionPopover(popover, triggerBtn);

  popover.querySelector('.help-popover-close').addEventListener('click', e => {
    e.stopPropagation();
    popover.remove();
    _activePopover = null;
  });

  // Close on outside click
  const onOutside = e => {
    if (!popover.contains(e.target) && e.target !== triggerBtn) {
      popover.remove();
      _activePopover = null;
      document.removeEventListener('click', onOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', onOutside), 0);

  // Close on Escape
  const onKey = e => {
    if (e.key === 'Escape') { popover.remove(); _activePopover = null; document.removeEventListener('keydown', onKey); triggerBtn.focus(); }
  };
  document.addEventListener('keydown', onKey);

  // Focus the close button for accessibility
  popover.querySelector('.help-popover-close').focus();
}

function _positionPopover(popover, btn) {
  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  popover.style.position = 'fixed';
  popover.style.zIndex   = '1000';

  // On mobile (<640px), show as bottom sheet
  if (vw < 640) {
    popover.classList.add('help-popover-sheet');
    return;
  }

  const pw = Math.min(360, vw - 32);
  popover.style.width = pw + 'px';

  // Horizontal: prefer to the left of button, else right
  let left = rect.right - pw;
  if (left < 12) left = rect.left;
  if (left + pw > vw - 12) left = vw - pw - 12;
  popover.style.left = left + 'px';

  // Vertical: prefer below, else above
  const gap = 8;
  const popHeight = 400; // estimate before render
  if (rect.bottom + gap + popHeight < vh) {
    popover.style.top = (rect.bottom + gap) + 'px';
  } else {
    popover.style.bottom = (vh - rect.top + gap) + 'px';
  }
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
