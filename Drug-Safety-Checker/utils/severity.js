/**
 * Severity classification utilities
 * Maps various source-specific severity values to our unified levels.
 */

/** @typedef {'safe'|'minor'|'moderate'|'major'|'unknown'} SeverityLevel */

/**
 * Map DDinter numeric severity (1–5) to our levels.
 */
export function fromDDinterSeverity(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return 'unknown';
  if (n <= 1) return 'minor';
  if (n === 2) return 'moderate';
  if (n >= 3) return 'major';
  return 'unknown';
}

/**
 * Map DDinter string severity labels.
 */
export function fromDDinterLabel(label) {
  if (!label) return 'unknown';
  const l = label.toLowerCase();
  if (l.includes('minor') || l.includes('low'))          return 'minor';
  if (l.includes('moderate') || l.includes('medium'))    return 'moderate';
  if (l.includes('major') || l.includes('severe') ||
      l.includes('contraindicated') || l.includes('high')) return 'major';
  return 'unknown';
}

/**
 * Derive a severity hint from FDA drug label text.
 * This is a best-effort heuristic — DDinter is the primary source.
 */
export function fromLabelText(text) {
  if (!text) return 'unknown';
  const l = text.toLowerCase();
  if (l.includes('contraindicated') || l.includes('avoid combination') ||
      l.includes('do not use'))                           return 'major';
  if (l.includes('serious') || l.includes('severe') ||
      l.includes('significant'))                          return 'moderate';
  if (l.includes('monitor') || l.includes('caution'))    return 'minor';
  if (l.includes('no known') || l.includes('no significant')) return 'safe';
  return 'unknown';
}

/**
 * Return display metadata for a severity level.
 */
export function getSeverityMeta(level) {
  const map = {
    safe: {
      label: 'No Known Interaction',
      description: 'No clinically significant drug-drug interaction found across reviewed data sources.',
      cssClass: 'safe',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    },
    minor: {
      label: 'Minor Interaction',
      description: 'Minimal clinical significance. Monitor as a general precaution.',
      cssClass: 'minor',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
    },
    moderate: {
      label: 'Moderate Interaction',
      description: 'May require dose adjustment or increased monitoring. Consult your pharmacist.',
      cssClass: 'moderate',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    },
    major: {
      label: 'Major Interaction',
      description: 'Clinically significant risk. This combination may require avoidance or close medical supervision.',
      cssClass: 'major',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    },
    unknown: {
      label: 'Interaction Status Unknown',
      description: 'No interaction record was found for this combination in the reviewed databases.',
      cssClass: 'unknown',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
    },
  };
  return map[level] || map.unknown;
}
