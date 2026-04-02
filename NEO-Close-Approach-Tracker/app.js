/* ===== CONFIG ===== */
// Get a free key at https://api.nasa.gov/
const CONFIG = {
  NASA_API_KEY: 'eBGyNLvjH7pQPglSgsRjq3z4PmuETmY5HGv2xOGJ',
  NEOWS_BASE:   'https://api.nasa.gov/neo/rest/v1/feed',
  SBDB_BASE:    'https://ssd-api.jpl.nasa.gov/cad.api',
  SENTRY_BASE:  'https://ssd-api.jpl.nasa.gov/sentry.api',
  FETCH_TIMEOUT_MS: 10000,
  CACHE_TTL_MS:     5 * 60 * 1000, // 5 minutes
  DEBOUNCE_MS:      500,
};

/* ===== STATE ===== */
const state = {
  filters: {
    days: 7,
    distMax: 0.05,
    hazardousOnly: false,
  },
  data: {
    neows: [],
    sbdb: [],
    sentry: {},
  },
  merged: [],
  sortBy: 'date',
  sortDir: 'asc',
  selectedObject: null,
  loadingState: {
    neows: 'idle',
    sbdb: 'idle',
    sentry: 'idle',
  },
};

/* ===== UTILITIES ===== */
function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(str) {
  // Handles both "2026-04-01" and "2026-Apr-01 00:00"
  if (!str) return '—';
  const d = new Date(str.replace(/-([A-Za-z]{3})-/, (_, m) => {
    const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                     Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    return `-${months[m]}-`;
  }));
  if (isNaN(d)) return str;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function fmtNum(val, decimals = 4) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toFixed(decimals);
}

function fmtSci(val) {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n < 0.001) return n.toExponential(2);
  return (n * 100).toFixed(4) + '%';
}

function psLevel(ps) {
  const v = parseFloat(ps);
  if (isNaN(v)) return 'safe';
  if (v > 0) return 'danger';
  if (v >= -2) return 'watch';
  return 'safe';
}

function cacheKey(name) { return `neo_tracker_${name}`; }

