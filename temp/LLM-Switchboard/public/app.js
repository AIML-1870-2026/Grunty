/* =====================================================
   AI Review Generator — Client App
   ===================================================== */

// ─────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────
const state = {
  products: [],
  filteredProducts: [],
  selectedProduct: null,
  activeCategory: 'All',
  sentimentScore: 50,
  persona: 'casual',
  wordCount: 150,
  isGenerating: false,
  lastReview: null,
};

// ─────────────────────────────────────────────────────
// Sentiment utilities (mirrors switchboard/client.js)
// ─────────────────────────────────────────────────────
function toStarRating(score) {
  if (score <= 10) return 1.0;
  if (score <= 25) return 1.5;
  if (score <= 35) return 2.0;
  if (score <= 45) return 2.5;
  if (score <= 55) return 3.0;
  if (score <= 65) return 3.5;
  if (score <= 75) return 4.0;
  if (score <= 88) return 4.5;
  return 5.0;
}

function toSentimentLabel(score) {
  if (score <= 10) return 'Scathing';
  if (score <= 25) return 'Very Negative';
  if (score <= 35) return 'Negative';
  if (score <= 45) return 'Somewhat Negative';
  if (score <= 55) return 'Mixed';
  if (score <= 65) return 'Somewhat Positive';
  if (score <= 75) return 'Positive';
  if (score <= 88) return 'Very Positive';
  return 'Glowing';
}

function sentimentColor(score) {
  if (score <= 20) return '#FF3B30';
  if (score <= 35) return '#FF6B35';
  if (score <= 50) return '#FFCC00';
  if (score <= 70) return '#A8D518';
  return '#34C759';
}

// ─────────────────────────────────────────────────────
// Star rendering
// ─────────────────────────────────────────────────────
function renderStars(rating, container) {
  const filled = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - filled - (half ? 1 : 0);

  let html = '';
  for (let i = 0; i < filled; i++) html += `<span class="star" style="color:var(--star-filled)">★</span>`;
  if (half) html += `<span class="star" style="color:var(--star-filled)">⯨</span>`;
  for (let i = 0; i < empty; i++) html += `<span class="star" style="color:var(--star-empty)">★</span>`;

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ─────────────────────────────────────────────────────
// Category icons fallback map
// ─────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  Electronics: '🎧',
  Furniture: '🪑',
  Kitchen: '☕',
  Footwear: '👟',
  Wearables: '⌚',
  Default: '🛍️',
};

function categoryIcon(cat) {
  return CATEGORY_ICONS[cat] || CATEGORY_ICONS.Default;
}

// ─────────────────────────────────────────────────────
// Product list rendering
// ─────────────────────────────────────────────────────
function renderProductList() {
  const container = document.getElementById('product-list');
  const { filteredProducts, selectedProduct } = state;

  if (filteredProducts.length === 0) {
    container.innerHTML = '<div class="no-products">No products found.<br>Add JSON files to /products.</div>';
    return;
  }

  container.innerHTML = filteredProducts.map(p => `
    <div class="product-item ${selectedProduct?.id === p.id ? 'active' : ''}"
         data-id="${p.id}" role="button" tabindex="0">
      <img
        class="product-thumb"
        src="${p.image || ''}"
        alt="${p.name}"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
      >
      <div class="product-thumb-fallback" style="display:none">${categoryIcon(p.category)}</div>
      <div class="product-item-info">
        <div class="product-item-name">${p.name}</div>
        <div class="product-item-price">$${Number(p.price).toFixed(2)}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.product-item').forEach(el => {
    el.addEventListener('click', () => selectProduct(el.dataset.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') selectProduct(el.dataset.id); });
  });
}

// ─────────────────────────────────────────────────────
// Category filters
// ─────────────────────────────────────────────────────
function renderCategoryFilters() {
  const categories = ['All', ...new Set(state.products.map(p => p.category))];
  const container = document.getElementById('category-filters');

  container.innerHTML = categories.map(c => `
    <button class="cat-pill ${state.activeCategory === c ? 'active' : ''}" data-cat="${c}">${c}</button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.cat;
      applyFilters();
      renderCategoryFilters();
    });
  });
}

function applyFilters() {
  const query = document.getElementById('product-search').value.toLowerCase();
  state.filteredProducts = state.products.filter(p => {
    const matchesCategory = state.activeCategory === 'All' || p.category === state.activeCategory;
    const matchesSearch = !query ||
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      (p.tags || []).some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });
  renderProductList();
}

