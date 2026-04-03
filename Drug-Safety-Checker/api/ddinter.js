/**
 * DDinter 2.0 API integration
 * Base: https://ddinter2.scbdd.com
 * Auth: None | 302,516 DDI records
 *
 * Note: DDinter 2.0 may not return CORS headers for direct browser requests.
 * If the call fails, we fall back gracefully to FDA label text analysis.
 */

import { cacheGet, cacheSet } from './cache.js';

const BASE = 'https://ddinter2.scbdd.com';

/**
 * Look up an interaction between two drugs.
 * @param {string} nameA - Canonical drug name
 * @param {string} nameB - Canonical drug name
 * @returns {Promise<DDinterResult|null>}
 *
 * @typedef {Object} DDinterResult
 * @property {number|null} severity        - 1–5 numeric severity
 * @property {string|null} severityLabel   - e.g. "Major"
 * @property {string|null} mechanism       - Plain-text mechanism
 * @property {string|null} management      - Clinical management guidance
 * @property {string|null} type            - "pharmacokinetic"|"pharmacodynamic"|"mixed"
 * @property {string[]}    references      - PubMed IDs
 * @property {string|null} url             - Link to DDinter record
 * @property {boolean}     fromCors        - false if CORS blocked
 */
export async function getDDinterInteraction(nameA, nameB) {
  const cached = cacheGet(nameA, nameB, 'ddinter');
  if (cached !== null) return cached;

  const result = await _tryDDinterFetch(nameA, nameB);
  cacheSet(nameA, nameB, result, 'ddinter');
  return result;
}

async function _tryDDinterFetch(nameA, nameB) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${BASE}/api/interaction/?drug_a=${encodeURIComponent(nameA)}&drug_b=${encodeURIComponent(nameB)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // DDinter may return an array or object
    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return null;

    return {
      severity: record.severity ?? record.level ?? null,
      severityLabel: record.severity_label ?? record.severity_name ?? null,
      mechanism: record.mechanism ?? record.description ?? null,
      management: record.management ?? record.recommendation ?? null,
      type: record.type ?? record.interaction_type ?? null,
      references: record.references ?? record.pubmed_ids ?? [],
      url: record.url ?? `${BASE}/ddi-detail/${nameA}/${nameB}/`,
      fromCors: true,
    };
  } catch (err) {
    clearTimeout(timer);
    // CORS or network failure — return sentinel so UI can show appropriate message
    return {
      severity: null,
      severityLabel: null,
      mechanism: null,
      management: null,
      type: null,
      references: [],
      url: `${BASE}/`,
      fromCors: false,
      error: err.name === 'AbortError' ? 'timeout' : 'cors',
    };
  }
}
