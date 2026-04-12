const axios = require('axios');

// Sentiment score → star rating (spec §7)
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

// Sentiment score → label
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

function buildPrompt({ product, sentimentLabel, sentimentScore, persona, wordCount }) {
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

const SYSTEM_PROMPT = `You are a realistic product reviewer. Write in natural, human language.
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

function parseResponse(data) {
  let text = '';

  // Anthropic shape
  if (data.content?.[0]?.text) {
    text = data.content[0].text;
  }
  // OpenAI shape
  else if (data.choices?.[0]?.message?.content) {
    text = data.choices[0].message.content;
  }
  else {
    throw new Error('Unrecognised LLM response shape');
  }

  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Extract first {...} block from the text (handles preamble/postamble)
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error(`Could not parse review JSON from model response. Try again.`);
}

async function callWithRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    // Retry once on parse failure
    if (err.message.startsWith('Failed to parse')) {
      return await fn();
    }
    throw err;
  }
}

async function generateReview({ product, sentimentScore, persona = 'casual', wordCount = 120, apiKey: apiKeyArg, provider: providerArg, model: modelArg }) {
  const sentimentLabel = toSentimentLabel(sentimentScore);
  const starRating = toStarRating(sentimentScore);
  const prompt = buildPrompt({ product, sentimentLabel, sentimentScore, persona, wordCount });

  const provider = providerArg || process.env.SWITCHBOARD_PROVIDER || 'anthropic';
  const model = modelArg || process.env.SWITCHBOARD_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');
  const apiKey = apiKeyArg || process.env.SWITCHBOARD_API_KEY;

  if (!apiKey) throw new Error('SWITCHBOARD_API_KEY is not set in .env');

  const parsed = await callWithRetry(async () => {
    let response;

    if (provider === 'anthropic') {
      response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: 1024,
          temperature: 0.85,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 30000
        }
      );
    } else {
      response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          temperature: 0.85,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json'
          },
          timeout: 30000
        }
      );
    }

    return parseResponse(response.data);
  });

  return { ...parsed, starRating };
}

module.exports = { generateReview, toStarRating, toSentimentLabel };