// ─────────────────────────────────────────────────────
// Product card rendering
// ─────────────────────────────────────────────────────
function selectProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  state.selectedProduct = product;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('product-content').style.display = 'flex';
  document.getElementById('generate-btn').disabled = false;

  // Populate card
  const img = document.getElementById('product-img');
  const fallback = document.getElementById('product-img-fallback');
  if (product.image) {
    img.src = product.image;
    img.alt = product.name;
    img.style.display = '';
    fallback.style.display = 'none';
    fallback.textContent = categoryIcon(product.category);
  } else {
    img.style.display = 'none';
    fallback.style.display = 'flex';
    fallback.textContent = categoryIcon(product.category);
  }

  document.getElementById('product-name').textContent = product.name;
  document.getElementById('product-category').textContent = product.category;
  document.getElementById('product-price').textContent = `$${Number(product.price).toFixed(2)}`;
  document.getElementById('product-description').textContent = product.description || '';

  // Attribute chips
  const attrsEl = document.getElementById('product-attrs');
  attrsEl.innerHTML = product.attributes
    ? Object.entries(product.attributes)
        .map(([k, v]) => `<span class="attr-chip"><strong>${k}:</strong> ${v}</span>`)
        .join('')
    : '';

  // Tag pills
  const tagsEl = document.getElementById('product-tags');
  tagsEl.innerHTML = (product.tags || [])
    .map(t => `<span class="tag-pill">#${t}</span>`)
    .join('');

  // Re-render list to update active state
  renderProductList();

  // Hide previous review
  document.getElementById('review-output').style.display = 'none';
  state.lastReview = null;
}

// ─────────────────────────────────────────────────────
// Sentiment slider
// ─────────────────────────────────────────────────────
function updateSentimentUI(score) {
  state.sentimentScore = score;
  const label = toSentimentLabel(score);
  const color = sentimentColor(score);
  const stars = toStarRating(score);

  document.getElementById('sentiment-label').textContent = label;
  document.getElementById('sentiment-label').style.color = color;
  document.getElementById('sentiment-score-badge').textContent = `${score} / 100`;
  document.getElementById('sentiment-score-badge').style.color = color;

  const starPreview = document.getElementById('star-preview');
  renderStars(stars, starPreview);
  document.getElementById('star-preview-label').textContent = `${stars.toFixed(1)} stars`;
  document.getElementById('star-preview-label').style.color = color;

  // Slider thumb color via CSS variable
  document.getElementById('sentiment-slider').style.setProperty('--thumb-color', color);
}

// ─────────────────────────────────────────────────────
// Word count slider
// ─────────────────────────────────────────────────────
function updateWordCountUI(val) {
  state.wordCount = val;
  document.getElementById('word-count-display').textContent = `${val} words`;
  document.getElementById('word-count-slider').value = val;

  // Update preset active state
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.words) === val);
  });
}

// ─────────────────────────────────────────────────────
// Model options
// ─────────────────────────────────────────────────────
const MODELS = {
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
};

function populateModels(provider) {
  const sel = document.getElementById('model-select');
  const saved = localStorage.getItem(`model_${provider}`);
  sel.innerHTML = MODELS[provider].map(m =>
    `<option value="${m.value}" ${saved === m.value ? 'selected' : ''}>${m.label}</option>`
  ).join('');
}

// ─────────────────────────────────────────────────────
// Settings persistence
// ─────────────────────────────────────────────────────
function loadSettings() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '🌙' : '☀️';

  const provider = localStorage.getItem('provider') || 'anthropic';
  document.getElementById('provider-select').value = provider;
  populateModels(provider);

  const key = localStorage.getItem(`apikey_${provider}`) || '';
  document.getElementById('api-key-input').value = key;

  const primary = localStorage.getItem('color_primary') || '#6C63FF';
  const accent = localStorage.getItem('color_accent') || '#FF6584';
  document.getElementById('color-primary').value = primary;
  document.getElementById('color-accent').value = accent;
  document.documentElement.style.setProperty('--color-primary', primary);
  document.documentElement.style.setProperty('--color-accent', accent);

  const font = localStorage.getItem('review_font') || "Georgia, 'Times New Roman', serif";
  document.documentElement.style.setProperty('--font-review', font);
  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === font);
  });
}

function saveSettings() {
  const provider = document.getElementById('provider-select').value;
  const model = document.getElementById('model-select').value;
  const key = document.getElementById('api-key-input').value.trim();

  localStorage.setItem('provider', provider);
  localStorage.setItem(`model_${provider}`, model);
  if (key) localStorage.setItem(`apikey_${provider}`, key);
}

