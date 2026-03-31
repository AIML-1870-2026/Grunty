/* ===== State ===== */
let currentUnit = 'F';
let currentData = null; // { current, forecast }
const RECENT_KEY = 'wx_recent';
const MAX_RECENT = 5;

/* ===== DOM Refs ===== */
const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const searchBar    = document.getElementById('search-bar');
const errorMsg     = document.getElementById('error-msg');
const recentEl     = document.getElementById('recent-searches');
const mainContent  = document.getElementById('main-content');
const btnF         = document.getElementById('btn-f');
const btnC         = document.getElementById('btn-c');

/* ===== Init ===== */
// Show API key banner if no key is available
(function initApiKeyBanner() {
  const banner = document.getElementById('api-key-banner');
  const input  = document.getElementById('api-key-input');
  const saveBtn = document.getElementById('api-key-save-btn');

  if (!API_KEY) banner.classList.remove('hidden');

  saveBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) return;
    localStorage.setItem('wx_api_key', val);
    // eslint-disable-next-line no-global-assign
    API_KEY = val;
    banner.classList.add('hidden');
    input.value = '';
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
})();

renderRecent();

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

btnF.addEventListener('click', () => setUnit('F'));
btnC.addEventListener('click', () => setUnit('C'));

/* ===== Search ===== */
async function handleSearch() {
  const city = searchInput.value.trim();
  if (!city) {
    shakeSearch();
    return;
  }
  clearError();
  await fetchWeather(city);
}

async function fetchWeather(city) {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    showError('No API key set. Open config.js and replace YOUR_API_KEY_HERE with your OpenWeatherMap key.');
    return;
  }
  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=imperial`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=imperial`)
    ]);

    if (currentRes.status === 401 || forecastRes.status === 401) {
      showError('Invalid API key. Open config.js and replace YOUR_API_KEY_HERE with your OpenWeatherMap key.');
      return;
    }
    if (currentRes.status === 404 || forecastRes.status === 404) {
      showError('City not found. Please try again.');
      return;
    }
    if (currentRes.status === 429 || forecastRes.status === 429) {
      showError('Too many requests. Please wait a moment.');
      return;
    }
    if (!currentRes.ok || !forecastRes.ok) {
      showError(`Weather service error (${currentRes.status}). Please try again.`);
      return;
    }

    const current  = await currentRes.json();
    const forecast = await forecastRes.json();

    currentData = { current, forecast };
    currentUnit = 'F'; // data is always fetched in imperial
    syncUnitButtons();

    saveRecent(current.name + ', ' + current.sys.country);
    renderRecent();
    renderWeather();
    if (bgMode === 'auto') applyTheme(current);
    mainContent.classList.remove('hidden');
    searchInput.value = '';

    // AQI + comparison (non-blocking)
    fetchAndRenderAQI(current.coord.lat, current.coord.lon);
    syncPinButton();
    renderComparison();

  } catch (_) {
    showError('Unable to reach weather service. Check your connection.');
  }
}

/* ===== Render ===== */
function renderWeather() {
  if (!currentData) return;
  const { current, forecast } = currentData;

  // City & time
  document.getElementById('city-name').textContent =
    `${current.name}, ${current.sys.country}`;
  document.getElementById('local-time').textContent = localTime(current.timezone);

  // Condition
  const icon = current.weather[0].icon;
  document.getElementById('condition-icon').src =
    `https://openweathermap.org/img/wn/${icon}@2x.png`;
  document.getElementById('condition-icon').alt = current.weather[0].description;
  document.getElementById('condition-desc').textContent = current.weather[0].description;

  // Temperatures (stored in °F)
  const tempF     = current.main.temp;
  const feelsF    = current.main.feels_like;
  const display   = t => currentUnit === 'F' ? `${Math.round(t)}°F` : `${fToC(t)}°C`;

  document.getElementById('temp-main').textContent  = display(tempF);
  document.getElementById('feels-like').textContent = `Feels like ${display(feelsF)}`;

  // Details
  document.getElementById('humidity').textContent =
    `${current.main.humidity}%`;
  document.getElementById('wind').textContent =
    `${Math.round(current.wind.speed)} mph ${windDir(current.wind.deg)}`;
  document.getElementById('visibility').textContent =
    current.visibility !== undefined
      ? `${(current.visibility / 1609.34).toFixed(1)} mi`
      : 'N/A';
  document.getElementById('sunrise').textContent =
    unixToTime(current.sys.sunrise, current.timezone);
  document.getElementById('sunset').textContent =
    unixToTime(current.sys.sunset, current.timezone);

  renderForecast(forecast.list);
}

