# AI Product Review Generator — Product Specification

**Version:** 1.0.0  
**Stack:** Node.js · Express · LLM Switchboard (GitHub) · Vanilla JS / HTML / CSS  
**Author:** *[Your Name]*  
**Last Updated:** 2026-04-09

---

## 1. Overview

The **AI Product Review Generator** is a dynamic, browser-based application that reads product definitions from a local folder, presents them in a rich UI, and uses an AI (via your **LLM Switchboard**) to generate realistic product reviews. A spectrum **Sentiment Slider** lets the user (or automation) guide the AI from harshly negative to glowingly positive, with every shade in between. Generated reviews are accompanied by a matching **5-star rating** that is derived from the slider position.

---

## 2. Goals & Non-Goals

### Goals
- Load product data dynamically from a `/products` folder at runtime.
- Let users select a product, set a sentiment level, and trigger AI review generation.
- Display a generated review with a live 5-star visual rating.
- Integrate cleanly with the existing LLM Switchboard on GitHub.
- Provide a beautiful, customizable, and richly interactive UI.

### Non-Goals
- User authentication or multi-user persistence (out of scope for v1).
- Storing reviews in a database (file export only in v1).
- Mobile-native apps.

---

## 3. Repository Structure

```
project-root/
├── server.js                  # Express server — routes + LLM Switchboard bridge
├── package.json
├── .env                       # SWITCHBOARD_URL, MODEL, PORT, etc.
├── products/                  # Drop product JSON files here
│   ├── wireless-headphones.json
│   ├── standing-desk.json
│   └── ...
├── public/
│   ├── index.html             # Single-page app shell
│   ├── style.css              # Design system + theme variables
│   └── app.js                 # Client-side logic
└── switchboard/
    └── client.js              # Thin wrapper around your LLM Switchboard
```

---

## 4. Product File Format

Each file in `/products` is a JSON object with the following schema:

```json
{
  "id": "wireless-headphones",
  "name": "Sony WH-1000XM5 Headphones",
  "category": "Electronics",
  "price": 349.99,
  "image": "https://...",            // optional — URL or relative path
  "description": "Over-ear noise-cancelling headphones with 30-hour battery.",
  "attributes": {
    "brand": "Sony",
    "color": "Black",
    "weight": "250g",
    "warranty": "1 year"
  },
  "tags": ["audio", "wireless", "noise-cancelling"]
}
```

The server scans `/products/*.json` on startup and exposes them via `GET /api/products`.

---

## 5. Backend — `server.js`

### 5.1 Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/products` | Returns array of all product objects. |
| `GET` | `/api/products/:id` | Returns a single product by `id`. |
| `POST` | `/api/review` | Generates a review via LLM Switchboard. |

### 5.2 `POST /api/review` — Request Body

```json
{
  "productId": "wireless-headphones",
  "sentimentScore": 72,       // 0–100; 0 = most negative, 100 = most positive
  "reviewerPersona": "power-user",  // optional: casual | expert | power-user | skeptic
  "wordCount": 150            // optional: target word count, default 120
}
```

### 5.3 `POST /api/review` — Response Body

```json
{
  "productName": "Sony WH-1000XM5 Headphones",
  "sentimentScore": 72,
  "starRating": 4,            // derived — see §7
  "reviewTitle": "Solid choice, with a few caveats",
  "reviewBody": "...",
  "pros": ["Great battery life", "Comfortable fit"],
  "cons": ["Mediocre mic quality"],
  "generatedAt": "2026-04-09T14:32:00Z"
}
```

### 5.4 LLM Switchboard Integration (`switchboard/client.js`)

```js
// switchboard/client.js
const axios = require('axios');

async function generateReview({ product, sentimentScore, persona, wordCount }) {
  const sentimentLabel = toSentimentLabel(sentimentScore); // see §7
  const prompt = buildPrompt({ product, sentimentLabel, persona, wordCount });

  const response = await axios.post(process.env.SWITCHBOARD_URL, {
    model: process.env.SWITCHBOARD_MODEL ?? 'default',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,
  }, {
    headers: { Authorization: `Bearer ${process.env.SWITCHBOARD_API_KEY}` }
  });

  return parseResponse(response.data); // extract title, body, pros, cons
}
```

The `buildPrompt` function injects:
- Product name, category, description, and key attributes.
- A clear sentiment instruction (e.g., *"Write as a mildly dissatisfied customer"*).
- A reviewer persona flavour.
- A word-count target.
- An instruction to return structured JSON so the server can parse `title`, `body`, `pros`, and `cons` without regex.

---