// ─────────────────────────────────────────────────────
// LLM prompt builder
// ─────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a realistic product reviewer. Write in natural, human language.
Follow the sentiment guidance precisely — the rating you imply through tone must match the instructed sentiment level.
Return your response ONLY as valid JSON matching the schema below. Do not include markdown fences.

Schema:
{
  "title": "string (max 12 words)",
  "body": "string",
  "pros": ["string"],
  "cons": ["string"]
}

Rules:
- pros: 2–4 items
- cons: 1–3 items; even for positive reviews include at least 1 con`;
}

function buildUserPrompt(product, sentimentLabel, sentimentScore, persona, wordCount) {
  const attrs = product.attributes
    ? Object.entries(product.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'N/A';

  return `Product: ${product.name} (${product.category})
Price: $${product.price}
Description: ${product.description}
Key attributes: ${attrs}

Reviewer persona: ${persona}
Target sentiment: ${sentimentLabel} (score ${sentimentScore}/100)
Target length: approximately ${wordCount} words in the body.

Write a review matching the above sentiment exactly. The tone, word choice, and pros/cons emphasis must reflect a ${sentimentLabel} customer experience.`;
}

// ─────────────────────────────────────────────────────
// API call — routed through Express server (avoids CORS)
// ─────────────────────────────────────────────────────
async function callReviewAPI({ productId, sentimentScore, persona, wordCount, apiKey, provider, model }) {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId, sentimentScore, reviewerPersona: persona, wordCount, apiKey, provider, model }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

// ─────────────────────────────────────────────────────
// Generate Review
// ─────────────────────────────────────────────────────
async function generateReview() {
  if (!state.selectedProduct || state.isGenerating) return;

  const provider = localStorage.getItem('provider') || document.getElementById('provider-select').value;
  const model = localStorage.getItem(`model_${provider}`) || document.getElementById('model-select').value;
  const key = localStorage.getItem(`apikey_${provider}`)
    || document.getElementById('api-key-input').value.trim();

  if (!key) {
    showToast('Please enter an API key in Settings ⚙️', 'error');
    openDrawer();
    return;
  }

  state.isGenerating = true;
  setGeneratingUI(true);

  const sentimentLabel = toSentimentLabel(state.sentimentScore);

  try {
    const data = await callReviewAPI({
      productId: state.selectedProduct.id,
      sentimentScore: state.sentimentScore,
      persona: state.persona,
      wordCount: state.wordCount,
      apiKey: key,
      provider,
      model,
    });

    const review = {
      title: data.reviewTitle,
      body: data.reviewBody,
      pros: data.pros,
      cons: data.cons,
      starRating: data.starRating,
      sentimentScore: state.sentimentScore,
      sentimentLabel,
      persona: state.persona,
      wordCount: state.wordCount,
      productName: state.selectedProduct.name,
      generatedAt: data.generatedAt,
    };

    state.lastReview = review;
    renderReviewOutput(review);

  } catch (err) {
    showToast(err.message || 'Review generation failed — check your connection.', 'error');
  } finally {
    state.isGenerating = false;
    setGeneratingUI(false);
  }
}

function setGeneratingUI(loading) {
  const btn = document.getElementById('generate-btn');
  const icon = document.getElementById('btn-icon');
  const label = document.getElementById('btn-label');

  btn.disabled = loading;
  if (loading) {
    icon.textContent = '⭐';
    icon.classList.add('spinning');
    label.textContent = 'Thinking…';
  } else {
    icon.classList.remove('spinning');
    icon.textContent = '⭐';
    label.textContent = 'Generate Review';
  }
}

// ─────────────────────────────────────────────────────
// Render review output
// ─────────────────────────────────────────────────────
function renderReviewOutput(review) {
  const card = document.getElementById('review-output');

  // Stars
  renderStars(review.starRating, document.getElementById('review-stars'));
  document.getElementById('review-rating-num').textContent = `${review.starRating.toFixed(1)} / 5.0`;

  // Title & body
  document.getElementById('review-title').textContent = review.title || '';
  document.getElementById('review-body').textContent = review.body || '';

  // Pros
  const prosEl = document.getElementById('review-pros');
  prosEl.innerHTML = (review.pros || []).map(p => `<li>${p}</li>`).join('');

  // Cons
  const consEl = document.getElementById('review-cons');
  consEl.innerHTML = (review.cons || []).map(c => `<li>${c}</li>`).join('');

  // Meta bar
  const personaLabels = { casual: 'Casual Buyer', expert: 'Tech Expert', 'power-user': 'Power User', skeptic: 'Skeptic' };
  document.getElementById('review-meta').innerHTML = `
    <span class="meta-tag sentiment-tag">${review.sentimentLabel} (${review.sentimentScore}/100)</span>
    <span class="meta-tag">👤 ${personaLabels[review.persona] || review.persona}</span>
    <span class="meta-tag">~${review.wordCount} words</span>
    <span class="meta-tag">⭐ ${review.starRating.toFixed(1)} stars</span>
  `;

  card.style.display = '';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────────────
// Copy & Export
// ─────────────────────────────────────────────────────
function copyReview() {
  const r = state.lastReview;
  if (!r) return;

  const pros = (r.pros || []).map(p => `  ✓ ${p}`).join('\n');
  const cons = (r.cons || []).map(c => `  ✗ ${c}`).join('\n');

  const text = `${r.reviewTitle || r.title}\n${'─'.repeat(50)}\n\n${r.reviewBody || r.body}\n\nPros:\n${pros}\n\nCons:\n${cons}\n\n[${r.sentimentLabel} — ${r.starRating.toFixed(1)}/5 stars | ${r.productName}]`;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.classList.add('success');
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.classList.remove('success');
      btn.textContent = '📋 Copy';
    }, 2000);
    showToast('Review copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Copy failed — please copy manually.', 'error');
  });
}

function exportReview() {
  const r = state.lastReview;
  if (!r) return;

  const title = r.reviewTitle || r.title || 'review';
  const pros = (r.pros || []).map(p => `  ✓ ${p}`).join('\n');
  const cons = (r.cons || []).map(c => `  ✗ ${c}`).join('\n');

  const content = [
    `Product: ${r.productName}`,
    `Generated: ${new Date(r.generatedAt).toLocaleString()}`,
    `Sentiment: ${r.sentimentLabel} (${r.sentimentScore}/100)`,
    `Rating: ${r.starRating.toFixed(1)} / 5.0 stars`,
    `Persona: ${r.persona}`,
    '',
    title.toUpperCase(),
    '─'.repeat(60),
    '',
    r.reviewBody || r.body || '',
    '',
    'PROS:',
    pros,
    '',
    'CONS:',
    cons,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `review-${(r.productName || 'product').toLowerCase().replace(/\s+/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Review exported!', 'success');
}

// ─────────────────────────────────────────────────────
// Settings drawer
// ─────────────────────────────────────────────────────
function openDrawer() {
  document.getElementById('settings-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
}

function closeDrawer() {
  saveSettings();
  document.getElementById('settings-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

// ─────────────────────────────────────────────────────
// Product data loading (server or embedded fallback)
// ─────────────────────────────────────────────────────
const EMBEDDED_PRODUCTS = [
  {
    id: "wireless-headphones",
    name: "Sony WH-1000XM5 Headphones",
    category: "Electronics",
    price: 349.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
    description: "Industry-leading noise-cancelling over-ear headphones with up to 30-hour battery life, multipoint Bluetooth connection, and crystal-clear hands-free calling.",
    attributes: { brand: "Sony", color: "Midnight Black", weight: "250g", battery: "30 hours", connectivity: "Bluetooth 5.2", warranty: "1 year" },
    tags: ["audio", "wireless", "noise-cancelling", "over-ear"]
  },
  {
    id: "standing-desk",
    name: "FlexiPro Electric Standing Desk",
    category: "Furniture",
    price: 699.00,
    image: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80",
    description: "Height-adjustable electric standing desk with dual motors, programmable height presets, and a spacious 60×30 inch bamboo desktop. Whisper-quiet operation.",
    attributes: { brand: "FlexiPro", surface: "Bamboo", dimensions: "60\" × 30\"", height_range: "25\" – 51\"", weight_capacity: "275 lbs", warranty: "5 years" },
    tags: ["desk", "ergonomic", "electric", "home-office", "adjustable"]
  },
  {
    id: "coffee-maker",
    name: "Nespresso Vertuo Next Coffee Maker",
    category: "Kitchen",
    price: 199.95,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80",
    description: "Versatile capsule coffee maker that brews five cup sizes from espresso to Alto XL. Features a 30-second heat-up time, automatic capsule recognition via barcode, and a sleek compact design.",
    attributes: { brand: "Nespresso", color: "Matte Black", cup_sizes: "5 (Espresso to Alto)", heat_up: "30 seconds", water_tank: "37 oz", warranty: "2 years" },
    tags: ["coffee", "espresso", "capsule", "kitchen", "compact"]
  },
  {
    id: "running-shoes",
    name: "Nike Air Zoom Pegasus 41",
    category: "Footwear",
    price: 130.00,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    description: "Everyday running shoe featuring dual Air Zoom units for springy cushioning, a breathable Flyknit upper, and a wider forefoot for a natural toe splay. Suitable for road and treadmill running.",
    attributes: { brand: "Nike", color: "White / Blue", weight: "284g (men's US 10)", drop: "10mm", upper: "Flyknit mesh", warranty: "60-day wear test" },
    tags: ["running", "shoes", "sports", "nike", "cushioned"]
  },
  {
    id: "smart-watch",
    name: "Apple Watch Series 9 (45mm)",
    category: "Wearables",
    price: 429.00,
    image: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&q=80",
    description: "Next-generation smartwatch with the S9 chip, Double Tap gesture, always-on Retina display, advanced health sensors (ECG, blood oxygen, temperature), and 18-hour battery life.",
    attributes: { brand: "Apple", color: "Midnight Aluminum", display: "45mm Always-On Retina", chip: "Apple S9", battery: "18 hours", water_resistance: "50m", warranty: "1 year" },
    tags: ["smartwatch", "apple", "health", "fitness", "wearable"]
  }
];

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Server not available');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty');
    return data;
  } catch {
    // Fallback to embedded products (for static / GitHub Pages hosting)
    return EMBEDDED_PRODUCTS;
  }
}

// ─────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────
async function init() {
  loadSettings();

  // Load products
  const products = await loadProducts();
  state.products = products;
  state.filteredProducts = [...products];
  renderCategoryFilters();
  renderProductList();

  // Sentiment slider
  const sentimentSlider = document.getElementById('sentiment-slider');
  updateSentimentUI(50);
  sentimentSlider.addEventListener('input', e => updateSentimentUI(Number(e.target.value)));

  // Word count slider
  const wordSlider = document.getElementById('word-count-slider');
  wordSlider.addEventListener('input', e => updateWordCountUI(Number(e.target.value)));

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => updateWordCountUI(Number(btn.dataset.words)));
  });

  // Persona
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.persona = btn.dataset.persona;
      document.querySelectorAll('.persona-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Generate
  document.getElementById('generate-btn').addEventListener('click', generateReview);
  document.getElementById('generate-btn').disabled = true;

  // Copy / Export / Regenerate
  document.getElementById('copy-btn').addEventListener('click', copyReview);
  document.getElementById('export-btn').addEventListener('click', exportReview);
  document.getElementById('regenerate-btn').addEventListener('click', generateReview);

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.getElementById('theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme', next);
  });

  // Settings drawer
  document.getElementById('settings-btn').addEventListener('click', openDrawer);
  document.getElementById('close-drawer').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    saveSettings();
    const confirm = document.getElementById('save-confirm');
    confirm.style.display = 'block';
    setTimeout(() => { confirm.style.display = 'none'; }, 2000);
    showToast('Settings saved!', 'success');
  });

  // Provider change
  document.getElementById('provider-select').addEventListener('change', e => {
    const provider = e.target.value;
    populateModels(provider);
    const savedKey = localStorage.getItem(`apikey_${provider}`) || '';
    document.getElementById('api-key-input').value = savedKey;
    localStorage.setItem('provider', provider);
  });

  // Model change
  document.getElementById('model-select').addEventListener('change', saveSettings);

  // API key change
  document.getElementById('api-key-input').addEventListener('input', saveSettings);

  // Color pickers
  document.getElementById('color-primary').addEventListener('input', e => {
    document.documentElement.style.setProperty('--color-primary', e.target.value);
    localStorage.setItem('color_primary', e.target.value);
  });

  document.getElementById('color-accent').addEventListener('input', e => {
    document.documentElement.style.setProperty('--color-accent', e.target.value);
    localStorage.setItem('color_accent', e.target.value);
  });

  // Font options
  document.querySelectorAll('.font-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const font = btn.dataset.font;
      document.documentElement.style.setProperty('--font-review', font);
      localStorage.setItem('review_font', font);
      document.querySelectorAll('.font-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Search
  document.getElementById('product-search').addEventListener('input', applyFilters);
}

document.addEventListener('DOMContentLoaded', init);