function renderForecast(list) {
  // Group by calendar day (using UTC + timezone offset)
  const days = {};
  list.forEach(item => {
    const tzOffset  = currentData.current.timezone; // seconds
    const localMs   = (item.dt + tzOffset) * 1000;
    const d         = new Date(localMs);
    const key       = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!days[key]) {
      days[key] = { temps: [], icons: [], dt: item.dt + tzOffset, label: '' };
    }
    days[key].temps.push(item.main.temp_max, item.main.temp_min);
    days[key].icons.push(item.weather[0].icon);
  });

  const strip = document.getElementById('forecast-strip');
  strip.innerHTML = '';

  // Skip today, show next 5 days
  const keys = Object.keys(days).slice(1, 6);
  keys.forEach(key => {
    const day   = days[key];
    const high  = Math.max(...day.temps);
    const low   = Math.min(...day.temps);
    const icon  = day.icons[Math.floor(day.icons.length / 2)]; // midday icon
    const label = dayLabel(day.dt);
    const fmt   = t => currentUnit === 'F' ? `${Math.round(t)}°` : `${fToC(t)}°`;

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <div class="forecast-day">${label}</div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="" />
      <div class="forecast-temps">${fmt(high)} <span class="low">/ ${fmt(low)}</span></div>
    `;
    strip.appendChild(card);
  });
}

/* ===== Unit Toggle ===== */
function setUnit(unit) {
  if (currentUnit === unit) return;
  currentUnit = unit;
  syncUnitButtons();
  if (currentData) renderWeather();
  renderComparison();
}

function syncUnitButtons() {
  btnF.classList.toggle('active', currentUnit === 'F');
  btnC.classList.toggle('active', currentUnit === 'C');
}

function fToC(f) {
  return Math.round((f - 32) * 5 / 9);
}

/* ===== Recent Searches ===== */
function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
  catch (_) { return []; }
}

function saveRecent(city) {
  let list = getRecent().filter(c => c.toLowerCase() !== city.toLowerCase());
  list.unshift(city);
  list = list.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function renderRecent() {
  const list = getRecent();
  recentEl.innerHTML = '';
  if (!list.length) return;

  const label = document.createElement('span');
  label.className = 'recent-label';
  label.textContent = 'Recent:';
  recentEl.appendChild(label);

  list.forEach(city => {
    const chip = document.createElement('button');
    chip.className = 'recent-chip';
    chip.textContent = city;
    chip.addEventListener('click', () => fetchWeather(city));
    recentEl.appendChild(chip);
  });
}

/* ===== Dynamic Theme ===== */
const THEMES = [
  'theme-sunny-day','theme-cloudy-day','theme-rainy',
  'theme-stormy','theme-snowy','theme-night','theme-foggy'
];

function applyTheme(current) {
  const id   = current.weather[0].id;
  const icon = current.weather[0].icon;
  const isNight = icon.endsWith('n');

  THEMES.forEach(t => document.body.classList.remove(t));

  if (isNight) {
    document.body.classList.add('theme-night');
    return;
  }
  if (id >= 200 && id < 300) {
    document.body.classList.add('theme-stormy');
  } else if (id >= 300 && id < 600) {
    document.body.classList.add('theme-rainy');
  } else if (id >= 600 && id < 700) {
    document.body.classList.add('theme-snowy');
  } else if (id >= 700 && id < 800) {
    document.body.classList.add('theme-foggy');
  } else if (id === 800) {
    document.body.classList.add('theme-sunny-day');
  } else {
    document.body.classList.add('theme-cloudy-day');
  }
}

/* ===== Helpers ===== */
function localTime(tzOffsetSeconds) {
  const now    = new Date();
  const utcMs  = now.getTime() + now.getTimezoneOffset() * 60000;
  const local  = new Date(utcMs + tzOffsetSeconds * 1000);
  return local.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function unixToTime(unix, tzOffsetSeconds) {
  const ms    = (unix + tzOffsetSeconds) * 1000;
  const d     = new Date(ms);
  const h     = d.getUTCHours();
  const m     = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm  = h >= 12 ? 'PM' : 'AM';
  const hr    = h % 12 || 12;
  return `${hr}:${m} ${ampm}`;
}

function dayLabel(utcSeconds) {
  const d = new Date(utcSeconds * 1000);
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function windDir(deg) {
  if (deg === undefined) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function showError(msg) {
  errorMsg.textContent = msg;
}

function clearError() {
  errorMsg.textContent = '';
}

function shakeSearch() {
  searchBar.classList.remove('shake');
  void searchBar.offsetWidth; // reflow to restart animation
  searchBar.classList.add('shake');
  searchBar.addEventListener('animationend', () => searchBar.classList.remove('shake'), { once: true });
}

/* ===== Background Customizer ===== */
const BG_KEY = 'wx_bg';

const PRESETS = [
  { label: 'Midnight',  a: '#0d1117', b: '#1c2333' },
  { label: 'Ocean',     a: '#0f2027', b: '#2c5364' },
  { label: 'Aurora',    a: '#0f3443', b: '#34e89e' },
  { label: 'Dusk',      a: '#2c1654', b: '#a45de2' },
  { label: 'Ember',     a: '#c0392b', b: '#f39c12' },
  { label: 'Forest',    a: '#134e5e', b: '#71b280' },
  { label: 'Rose',      a: '#b24592', b: '#f15f79' },
  { label: 'Steel',     a: '#373b44', b: '#4286f4' },
  { label: 'Peach',     a: '#ed8d8d', b: '#f7ce68' },
  { label: 'Arctic',    a: '#a8c0d6', b: '#d6e8f5' },
];

let bgMode = 'auto'; // 'auto' | 'custom'
let selectedPreset = null;

const bgToggleBtn   = document.getElementById('bg-toggle-btn');
const bgDrawer      = document.getElementById('bg-drawer');
const bgCloseBtn    = document.getElementById('bg-close-btn');
const bgModeAuto    = document.getElementById('bg-mode-auto');
const bgModeCustom  = document.getElementById('bg-mode-custom');
const bgCustomOpts  = document.getElementById('bg-custom-options');
const presetGrid    = document.getElementById('preset-grid');
const bgColorA      = document.getElementById('bg-color-a');
const gradColorA    = document.getElementById('grad-color-a');
const gradColorB    = document.getElementById('grad-color-b');
const applyGradBtn  = document.getElementById('apply-grad-btn');

// Build preset swatches
PRESETS.forEach((p, i) => {
  const swatch = document.createElement('button');
  swatch.className = 'preset-swatch';
  swatch.style.background = `linear-gradient(135deg, ${p.a}, ${p.b})`;
  swatch.title = p.label;
  swatch.setAttribute('aria-label', p.label);
  swatch.addEventListener('click', () => {
    selectedPreset = i;
    document.querySelectorAll('.preset-swatch').forEach((s, j) =>
      s.classList.toggle('selected', j === i)
    );
    applyCustomBg(`linear-gradient(135deg, ${p.a}, ${p.b})`);
  });
  presetGrid.appendChild(swatch);
});

// Solid color picker — apply on change
bgColorA.addEventListener('input', () => {
  selectedPreset = null;
  document.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('selected'));
  applyCustomBg(bgColorA.value);
});

// Gradient apply button
applyGradBtn.addEventListener('click', () => {
  selectedPreset = null;
  document.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('selected'));
  applyCustomBg(`linear-gradient(135deg, ${gradColorA.value}, ${gradColorB.value})`);
});

bgToggleBtn.addEventListener('click', () => bgDrawer.classList.toggle('hidden'));
bgCloseBtn.addEventListener('click', () => bgDrawer.classList.add('hidden'));

bgModeAuto.addEventListener('click', () => {
  bgMode = 'auto';
  bgModeAuto.classList.add('active');
  bgModeCustom.classList.remove('active');
  bgCustomOpts.classList.add('hidden');
  document.body.classList.remove('bg-custom');
  document.body.style.removeProperty('--custom-bg');
  localStorage.removeItem(BG_KEY);
  // Re-apply weather theme if data is available
  if (currentData) applyTheme(currentData.current);
});

bgModeCustom.addEventListener('click', () => {
  bgMode = 'custom';
  bgModeCustom.classList.add('active');
  bgModeAuto.classList.remove('active');
  bgCustomOpts.classList.remove('hidden');
  // Apply last saved custom bg if any
  const saved = localStorage.getItem(BG_KEY);
  if (saved) applyCustomBg(saved, false);
});

function applyCustomBg(value, save = true) {
  THEMES.forEach(t => document.body.classList.remove(t));
  document.body.style.setProperty('--custom-bg', value);
  document.body.classList.add('bg-custom');
  if (save) localStorage.setItem(BG_KEY, value);
}

/* ===== Air Quality Index ===== */
const AQI_LABELS = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

async function fetchAndRenderAQI(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
    );
    if (!res.ok) return;
    const data = await res.json();
    const aqi = data.list[0].main.aqi;
    const row = document.getElementById('aqi-row');
    const val = document.getElementById('aqi-value');
    val.innerHTML = `<span class="aqi-badge aqi-${aqi}">${AQI_LABELS[aqi]}</span>`;
    row.style.display = 'flex';
  } catch (_) { /* silently skip if AQI fails */ }
}

/* ===== Multi-City Comparison ===== */
const PINNED_KEY  = 'wx_pinned';
const MAX_PINNED  = 3;

const pinBtn          = document.getElementById('pin-btn');
const compSection     = document.getElementById('comparison-section');
const compStrip       = document.getElementById('comparison-strip');

function getPinned() {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY)) || []; }
  catch (_) { return []; }
}

function savePinned(list) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(list));
}

function syncPinButton() {
  if (!currentData) return;
  const name = currentData.current.name + ', ' + currentData.current.sys.country;
  const pinned = getPinned();
  const isPinned = pinned.some(c => c.toLowerCase() === name.toLowerCase());
  pinBtn.classList.remove('hidden');
  pinBtn.classList.toggle('pinned', isPinned);
  pinBtn.textContent = isPinned ? '📌 Pinned' : '📌 Pin for Comparison';
}

pinBtn.addEventListener('click', () => {
  if (!currentData) return;
  const name = currentData.current.name + ', ' + currentData.current.sys.country;
  let pinned = getPinned();
  const idx = pinned.findIndex(c => c.toLowerCase() === name.toLowerCase());
  if (idx !== -1) {
    pinned.splice(idx, 1);
  } else {
    if (pinned.length >= MAX_PINNED) {
      pinned.pop(); // remove oldest
    }
    pinned.unshift(name);
  }
  savePinned(pinned);
  syncPinButton();
  renderComparison();
});

async function fetchCityComparison(city) {
  const [weatherRes, ] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=imperial`)
  ]);
  if (!weatherRes.ok) return null;
  const weather = await weatherRes.json();

  // Fetch AQI using coordinates from weather response
  let aqi = null;
  try {
    const aqiRes = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${weather.coord.lat}&lon=${weather.coord.lon}&appid=${API_KEY}`
    );
    if (aqiRes.ok) {
      const aqiData = await aqiRes.json();
      aqi = aqiData.list[0].main.aqi;
    }
  } catch (_) {}

  return { weather, aqi };
}

async function renderComparison() {
  const pinned = getPinned();
  if (!pinned.length) {
    compSection.classList.add('hidden');
    return;
  }
  compSection.classList.remove('hidden');
  compStrip.innerHTML = `<div class="comparison-loading">Loading...</div>`;

  const results = await Promise.all(pinned.map(city => fetchCityComparison(city)));

  compStrip.innerHTML = '';
  results.forEach((result, i) => {
    if (!result) return;
    const { weather, aqi } = result;
    const tempF     = weather.main.temp;
    const fmt       = t => currentUnit === 'F' ? `${Math.round(t)}°F` : `${fToC(t)}°C`;
    const cityLabel = weather.name + ', ' + weather.sys.country;
    const icon      = weather.weather[0].icon;
    const aqiBadge  = aqi ? `<span class="aqi-badge aqi-${aqi}">${AQI_LABELS[aqi]}</span>` : '';

    const card = document.createElement('div');
    card.className = 'comparison-card';
    card.innerHTML = `
      <button class="comp-unpin" aria-label="Unpin ${cityLabel}" data-city="${cityLabel}">&#10005;</button>
      <div class="comp-city">${cityLabel}</div>
      <div class="comp-condition">
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="" />
        <span class="comp-desc">${weather.weather[0].description}</span>
      </div>
      <div class="comp-temp">${fmt(tempF)}</div>
      <div class="comp-details">
        <div class="comp-detail">
          <span class="comp-detail-label">Feels like</span>
          <span>${fmt(weather.main.feels_like)}</span>
        </div>
        <div class="comp-detail">
          <span class="comp-detail-label">Humidity</span>
          <span>${weather.main.humidity}%</span>
        </div>
        <div class="comp-detail">
          <span class="comp-detail-label">Wind</span>
          <span>${Math.round(weather.wind.speed)} mph ${windDir(weather.wind.deg)}</span>
        </div>
        ${aqi ? `<div class="comp-detail"><span class="comp-detail-label">Air Quality</span><span>${aqiBadge}</span></div>` : ''}
      </div>
    `;

    card.querySelector('.comp-unpin').addEventListener('click', () => {
      let p = getPinned().filter(c => c.toLowerCase() !== cityLabel.toLowerCase());
      savePinned(p);
      syncPinButton();
      renderComparison();
    });

    compStrip.appendChild(card);
  });
}

// Load pinned cities on startup
renderComparison();

// Restore saved custom bg on load
(function restoreBg() {
  const saved = localStorage.getItem(BG_KEY);
  if (!saved) return;
  bgMode = 'custom';
  bgModeCustom.classList.add('active');
  bgModeAuto.classList.remove('active');
  bgCustomOpts.classList.remove('hidden');
  applyCustomBg(saved, false);
})();
