/**
 * Drug name normalization utilities
 */

/**
 * Clean a user-supplied drug name for API queries.
 * Lowercases, trims, and strips most punctuation.
 */
export function normalizeDrugName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Capitalize the first letter of each word (title case).
 * Used for display purposes.
 */
export function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Truncate long text with an ellipsis.
 */
export function truncate(str, maxLen = 200) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

/**
 * Format a large number with commas.
 */
export function formatNumber(n) {
  if (n === null || n === undefined) return '–';
  return Number(n).toLocaleString();
}

/**
 * Format a date string like "20230101" → "Jan 1, 2023"
 */
export function formatFdaDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return dateStr;
  const y = dateStr.slice(0, 4);
  const m = parseInt(dateStr.slice(4, 6), 10) - 1;
  const d = parseInt(dateStr.slice(6, 8), 10);
  return new Date(y, m, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}