function saveCache(name, data) {
  try {
    sessionStorage.setItem(cacheKey(name), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

function loadCache(name) {
  try {
    const raw = sessionStorage.getItem(cacheKey(name));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CONFIG.CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      if (res.status === 429) throw new Error(`Rate limit reached (429) — try again later`);
      if (res.status === 403) throw new Error(`API key missing or invalid (403)`);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out after 10s');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ===== API LAYER ===== */
async function fetchNeoWs(filters) {
  const cached = loadCache(`neows_${filters.days}`);
  if (cached) return cached;

  const params = new URLSearchParams({
    start_date: toISODate(new Date()),
    end_date:   toISODate(daysFromNow(filters.days)),
    api_key:    CONFIG.NASA_API_KEY,
  });

  const json = await fetchWithTimeout(`${CONFIG.NEOWS_BASE}?${params}`);
  const objects = json.near_earth_objects || {};

  // Flatten date-keyed structure into a single array of close-approach records
  const result = [];
  for (const [date, asteroids] of Object.entries(objects)) {
    for (const ast of asteroids) {
      for (const ca of ast.close_approach_data) {
        result.push({
          id:         ast.id,
          name:       ast.name,
          jpl_url:    ast.nasa_jpl_url,
          h:          ast.absolute_magnitude_h,
          is_pha:     ast.is_potentially_hazardous_asteroid,
          diam_min:   ast.estimated_diameter?.kilometers?.estimated_diameter_min,
          diam_max:   ast.estimated_diameter?.kilometers?.estimated_diameter_max,
          date:       ca.close_approach_date,
          epoch:      ca.epoch_date_close_approach,
          velocity:   parseFloat(ca.relative_velocity?.kilometers_per_second),
          dist_au:    parseFloat(ca.miss_distance?.astronomical),
          dist_ld:    parseFloat(ca.miss_distance?.lunar),
          dist_km:    parseFloat(ca.miss_distance?.kilometers),
          source:     'neows',
        });
      }
    }
  }

  saveCache(`neows_${filters.days}`, result);
  return result;
}

async function fetchSBDB(filters) {
  const cacheTag = `sbdb_${filters.days}_${filters.distMax}`;
  const cached = loadCache(cacheTag);
  if (cached) return cached;

  const params = new URLSearchParams({
    'date-min': toISODate(new Date()),
    'date-max': toISODate(daysFromNow(Math.max(filters.days, 30))),
    'dist-max': filters.distMax,
    'sort':     'date',
    'neo':      '1',
  });

  const json = await fetchWithTimeout(`${CONFIG.SBDB_BASE}?${params}`);
  const fields = json.fields || [];

  const result = (json.data || []).map(row =>
    Object.fromEntries(fields.map((f, i) => [f, row[i]]))
  );

  saveCache(cacheTag, result);
  return result;
}

async function fetchSentry() {
  const cached = loadCache('sentry');
  if (cached) return cached;

  const json = await fetchWithTimeout(`${CONFIG.SENTRY_BASE}?all=1`);
  const result = json.data || [];

  saveCache('sentry', result);
  return result;
}

/* ===== MERGE LOGIC ===== */
function mergeData() {
  const { neows, sbdb, sentry } = state.data;

  // Build SBDB lookup by designation (des)
  const sbdbMap = new Map();
  for (const row of sbdb) {
    if (row.des) sbdbMap.set(row.des.trim(), row);
  }

  const rows = neows.map(neo => {
    // Try to find matching SBDB record by stripping parens and spaces
    const desRaw = neo.name.replace(/[()]/g, '').trim();
    const sbdbRecord = sbdbMap.get(desRaw) || null;

    const dist_au = sbdbRecord
      ? parseFloat(sbdbRecord.dist)
      : neo.dist_au;

    const velocity = sbdbRecord
      ? parseFloat(sbdbRecord.v_rel)
      : neo.velocity;

    const magnitude = sbdbRecord
      ? parseFloat(sbdbRecord.h)
      : neo.h;

    // Sentry lookup — try designation variations
    const sentryRecord = sentry[desRaw] || sentry[neo.name] || null;

    return {
      ...neo,
      dist_au,
      velocity,
      magnitude,
      sbdb: sbdbRecord,
      sentry: sentryRecord,
    };
  });

  // Apply filters
  let filtered = rows;

  if (state.filters.hazardousOnly) {
    filtered = filtered.filter(r => r.is_pha);
  }

  if (state.filters.distMax) {
    filtered = filtered.filter(r => !isNaN(r.dist_au) && r.dist_au <= state.filters.distMax);
  }

  // Sort
  filtered.sort((a, b) => {
    let va = a[state.sortBy];
    let vb = b[state.sortBy];
    if (state.sortBy === 'date') { va = a.epoch; vb = b.epoch; }
    if (state.sortBy === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
    if (typeof va === 'string') return state.sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    const diff = (va ?? Infinity) - (vb ?? Infinity);
    return state.sortDir === 'asc' ? diff : -diff;
  });

  state.merged = filtered;

  // Push to 3D visualization
  if (typeof Viz !== 'undefined') Viz.updateNEOs(filtered);
}

/* ===== UI: STATUS ===== */
function renderStatus() {
  for (const [api, status] of Object.entries(state.loadingState)) {
    const el = document.getElementById(`status-${api}`);
    if (el) el.dataset.state = status;
  }
}

/* ===== UI: TABLE ===== */
function renderTable() {
  const tbody = document.getElementById('approaches-tbody');
  const countEl = document.getElementById('approach-count');
  if (!tbody) return;

  if (state.merged.length === 0) {
    const hasError = Object.values(state.loadingState).some(s => s === 'error');
    if (!hasError) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No close approaches found for this time window.</td></tr>`;
    }
    if (countEl) countEl.textContent = '0';
    return;
  }

  if (countEl) countEl.textContent = state.merged.length;

  tbody.innerHTML = state.merged.map((row, i) => {
    const classes = [
      row.is_pha  ? 'row--hazardous' : '',
      row.sentry  ? 'row--sentry' : '',
    ].filter(Boolean).join(' ');

    const diamStr = (row.diam_min != null && row.diam_max != null)
      ? `${fmtNum(row.diam_min, 2)}–${fmtNum(row.diam_max, 2)}`
      : '—';

    return `<tr class="${classes}" data-index="${i}" tabindex="0" role="button" aria-label="View details for ${escHtml(row.name)}">
      <td class="col-name"><a href="${escHtml(row.jpl_url || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escHtml(row.name)}</a></td>
      <td>${formatDate(row.date)}</td>
      <td>${fmtNum(row.dist_au, 5)}</td>
      <td>${fmtNum(row.dist_ld, 2)}</td>
      <td>${fmtNum(row.velocity, 2)}</td>
      <td>${diamStr}</td>
      <td>${fmtNum(row.magnitude, 1)}</td>
      <td>${row.is_pha  ? '<span class="badge badge--pha">⚠ PHA</span>' : '—'}</td>
      <td>${row.sentry ? '<span class="badge badge--sentry">🔴 Risk</span>' : '—'}</td>
    </tr>`;
  }).join('');

  // Row click handlers
  tbody.querySelectorAll('tr[data-index]').forEach(tr => {
    tr.addEventListener('click', () => openDetail(parseInt(tr.dataset.index)));
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(parseInt(tr.dataset.index));
      }
    });
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== UI: SENTRY PANEL ===== */
function renderSentry() {
  const list = document.getElementById('sentry-list');
  const countEl = document.getElementById('sentry-count');
  if (!list) return;

  const entries = Object.values(state.data.sentry);

  if (state.loadingState.sentry === 'error') {
    list.innerHTML = '<p class="sentry-empty">Sentry data unavailable.</p>';
    return;
  }

  if (entries.length === 0) {
    list.innerHTML = '<p class="sentry-empty">No Sentry objects loaded yet.</p>';
    return;
  }

  // Sort by ps_cum descending (most hazardous first)
  const sorted = [...entries].sort((a, b) => parseFloat(b.ps_cum) - parseFloat(a.ps_cum));
  if (countEl) countEl.textContent = sorted.length;

  list.innerHTML = sorted.map(obj => {
    const level = psLevel(obj.ps_cum);
    const label = obj.name ? `${obj.name} (${obj.des})` : obj.des;
    return `<div class="sentry-card">
      <div class="sentry-card__name">${escHtml(label)}</div>
      <div class="sentry-card__row"><span>Impact prob.</span><span>${fmtSci(obj.ip)}</span></div>
      <div class="sentry-card__row"><span>Palermo Scale</span><span class="ps-value" data-level="${level}">${fmtNum(obj.ps_cum, 2)}</span></div>
      <div class="sentry-card__row"><span>Diameter</span><span>${obj.diameter ? fmtNum(obj.diameter, 2) + ' km' : '—'}</span></div>
      <div class="sentry-card__row"><span>Impact years</span><span>${escHtml(obj.range || '—')}</span></div>
      <div class="sentry-card__row"><span>Solutions</span><span>${escHtml(obj.n_imp || '—')}</span></div>
    </div>`;
  }).join('');
}

/* ===== UI: DETAIL PANEL ===== */
let previousFocus = null;

function openDetail(index) {
  const row = state.merged[index];
  if (!row) return;
  state.selectedObject = row;

  previousFocus = document.activeElement;
  renderDetail(row);

  const overlay = document.getElementById('detail-overlay');
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');

  // Trap focus
  const closeBtn = document.getElementById('detail-close');
  closeBtn?.focus();
}

function closeDetail() {
  const overlay = document.getElementById('detail-overlay');
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  state.selectedObject = null;
  previousFocus?.focus();
}

function renderDetail(row) {
  const content = document.getElementById('detail-content');
  if (!content) return;

  const sbdb = row.sbdb;
  const sentry = row.sentry;

  const diamStr = (row.diam_min != null && row.diam_max != null)
    ? `${fmtNum(row.diam_min, 3)} – ${fmtNum(row.diam_max, 3)} km`
    : '—';

  const distKm = row.dist_km
    ? Number(row.dist_km).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km'
    : '—';

  let html = `
    <h2 class="detail-title" id="detail-title">${escHtml(row.name)}</h2>
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-field__label">Close Approach Date</span>
        <span class="detail-field__value">${formatDate(row.date)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Miss Distance (AU)</span>
        <span class="detail-field__value">${fmtNum(row.dist_au, 6)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Miss Distance (LD)</span>
        <span class="detail-field__value">${fmtNum(row.dist_ld, 2)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Miss Distance (km)</span>
        <span class="detail-field__value">${distKm}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Relative Velocity</span>
        <span class="detail-field__value">${fmtNum(row.velocity, 3)} km/s</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Est. Diameter</span>
        <span class="detail-field__value">${diamStr}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Absolute Magnitude (H)</span>
        <span class="detail-field__value">${fmtNum(row.magnitude, 1)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field__label">Potentially Hazardous</span>
        <span class="detail-field__value">${row.is_pha ? '⚠ Yes' : 'No'}</span>
      </div>
    </div>`;

  if (sentry) {
    const level = psLevel(sentry.ps_cum);
    html += `
      <h3 class="detail-section-title">⚠ Sentry Impact Risk Data</h3>
      <div class="detail-grid">
        <div class="detail-field">
          <span class="detail-field__label">Impact Probability</span>
          <span class="detail-field__value">${fmtSci(sentry.ip)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field__label">Palermo Scale</span>
          <span class="detail-field__value ps-value" data-level="${level}">${fmtNum(sentry.ps_cum, 2)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field__label">Impact Year Range</span>
          <span class="detail-field__value">${escHtml(sentry.range || '—')}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field__label">Impact Solutions</span>
          <span class="detail-field__value">${escHtml(sentry.n_imp || '—')}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field__label">Diameter</span>
          <span class="detail-field__value">${sentry.diameter ? fmtNum(sentry.diameter, 2) + ' km' : '—'}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field__label">V∞ (km/s)</span>
          <span class="detail-field__value">${fmtNum(sentry.v_inf, 2)}</span>
        </div>
      </div>`;
  }

  if (row.jpl_url) {
    html += `<a class="detail-link" href="${escHtml(row.jpl_url)}" target="_blank" rel="noopener">
      View on NASA JPL SBDB →
    </a>`;
  }

  content.innerHTML = html;
}

/* ===== UI: ERROR BANNERS ===== */
function showTableError(msg) {
  const tbody = document.getElementById('approaches-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr class="error-row"><td colspan="9">
    <div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;">
      <span>⚠ ${escHtml(msg)}</span>
      <button onclick="init()" style="background:none;border:1px solid var(--accent-red);color:var(--accent-red);padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer;">Retry</button>
    </div>
  </td></tr>`;
}

function showSentryError(msg) {
  const list = document.getElementById('sentry-list');
  if (!list) return;
  list.innerHTML = `<div class="error-banner"><span>⚠ ${escHtml(msg)}</span>
    <button onclick="init()">Retry</button></div>`;
}

/* ===== UI: COLUMN SORT ===== */
function initSortHeaders() {
  document.querySelectorAll('thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortBy === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = col;
        state.sortDir = 'asc';
      }
      updateSortHeaders();
      mergeData();
      renderTable();
    });

    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); }
    });
  });
}

function updateSortHeaders() {
  document.querySelectorAll('thead th[data-col]').forEach(th => {
    const col = th.dataset.col;
    if (col === state.sortBy) {
      th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.setAttribute('aria-sort', 'none');
    }
  });
}

/* ===== UI: FILTERS ===== */
function initFilters() {
  const daysEl  = document.getElementById('filter-days');
  const distEl  = document.getElementById('filter-dist');
  const hazEl   = document.getElementById('filter-hazardous');
  const btnEl   = document.getElementById('btn-refresh');

  daysEl?.addEventListener('change', () => {
    state.filters.days = parseInt(daysEl.value);
    refreshNeows();
  });

  const onDistChange = debounce(() => {
    const val = parseFloat(distEl.value);
    if (!isNaN(val) && val > 0) {
      state.filters.distMax = val;
      refreshSbdb();
    }
  }, CONFIG.DEBOUNCE_MS);

  distEl?.addEventListener('input', onDistChange);

  hazEl?.addEventListener('change', () => {
    state.filters.hazardousOnly = hazEl.checked;
    mergeData();
    renderTable();
  });

  btnEl?.addEventListener('click', init);
}

async function refreshNeows() {
  setLoading('neows', true);
  try {
    state.data.neows = await fetchNeoWs(state.filters);
    state.loadingState.neows = 'success';
  } catch (err) {
    state.loadingState.neows = 'error';
    showTableError(`NeoWs: ${err.message}`);
  }
  renderStatus();
  mergeData();
  renderTable();
  updateLastUpdated();
}

async function refreshSbdb() {
  setLoading('sbdb', true);
  try {
    state.data.sbdb = await fetchSBDB(state.filters);
    state.loadingState.sbdb = 'success';
  } catch (err) {
    state.loadingState.sbdb = 'error';
  }
  renderStatus();
  mergeData();
  renderTable();
}

function setLoading(api, loading) {
  state.loadingState[api] = loading ? 'loading' : state.loadingState[api];
  renderStatus();
  if (loading) {
    const icon = document.getElementById('refresh-icon');
    icon?.classList.add('spinning');
    const btn = document.getElementById('btn-refresh');
    if (btn) btn.disabled = true;
  }
}

function setLoadingDone() {
  const icon = document.getElementById('refresh-icon');
  icon?.classList.remove('spinning');
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.disabled = false;
}

function updateLastUpdated() {
  const el = document.getElementById('last-updated');
  if (el) el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

/* ===== INIT ===== */
async function init() {
  // Reset loading states
  state.loadingState = { neows: 'loading', sbdb: 'loading', sentry: 'loading' };
  renderStatus();

  const icon = document.getElementById('refresh-icon');
  icon?.classList.add('spinning');
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.disabled = true;

  // Show loading state in table
  const tbody = document.getElementById('approaches-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="9">
      <div class="loading-spinner"></div>
      <span>Fetching close approach data…</span>
    </td></tr>`;
  }

  // Fetch all three APIs in parallel
  const [neowsResult, sbdbResult, sentryResult] = await Promise.allSettled([
    fetchNeoWs(state.filters),
    fetchSBDB(state.filters),
    fetchSentry(),
  ]);

  // NeoWs
  if (neowsResult.status === 'fulfilled') {
    state.data.neows = neowsResult.value;
    state.loadingState.neows = 'success';
  } else {
    state.data.neows = [];
    state.loadingState.neows = 'error';
    showTableError(`NeoWs failed: ${neowsResult.reason?.message}`);
  }

  // SBDB
  if (sbdbResult.status === 'fulfilled') {
    state.data.sbdb = sbdbResult.value;
    state.loadingState.sbdb = 'success';
  } else {
    state.data.sbdb = [];
    state.loadingState.sbdb = 'error';
    // SBDB failure is non-fatal — NeoWs data still renders
  }

  // Sentry — convert array to lookup map by designation
  if (sentryResult.status === 'fulfilled') {
    state.data.sentry = {};
    for (const obj of sentryResult.value) {
      if (obj.des) state.data.sentry[obj.des.trim()] = obj;
      if (obj.name) state.data.sentry[obj.name.trim()] = obj;
    }
    state.loadingState.sentry = 'success';
  } else {
    state.data.sentry = {};
    state.loadingState.sentry = 'error';
    showSentryError(`Sentry failed: ${sentryResult.reason?.message}`);
  }

  renderStatus();
  mergeData();
  renderTable();
  renderSentry();
  updateLastUpdated();
  setLoadingDone();
}

/* ===== DETAIL PANEL EVENT LISTENERS ===== */
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initSortHeaders();

  // Init 3D Earth visualization — defer one frame to ensure container is laid out
  const vizEl = document.getElementById('earth-viz');
  if (vizEl) {
    requestAnimationFrame(() => {
      if (typeof THREE === 'undefined') {
        vizEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding-top:5rem;font-size:0.85rem;">3D view requires internet access to load Three.js</p>';
        return;
      }
      try {
        Viz.init(vizEl);
      } catch (e) {
        console.error('Viz init error:', e);
        vizEl.innerHTML = `<p style="color:var(--accent-red);text-align:center;padding-top:5rem;font-size:0.82rem;padding-left:1rem;padding-right:1rem;">3D error: ${e.message}</p>`;
      }
    });
  }

  const overlay = document.getElementById('detail-overlay');
  const closeBtn = document.getElementById('detail-close');

  closeBtn?.addEventListener('click', closeDetail);

  overlay?.addEventListener('click', e => {
    if (e.target === overlay) closeDetail();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.selectedObject) closeDetail();
  });

  // Focus trap inside detail panel
  const panel = document.getElementById('detail-panel');
  panel?.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = panel.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  init();
});
