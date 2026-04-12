require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { generateReview } = require('./switchboard/client');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTS_DIR = process.env.PRODUCTS_DIR
  ? path.resolve(process.env.PRODUCTS_DIR)
  : path.join(__dirname, 'products');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load all products from the products directory
function loadProducts() {
  const products = [];
  if (!fs.existsSync(PRODUCTS_DIR)) return products;

  const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8');
      const product = JSON.parse(raw);
      products.push(product);
    } catch (err) {
      console.warn(`[warn] Skipping ${file}: ${err.message}`);
    }
  }
  return products;
}

// GET /api/products
app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const products = loadProducts();
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/test-key — verifies credentials without generating a review
app.post('/api/test-key', async (req, res) => {
  const { apiKey, provider } = req.body;
  const key = apiKey || process.env.SWITCHBOARD_API_KEY || '';
  const prov = provider || 'anthropic';

  if (!key) return res.status(400).json({ ok: false, error: 'No key provided' });

  const masked = key.slice(0, 8) + '...' + key.slice(-4);
  console.log(`[test-key] provider=${prov} key=${masked}`);

  try {
    const axios = require('axios');
    if (prov === 'anthropic') {
      await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-haiku-4-5-20251001', max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }]
      }, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } });
    } else {
      await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini', max_tokens: 5,
        messages: [{ role: 'user', content: 'hi' }]
      }, { headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' } });
    }
    res.json({ ok: true, provider: prov, masked });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ ok: false, provider: prov, masked, error: msg });
  }
});

// POST /api/review
app.post('/api/review', async (req, res) => {
  const {
    productId, sentimentScore, reviewerPersona = 'casual', wordCount = 120,
    apiKey, provider, model,
  } = req.body;

  if (productId === undefined || sentimentScore === undefined) {
    return res.status(400).json({ error: 'productId and sentimentScore are required' });
  }

  const products = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Allow client to pass credentials; fall back to .env
  const resolvedKey = apiKey || process.env.SWITCHBOARD_API_KEY;
  const resolvedProvider = provider || process.env.SWITCHBOARD_PROVIDER || 'anthropic';
  const resolvedModel = model || process.env.SWITCHBOARD_MODEL;

  if (!resolvedKey) {
    return res.status(400).json({ error: 'No API key provided. Enter one in Settings or set SWITCHBOARD_API_KEY in .env.' });
  }

  try {
    const result = await generateReview({
      product, sentimentScore, persona: reviewerPersona, wordCount,
      apiKey: resolvedKey, provider: resolvedProvider, model: resolvedModel,
    });
    res.json({
      productName: product.name,
      sentimentScore,
      starRating: result.starRating,
      reviewTitle: result.title,
      reviewBody: result.body,
      pros: result.pros,
      cons: result.cons,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('[error]', detail);
    if (err.response?.status === 504 || err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timed out. Try again.' });
    }
    const msg = err.response?.data?.error?.message || err.message || 'Unknown error';
    res.status(502).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`AI Review Generator running at http://localhost:${PORT}`);
  const count = loadProducts().length;
  console.log(`Loaded ${count} product(s) from ${PRODUCTS_DIR}`);
});
