/**
 * RxNorm / RxNav API integration
 * Base: https://rxnav.nlm.nih.gov/REST
 * Auth: None required | Rate: 20 req/sec
 */

import { normalizeDrugName } from '../utils/normalize.js';
import { drugCacheGet, drugCacheSet } from './cache.js';

const BASE = 'https://rxnav.nlm.nih.gov/REST';

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a drug name to its RxCUI.
 * Returns { rxcui, name } or null.
 */
export async function resolveRxCui(rawName) {
  const name = normalizeDrugName(rawName);
  const cached = drugCacheGet(`rxcui_${name}`);
  if (cached) return cached;

  try {
    const data = await fetchJson(`${BASE}/rxcui.json?name=${encodeURIComponent(name)}&search=2`);
    const rxcui = data?.idGroup?.rxnormId?.[0];
    if (rxcui) {
      const result = { rxcui, name };
      drugCacheSet(`rxcui_${name}`, result);
      return result;
    }
  } catch {}

  // Fallback: try approximate search
  try {
    const data = await fetchJson(`${BASE}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`);
    const rxcui = data?.approximateGroup?.candidate?.[0]?.rxcui;
    const resolvedName = data?.approximateGroup?.candidate?.[0]?.name;
    if (rxcui) {
      const result = { rxcui, name: resolvedName || rawName };
      drugCacheSet(`rxcui_${name}`, result);
      return result;
    }
  } catch {}

  return null;
}

/**
 * Get spelling suggestions for autocomplete.
 * Returns array of suggestion strings.
 */
export async function getSpellingSuggestions(query) {
  if (query.length < 2) return [];
  try {
    const data = await fetchJson(
      `${BASE}/spellingsuggestions.json?name=${encodeURIComponent(query)}`,
      5000
    );
    return data?.suggestionGroup?.suggestionList?.suggestion || [];
  } catch {
    return [];
  }
}

/**
 * Get drug names matching a query, with RxCUIs.
 * Returns array of { name, rxcui, synonym }.
 */
export async function getDrugSuggestions(query) {
  if (query.length < 2) return [];
  try {
    const data = await fetchJson(
      `${BASE}/drugs.json?name=${encodeURIComponent(query)}`,
      5000
    );
    const conceptGroups = data?.drugGroup?.conceptGroup || [];
    const results = [];
    for (const group of conceptGroups) {
      const props = group.conceptProperties || [];
      for (const p of props) {
        if (p.rxcui && p.name) {
          results.push({ name: p.name, rxcui: p.rxcui, tty: group.tty });
        }
      }
    }
    // Deduplicate by name (case-insensitive), prioritize IN/SCD
    const seen = new Set();
    return results.filter(r => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Get full drug profile for a RxCUI.
 * Returns { rxcui, name, brandNames, forms, ingredients, drugClass }
 */
export async function getDrugProfile(rxcui, name) {
  const cacheKey = `profile_${rxcui}`;
  const cached = drugCacheGet(cacheKey);
  if (cached) return cached;

  const profile = { rxcui, name, brandNames: [], forms: [], ingredients: [], drugClass: null };

  // Get related concepts (brand names, dose forms)
  try {
    const data = await fetchJson(`${BASE}/rxcui/${rxcui}/related.json?tty=BN+SCD+SBD`);
    const groups = data?.relatedGroup?.conceptGroup || [];
    for (const g of groups) {
      const props = g.conceptProperties || [];
      if (g.tty === 'BN') {
        profile.brandNames = props.map(p => p.name).slice(0, 5);
      }
    }
  } catch {}

  // Get drug class
  try {
    const data = await fetchJson(`${BASE}/rxclass/class/byRxcui.json?rxcui=${rxcui}`);
    const classes = data?.rxclassDrugInfoList?.rxclassDrugInfo || [];
    const va = classes.find(c => c.rxclassMinConceptItem?.classType === 'VA');
    const epc = classes.find(c => c.rxclassMinConceptItem?.classType === 'EPC');
    profile.drugClass = (va || epc)?.rxclassMinConceptItem?.className || null;
  } catch {}

  // Get allRelated for ingredients/forms
  try {
    const data = await fetchJson(`${BASE}/rxcui/${rxcui}/allRelatedInfo.json`);
    const groups = data?.allRelatedGroup?.conceptGroup || [];
    for (const g of groups) {
      const props = g.conceptProperties || [];
      if (g.tty === 'IN') {
        profile.ingredients = props.map(p => p.name).slice(0, 5);
      } else if (g.tty === 'DF') {
        profile.forms = props.map(p => p.name).slice(0, 6);
      }
    }
  } catch {}

  drugCacheSet(cacheKey, profile);
  return profile;
}
