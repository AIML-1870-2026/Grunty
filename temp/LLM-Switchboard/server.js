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

// POST /api/review
app.post('/api/review', async (req, res) => {
  const { productId, sentimentScore, reviewerPersona = 'casual', wordCount = 120 } = req.body;

  if (productId === undefined || sentimentScore === undefined) {
    return res.status(400).json({ error: 'productId and sentimentScore are required' });
  }

  const products = loadProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    const result = await generateReview({ product, sentimentScore, persona: reviewerPersona, wordCount });
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
    console.error('[error]', err.message);
    if (err.response?.status === 504 || err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timed out. Try again.' });
    }
    res.status(502).json({ error: 'Review generation failed — check your Switchboard connection.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Review Generator running at http://localhost:${PORT}`);
  const count = loadProducts().length;
  console.log(`Loaded ${count} product(s) from ${PRODUCTS_DIR}`);
});
