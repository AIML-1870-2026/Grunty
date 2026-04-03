/**
 * openFDA API integration
 * Base: https://api.fda.gov
 * Auth: Optional key in localStorage (key: 'drugsafe_fda_key')
 * No key: 1,000 req/day | With key: 120,000 req/day
 */

import { cacheGet, cacheSet, drugCacheGet, drugCacheSet } from './cache.js';
import { normalizeDrugName } from '../utils/normalize.js';

const BASE = 'https://api.fda.gov';
const USAGE_KEY = 'drugsafe_fda_usage';
const USAGE_DATE_KEY = 'drugsafe_fda_usage_date';
const API_KEY_STORAGE = 'drugsafe_fda_key';

/* ---- API key & usage counter -------------------------------- */

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || null;
}

export function setApiKey(key) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

export function getUsage() {
  const today = new Date().toDateString();
  if (localStorage.getItem(USAGE_DATE_KEY) !== today) {
    localStorage.setItem(USAGE_DATE_KEY, today);
    localStorage.setItem(USAGE_KEY, '0');
  }
  return parseInt(localStorage.getItem(USAGE_KEY) || '0', 10);
}

function incrementUsage() {
  const current = getUsage();
  localStorage.setItem(USAGE_KEY, String(current + 1));
}

function buildUrl(endpoint, params) {
  const key = getApiKey();
  const qParams = new URLSearchParams(params);
  if (key) qParams.set('api_key', key);
  return `${BASE}${endpoint}?${qParams.toString()}`;
}

