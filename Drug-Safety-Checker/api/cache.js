/**
 * SessionStorage cache for API results.
 * Key format: "{rxcui_a}:{rxcui_b}" — always sorted ascending to treat A+B = B+A.
 */

const PREFIX = 'drugsafe_';

function makeKey(id1, id2) {
  const [a, b] = [String(id1), String(id2)].sort();
  return `${PREFIX}${a}:${b}`;
}

export function cacheGet(id1, id2, namespace = '') {
  try {
    const key = makeKey(id1, id2) + (namespace ? `_${namespace}` : '');
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheSet(id1, id2, data, namespace = '') {
  try {
    const key = makeKey(id1, id2) + (namespace ? `_${namespace}` : '');
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Cache a single-drug lookup (e.g. RxNorm profile). */
export function drugCacheGet(name) {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}drug_${name.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function drugCacheSet(name, data) {
  try {
    sessionStorage.setItem(`${PREFIX}drug_${name.toLowerCase()}`, JSON.stringify(data));
  } catch {}
}