## 6. Frontend — UI Specification

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER  [Logo]  "AI Review Generator"         [Theme Toggle] │
├──────────────────────────────────────────────────────────────┤
│  SIDEBAR (left 280px)          │  MAIN PANEL                  │
│  ─────────────────             │  ───────────────────────     │
│  Search products               │  [Product Card]              │
│  ─────────────────             │    Image / Name / Price      │
│  Category filters              │    Description + tags        │
│  ─────────────────             │  ─────────────────────────   │
│  Product list                  │  SENTIMENT CONTROL           │
│    ● Product A                 │    Slider + Label            │
│    ● Product B   ◀ selected    │    Star Preview              │
│    ● Product C                 │  ─────────────────────────   │
│                                │  PERSONA + WORD COUNT        │
│                                │  ─────────────────────────   │
│                                │  [Generate Review] button    │
│                                │  ─────────────────────────   │
│                                │  REVIEW OUTPUT CARD          │
│                                │    Stars · Title · Body      │
│                                │    Pros & Cons               │
│                                │    [Copy] [Export]           │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Components

#### 6.2.1 Product Sidebar
- Search input filters the list in real time.
- Category pill filters (All, Electronics, Furniture, …) dynamically built from loaded products.
- Each list item shows: product thumbnail (or category icon fallback), name, price.
- Active product is highlighted.

#### 6.2.2 Product Card (main panel)
- Hero image (with placeholder gradient if none provided).
- Name, category badge, price.
- Scrollable description.
- Attribute chips (brand, weight, warranty, etc.).
- Tag pills.

#### 6.2.3 Sentiment Slider
- Full-width range input (`0–100`).
- **Gradient track** that transitions: deep red → orange → amber → yellow-green → green.
- Live **sentiment label** above the thumb updates as you drag:
  - 0–10 → *"Scathing"*
  - 11–25 → *"Very Negative"*
  - 26–40 → *"Negative"*
  - 41–55 → *"Mixed"*
  - 56–70 → *"Positive"*
  - 71–85 → *"Very Positive"*
  - 86–100 → *"Glowing"*
- **Star preview** (5 hollow/filled stars) updates in real time based on §7 mapping.
- Thumb tooltip shows current numeric score.

#### 6.2.4 Reviewer Persona Selector
- Four styled toggle-button options: **Casual Buyer · Tech Expert · Power User · Skeptic**
- Each persona subtly changes the AI's vocabulary and focus points via the prompt.

#### 6.2.5 Word Count Slider
- Range: 50–400 words.
- Labelled presets snap-to: Short (75) · Standard (150) · Detailed (300).

#### 6.2.6 Generate Button
- Primary CTA: *"Generate Review"*.
- Animated loading state: spinning star icon + *"Thinking…"* label.
- Disabled until a product is selected.

#### 6.2.7 Review Output Card
- Animated slide-in on generation.
- **Star rating display** — filled stars with half-star support and colour matching sentiment.
- **Review title** in large bold type.
- **Review body** in readable serif font.
- **Pros** list (green check icons).
- **Cons** list (red X icons).
- **Metadata bar:** persona used · word count · sentiment score badge.
- Action buttons: **Copy to Clipboard** · **Export as .txt** · **Regenerate** (same settings).

### 6.3 Theme & Design System

#### CSS Custom Properties (`:root`)

```css
:root {
  /* Brand */
  --color-primary: #6C63FF;
  --color-primary-dark: #4B44CC;
  --color-accent: #FF6584;

  /* Surfaces */
  --color-bg: #0F0F1A;
  --color-surface: #1A1A2E;
  --color-surface-raised: #22223B;
  --color-border: rgba(255,255,255,0.08);

  /* Text */
  --color-text: #E8E8F0;
  --color-text-muted: #8888AA;

  /* Sentiment spectrum */
  --sentiment-0: #FF3B30;
  --sentiment-25: #FF9500;
  --sentiment-50: #FFCC00;
  --sentiment-75: #34C759;
  --sentiment-100: #30D158;

  /* Stars */
  --star-filled: #FFD700;
  --star-empty: #3A3A5C;

  /* Radius / spacing */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --spacing-unit: 8px;

  /* Animation */
  --transition-fast: 150ms ease;
  --transition-med: 300ms ease;
}
```

#### Light Theme Override

```css
[data-theme="light"] {
  --color-bg: #F4F4FF;
  --color-surface: #FFFFFF;
  --color-surface-raised: #F0F0FA;
  --color-text: #1A1A2E;
  --color-text-muted: #555570;
  --color-border: rgba(0,0,0,0.08);
}
```

#### Accent Colour Customisation Panel
- Exposed in a collapsible **Settings Drawer** (gear icon, top-right).
- Colour picker for `--color-primary` and `--color-accent`.
- Font selector: System Sans · Geist · Inter · Lora (serif for review body).
- Applies changes live via `document.documentElement.style.setProperty(...)`.

---