async function fetchFDA(endpoint, params, timeout = 8000) {
  const url = buildUrl(endpoint, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    incrementUsage();
    if (res.status === 429) throw Object.assign(new Error('Rate limit'), { code: 'rate_limit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json(), url };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ---- Drug Label (openFDA /drug/label) ----------------------- */

/**
 * Get FDA drug label sections for a drug name.
 * Returns { interactions, warnings, contraindications, brandName, effectiveTime, labelUrl }
 */
export async function getDrugLabel(drugName) {
  const name = normalizeDrugName(drugName);
  const cached = drugCacheGet(`label_${name}`);
  if (cached) return cached;

  let result = null;
  let lastUrl = '';

  // Try generic name first, then brand
  for (const field of ['openfda.generic_name', 'openfda.brand_name']) {
    try {
      const { data, url } = await fetchFDA('/drug/label.json', {
        search: `${field}:"${name}"`,
        limit: '1',
      });
      lastUrl = url;
      const r = data?.results?.[0];
      if (r) {
        result = {
          interactions: r.drug_interactions?.[0] || null,
          warnings: r.warnings_and_cautions?.[0] || r.warnings?.[0] || null,
          contraindications: r.contraindications?.[0] || null,
          adverseReactions: r.adverse_reactions?.[0] || null,
          brandName: r.openfda?.brand_name?.[0] || null,
          genericName: r.openfda?.generic_name?.[0] || drugName,
          effectiveTime: r.effective_time || null,
          setId: r.set_id || null,
          labelUrl: r.set_id
            ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.set_id}`
            : null,
          _sourceUrl: url,
        };
        break;
      }
    } catch {}
  }

  if (result) drugCacheSet(`label_${name}`, result);
  return result;
}

/* ---- FAERS Adverse Events (/drug/event) ---------------------- */

/**
 * Get co-reported adverse event count + top reactions for two drugs.
 */
export async function getFaersReactions(drugA, drugB) {
  const a = normalizeDrugName(drugA);
  const b = normalizeDrugName(drugB);
  const cached = cacheGet(a, b, 'faers_reactions');
  if (cached !== null) return cached;

  const search = `patient.drug.openfda.generic_name:"${a}"+AND+patient.drug.openfda.generic_name:"${b}"`;
  let result = { total: 0, reactions: [], url: '' };

  try {
    const { data, url } = await fetchFDA('/drug/event.json', {
      search,
      count: 'patient.reaction.reactionmeddrapt.exact',
      limit: '10',
    });
    result.reactions = data?.results || [];
    result.url = url;
  } catch {}

  // Get total count
  try {
    const { data } = await fetchFDA('/drug/event.json', {
      search,
      limit: '1',
    });
    result.total = data?.meta?.results?.total || 0;
  } catch {}

  cacheSet(a, b, result, 'faers_reactions');
  return result;
}

/**
 * Get serious outcome breakdown (hospitalization, death, etc.)
 */
export async function getFaersSerious(drugA, drugB) {
  const a = normalizeDrugName(drugA);
  const b = normalizeDrugName(drugB);
  const cached = cacheGet(a, b, 'faers_serious');
  if (cached !== null) return cached;

  const search = `patient.drug.openfda.generic_name:"${a}"+AND+patient.drug.openfda.generic_name:"${b}"`;
  let result = { outcomes: [], url: '' };

  try {
    const { data, url } = await fetchFDA('/drug/event.json', {
      search,
      count: 'patient.reaction.reactionmeddrapt.exact',
      limit: '5',
    });
    result.outcomes = data?.results || [];
    result.url = url;
  } catch {}

  // Serious vs non-serious
  try {
    const { data } = await fetchFDA('/drug/event.json', {
      search: search + '+AND+serious:1',
      limit: '1',
    });
    result.seriousCount = data?.meta?.results?.total || 0;
  } catch {}

  cacheSet(a, b, result, 'faers_serious');
  return result;
}

/**
 * Get reports-over-time (quarterly) for the past 5 years.
 */
export async function getFaersTimeSeries(drugA, drugB) {
  const a = normalizeDrugName(drugA);
  const b = normalizeDrugName(drugB);
  const cached = cacheGet(a, b, 'faers_time');
  if (cached !== null) return cached;

  const search = `patient.drug.openfda.generic_name:"${a}"+AND+patient.drug.openfda.generic_name:"${b}"`;
  let result = { points: [], url: '' };

  try {
    const { data, url } = await fetchFDA('/drug/event.json', {
      search,
      count: 'receivedate',
      limit: '20',
    });
    result.points = data?.results || [];
    result.url = url;
  } catch {}

  cacheSet(a, b, result, 'faers_time');
  return result;
}

/* ---- Single-drug adverse events from FAERS ------------------- */

/**
 * Get top adverse reactions reported for a single drug in FAERS.
 * Returns { reactions: [{term, count}], total, url }
 */
export async function getSingleDrugAdverseEvents(drugName) {
  const name = normalizeDrugName(drugName);
  const cached = drugCacheGet(`faers_single_${name}`);
  if (cached !== null) return cached;

  const search = `patient.drug.openfda.generic_name:"${name}"`;
  let result = { reactions: [], total: 0, url: '' };

  try {
    const { data, url } = await fetchFDA('/drug/event.json', {
      search,
      count: 'patient.reaction.reactionmeddrapt.exact',
      limit: '15',
    });
    result.reactions = data?.results || [];
    result.url = url;
  } catch {}

  try {
    const { data } = await fetchFDA('/drug/event.json', { search, limit: '1' });
    result.total = data?.meta?.results?.total || 0;
  } catch {}

  drugCacheSet(`faers_single_${name}`, result);
  return result;
}

/* ---- Drug Enforcement / Recalls (/drug/enforcement) --------- */

/**
 * Get active recalls for a drug name.
 */
export async function getDrugRecalls(drugName) {
  const name = normalizeDrugName(drugName);
  const cached = drugCacheGet(`recalls_${name}`);
  if (cached !== null) return cached;

  let result = { recalls: [], url: '' };

  try {
    const { data, url } = await fetchFDA('/drug/enforcement.json', {
      search: `product_description:"${name}"+AND+status:"Ongoing"`,
      limit: '5',
    });
    result.recalls = data?.results || [];
    result.url = url;
  } catch {
    // Try without status filter
    try {
      const { data, url } = await fetchFDA('/drug/enforcement.json', {
        search: `product_description:"${name}"`,
        limit: '3',
      });
      result.recalls = (data?.results || []).filter(r => r.status === 'Ongoing').slice(0, 3);
      result.url = url;
    } catch {}
  }

  drugCacheSet(`recalls_${name}`, result);
  return result;
}