## 7. Sentiment Score → Star Rating Mapping

| Score Range | Star Rating | Sentiment Label |
|-------------|-------------|-----------------|
| 0 – 10 | ⭐ (1.0) | Scathing |
| 11 – 25 | ⭐½ (1.5) | Very Negative |
| 26 – 35 | ⭐⭐ (2.0) | Negative |
| 36 – 45 | ⭐⭐½ (2.5) | Somewhat Negative |
| 46 – 55 | ⭐⭐⭐ (3.0) | Mixed |
| 56 – 65 | ⭐⭐⭐½ (3.5) | Somewhat Positive |
| 66 – 75 | ⭐⭐⭐⭐ (4.0) | Positive |
| 76 – 88 | ⭐⭐⭐⭐½ (4.5) | Very Positive |
| 89 – 100 | ⭐⭐⭐⭐⭐ (5.0) | Glowing |

This mapping is implemented in a single shared utility (`utils/sentiment.js`) imported by both server and (via bundling or inline copy) the client.

---

## 8. AI Prompt Engineering

### 8.1 System Prompt

```
You are a realistic product reviewer. Write in natural, human language.
Follow the sentiment guidance precisely — the rating you imply through tone
must match the instructed sentiment level. Return your response ONLY as
valid JSON matching the schema below. Do not include markdown fences.

Schema:
{
  "title": "string (max 12 words)",
  "body": "string",
  "pros": ["string", ...],   // 2–4 items
  "cons": ["string", ...]    // 1–3 items; even for positive reviews include at least 1
}
```

### 8.2 User Prompt Template

```
Product: {{name}} ({{category}})
Price: ${{price}}
Description: {{description}}
Key attributes: {{attributes}}

Reviewer persona: {{persona}}
Target sentiment: {{sentimentLabel}} (score {{sentimentScore}}/100)
Target length: approximately {{wordCount}} words in the body.

Write a review matching the above sentiment exactly. The tone, word choice,
and pros/cons emphasis must reflect a {{sentimentLabel}} customer experience.
```

---

## 9. Environment Variables (`.env`)

```env
PORT=3000
SWITCHBOARD_URL=https://raw.githubusercontent.com/<you>/<repo>/...   # or local
SWITCHBOARD_API_KEY=your_key_here
SWITCHBOARD_MODEL=gpt-4o                # or whichever model the switchboard routes to
PRODUCTS_DIR=./products
```

---

## 10. Error Handling

| Scenario | UI Behaviour | Server Behaviour |
|----------|-------------|-----------------|
| No products in folder | Sidebar shows "No products found. Add JSON files to /products." | `GET /api/products` returns `[]` |
| LLM Switchboard unreachable | Toast: "Review generation failed — check your Switchboard connection." | 502 with error JSON |
| Invalid product JSON | Product skipped, console warning | Logged, excluded from list |
| Generation timeout (>30 s) | Toast: "Request timed out. Try again." | 504 |
| LLM returns malformed JSON | Server retries once; on second failure returns raw text in `reviewBody` | Retry logic in `switchboard/client.js` |

---

## 11. Development Roadmap

### v1.0 — MVP
- [x] Spec complete
- [ ] `/products` folder scan + API
- [ ] Switchboard client wrapper
- [ ] Sentiment slider + star preview
- [ ] Review generation + output card
- [ ] Light/dark theme toggle

### v1.1 — Polish
- [ ] Accent colour customisation drawer
- [ ] Export review as `.txt` / `.md`
- [ ] Review history panel (session memory)
- [ ] Persona voice fine-tuning

### v2.0 — Extended
- [ ] Bulk review generation (all products)
- [ ] CSV export of batch reviews
- [ ] Side-by-side compare two sentiment levels for same product
- [ ] Plugin hook for custom prompt templates

---

## 12. Getting Started

```bash
# 1. Clone and install
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your Switchboard URL + API key

# 3. Add products
# Drop .json files into /products (see §4 for schema)

# 4. Run
npm start
# → http://localhost:3000
```

---

## 13. Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | All `.json` files in `/products` load automatically with no server restart. |
| 2 | Sentiment slider at 0 consistently produces 1–1.5 star reviews; at 100 produces 5 stars. |
| 3 | Every slider position from 1–99 produces a review whose tone clearly matches the label. |
| 4 | Star rating display updates live as slider moves before generation. |
| 5 | Review output appears within 30 seconds on a standard connection. |
| 6 | Theme toggle persists across page refreshes (localStorage). |
| 7 | Accent colour picker updates the UI without reload. |
| 8 | Generated review always contains title, body, at least one pro, and at least one con. |
| 9 | Copy to clipboard works across Chrome, Firefox, and Safari. |
| 10 | App renders correctly on viewport widths ≥ 900 px. |
