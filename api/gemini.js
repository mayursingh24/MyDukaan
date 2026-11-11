/**
 * MyDukaan24 — Secure Vercel Serverless Backend for Gemini AI & Barcode Grounding
 * Uses the May 2026 Gemini Interactions REST API (v1beta/interactions)
 * Supports:
 * 1. Retail Advisor Chat (gemini-3.8-flash / fallback models)
 * 2. Real-time Google Search Grounded Barcode / EAN Lookup with JSON Schema
 * 3. Supports modern Google AI Studio keys (`AQ....` and `AIza...`) via x-goog-api-key
 * Created & Deployed by Mayur Singh (Lucknow, India)
 */

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';

function getTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function extractTextFromInteraction(data) {
  if (!data || typeof data !== 'object') return '';

  // 1. Convenience field if present
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  // 2. Current 2026 Interactions schema: steps array (type === 'model_output')
  if (Array.isArray(data.steps) && data.steps.length > 0) {
    const modelChunks = [];
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      if (!step) continue;
      if (step.type === 'model_output' || (!step.type && Array.isArray(step.content))) {
        if (typeof step.text === 'string' && step.text.trim()) {
          modelChunks.push(step.text);
        }
        if (Array.isArray(step.content)) {
          for (const part of step.content) {
            if (part && (part.type === 'text' || !part.type) && typeof part.text === 'string' && part.text.trim()) {
              modelChunks.push(part.text);
            }
          }
        }
      }
    }
    if (modelChunks.length > 0) {
      return modelChunks.join('\n').trim();
    }
  }

  // 3. Legacy Interactions schema fallback: outputs array
  if (Array.isArray(data.outputs) && data.outputs.length > 0) {
    const outputChunks = [];
    for (const out of data.outputs) {
      if (!out) continue;
      if ((out.type === 'text' || !out.type) && typeof out.text === 'string' && out.text.trim()) {
        outputChunks.push(out.text);
      }
      if (Array.isArray(out.content)) {
        for (const part of out.content) {
          if (part && typeof part.text === 'string' && part.text.trim()) {
            outputChunks.push(part.text);
          }
        }
      }
    }
    if (outputChunks.length > 0) {
      return outputChunks.join('\n').trim();
    }
  }

  // 4. Classic generateContent fallback shape
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const parts = data.candidates[0]?.content?.parts || [];
    const candText = parts.map(p => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean).join('\n').trim();
    if (candText) return candText;
  }

  return '';
}

function isAuthOrKeyError(status, errCode, errMsg) {
  const msg = String(errMsg || '').toLowerCase();
  const code = String(errCode || '').toUpperCase();
  if (status === 401 || status === 403) return true;
  if (code === 'UNAUTHENTICATED' || code === 'PERMISSION_DENIED') return true;
  if (
    msg.includes('api key') ||
    msg.includes('api_key') ||
    msg.includes('unauthenticated') ||
    msg.includes('unauthorized') ||
    msg.includes('permission denied') ||
    msg.includes('leaked') ||
    msg.includes('revoked') ||
    msg.includes('access_token_type_unsupported') ||
    msg.includes('credentials')
  ) {
    return true;
  }
  return false;
}

async function postInteraction(apiKey, payload, timeoutMs) {
  const response = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': API_REVISION
    },
    body: JSON.stringify(payload),
    signal: getTimeoutSignal(timeoutMs)
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function setResponseHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
}

function parseRequestBody(req) {
  const rawBody = req.body;
  if (rawBody === undefined || rawBody === null) return {};
  if (Buffer.isBuffer(rawBody)) {
    const text = rawBody.toString('utf8').trim();
    return text ? JSON.parse(text) : {};
  }
  if (typeof rawBody === 'string') {
    const text = rawBody.trim();
    return text ? JSON.parse(text) : {};
  }
  if (typeof rawBody === 'object') {
    return rawBody;
  }
  return {};
}

function extractJsonFromText(rawText) {
  let txt = String(rawText || '').trim();
  const codeBlockMatch = txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) txt = codeBlockMatch[1].trim();
  try {
    return JSON.parse(txt);
  } catch (e) {
    const braceMatch = txt.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (e2) {}
    }
  }
  return null;
}

const MODEL_CONFIGS = [
  { model: 'gemini-3.8-flash', thinking: 'low' },
  { model: 'gemini-3.5-flash-lite', thinking: 'minimal' },
  { model: 'gemini-3.1-flash-lite', thinking: 'minimal' }
];

async function executeInteraction({
  apiKey,
  systemInstruction,
  input,
  fallbackTextInput = null,
  tools = null,
  responseFormat = null,
  maxOutputTokens = 2048,
  startedAt,
  hardCapMs = 21000,
  remainingMs
}) {
  const attempts = [];
  let lastError = null;
  let lastStatus = 500;
  let lastIsAuth = false;

  for (const cfg of MODEL_CONFIGS) {
    if (Date.now() - startedAt > hardCapMs) break;
    const { model, thinking } = cfg;
    const perTryTimeout = Math.min(8000, remainingMs());

    try {
      const payload = {
        model,
        system_instruction: systemInstruction,
        input,
        generation_config: {
          thinking_level: thinking,
          max_output_tokens: maxOutputTokens
        },
        store: false
      };
      if (tools) payload.tools = tools;
      if (responseFormat) payload.response_format = responseFormat;

      let { response, data } = await postInteraction(apiKey, payload, perTryTimeout);

      // Retry without response_format/thinking_level if model rejects a combo with HTTP 400
      if (!response.ok && response.status === 400 && Date.now() - startedAt < hardCapMs - 1000) {
        const errText = String(data?.error?.message || '').toLowerCase();
        if (!errText.includes('api key')) {
          const retryPayload = {
            model,
            system_instruction: systemInstruction,
            input: fallbackTextInput || input,
            generation_config: {
              max_output_tokens: maxOutputTokens
            },
            store: false
          };
          if (tools && !responseFormat) retryPayload.tools = tools;
          const res2 = await postInteraction(apiKey, retryPayload, Math.min(6500, remainingMs()));
          response = res2.response;
          data = res2.data;
        }
      }

      if (response.ok && data?.status !== 'failed') {
        const text = extractTextFromInteraction(data);
        if (text) {
          return { ok: true, text, model, attempts };
        }
      }

      const errObj = data?.error || {};
      const errMsg = errObj.message || `Gemini API returned HTTP ${response.status}`;
      const authFail = isAuthOrKeyError(response.status, errObj.status || errObj.code, errMsg);
      lastError = errMsg;
      lastStatus = authFail ? (response.status === 403 ? 403 : 401) : (response.status || 500);
      lastIsAuth = authFail;
      attempts.push({ model, status: response.status, error: errMsg });

      if (authFail) break;
    } catch (err) {
      lastError = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'Gemini API request timed out.'
        : (err.message || 'Network error calling Gemini API.');
      lastStatus = 504;
      attempts.push({ model, status: 504, error: lastError });
    }
  }

  return { ok: false, lastError, lastStatus, lastIsAuth, attempts };
}

module.exports = async (req, res) => {
  setResponseHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const startedAt = Date.now();
  const remainingMs = () => Math.max(2000, 25000 - (Date.now() - startedAt));

  try {
    let body;
    try {
      body = parseRequestBody(req);
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON request body.' });
    }

    const {
      action,
      barcode,
      prompt,
      storeContext,
      imageBase64,
      mimeType,
      transcript,
      lang,
      catalogHints,
      velocitySummary,
      apiKey: clientApiKey
    } = body;

    const cleanAction = action || (barcode ? 'lookupBarcode' : 'ask');

    if (cleanAction === 'ask' && (!prompt || !String(prompt).trim())) {
      return res.status(400).json({ error: 'Prompt or action payload is required.' });
    }

    // Resolve API key: explicit client setting (if provided) -> Vercel environment variable
    const apiKey = (clientApiKey && String(clientApiKey).trim()) || (process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim()) || '';

    if (!apiKey) {
      return res.status(401).json({
        error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.',
        authError: true,
        status: 401,
        hint: 'Add an active GEMINI_API_KEY from aistudio.google.com/api-keys in Vercel Project Settings -> Environment Variables.'
      });
    }

    // -------------------------------------------------------------
    // BRANCH 1: Live Barcode & Google Search Grounding Lookup
    // -------------------------------------------------------------
    if (cleanAction === 'lookupBarcode') {
      const cleanBarcode = String(barcode || prompt || '').trim();
      if (!cleanBarcode) {
        return res.status(400).json({ error: 'Valid barcode is required.' });
      }

      const systemInstruction = `You are a precision Indian & Global FMCG / Retail Product Barcode Identifier for a Kirana POS system.
Search retail databases and the web to accurately identify consumer products by EAN-13, EAN-8, UPC-A, or GTIN.
If identified, determine realistic Indian Rupees (INR) MRP, retail selling price, approximate wholesale cost (~85% of price), GST tax slab (0, 5, 12, or 18), primary category (one of: Grocery, Snacks, Beverages, Dairy, Personal Care, Household, Stationary, Spices), unit (pack, pcs, bottle, kg, L, pouch, box), and one matching emoji.
Never invent a fake brand or fake product name when the barcode is unknown: set found=false cleanly if uncertain.`;

      const barcodePrompt = `Identify commercial retail product for barcode / EAN / GTIN: "${cleanBarcode}".
Return strictly valid JSON matching the requested schema.`;

      const barcodeSchema = {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            found: { type: 'boolean' },
            barcode: { type: 'string' },
            name: { type: 'string' },
            brand: { type: 'string' },
            cat: { type: 'string' },
            mrp: { type: 'number' },
            price: { type: 'number' },
            cost: { type: 'number' },
            gstRate: { type: 'number' },
            stock: { type: 'number' },
            unit: { type: 'string' },
            emoji: { type: 'string' }
          },
          required: ['found', 'barcode', 'name', 'brand', 'cat', 'mrp', 'price', 'cost', 'unit', 'emoji']
        }
      };

      const result = await executeInteraction({
        apiKey,
        systemInstruction,
        input: barcodePrompt,
        fallbackTextInput: `${barcodePrompt}\nReturn ONLY raw JSON with keys: found, barcode, name, brand, cat, mrp, price, cost, gstRate, stock, unit, emoji.`,
        tools: [{ type: 'google_search' }],
        responseFormat: barcodeSchema,
        maxOutputTokens: 2048,
        startedAt,
        remainingMs
      });

      if (!result.ok) {
        const finalStatus = result.lastIsAuth ? (result.lastStatus === 403 ? 403 : 401) : (result.lastStatus || 502);
        return res.status(finalStatus).json({
          error: result.lastError || 'Failed to lookup barcode via Gemini API.',
          authError: result.lastIsAuth,
          status: result.lastStatus,
          attempts: result.attempts,
          hint: result.lastIsAuth
            ? 'Server Gemini API key requires rotation in Google AI Studio and Vercel Environment Variables.'
            : 'Live Gemini barcode lookup could not complete right now. Check connection or retry.'
        });
      }

      const parsed = extractJsonFromText(result.text);
      if (parsed && parsed.found !== false && parsed.name && String(parsed.name).trim()) {
        const mrp = Number(parsed.mrp) || Number(parsed.price) || 20;
        const price = Number(parsed.price) || mrp || 20;
        const cost = Number(parsed.cost) || Math.round(price * 0.85);
        const stock = Number(parsed.stock) || 25;
        const allowedGst = [0, 5, 12, 18];
        const rawGst = Number(parsed.gstRate);
        const gstRate = allowedGst.includes(rawGst) ? rawGst : 5;

        return res.status(200).json({
          success: true,
          found: true,
          action: 'lookupBarcode',
          model: result.model,
          api: 'interactions',
          product: {
            barcode: cleanBarcode,
            name: String(parsed.name).trim(),
            brand: String(parsed.brand || '').trim(),
            cat: String(parsed.cat || 'Grocery').trim(),
            mrp,
            price,
            cost,
            gstRate,
            stock,
            unit: String(parsed.unit || 'pack').trim(),
            emoji: parsed.emoji || '📦'
          }
        });
      }

      return res.status(200).json({
        success: true,
        found: false,
        barcode: cleanBarcode,
        model: result.model,
        api: 'interactions',
        message: 'Product could not be identified by Gemini Search grounding.'
      });
    }

    // -------------------------------------------------------------
    // BRANCH 2: AI Wholesaler Bill Photo Scanner (Gemini Vision)
    // -------------------------------------------------------------
    if (cleanAction === 'scanPurchaseBill') {
      const cleanBase64 = String(imageBase64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
      const safeMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';

      if (!cleanBase64 || cleanBase64.length < 32) {
        return res.status(400).json({ error: 'Valid base64 bill image is required.' });
      }

      const safeHints = Array.isArray(catalogHints) ? catalogHints.slice(0, 180) : [];
      const systemInstruction = `You are a high-accuracy Indian Wholesaler / Distributor Invoice OCR & Stock Inward Extractor for a Kirana store.
Read the uploaded paper or printed invoice image carefully and extract vendor info, bill number, date (YYYY-MM-DD), payment mode (Credit, Cash, UPI, or Bank Transfer), total bill amount, and every line item cleanly.
Where an extracted item clearly matches an entry in the provided store catalogHints (by name, pack size, or barcode), set matchedProductId to that catalog id; otherwise leave matchedProductId as empty string "".
Compute accurate per-unit wholesale costRate (pre-tax or landed rate shown on bill), suggested retail sellingPrice (>= costRate), MRP if printed, GST % slab (0, 5, 12, or 18), and expiryDate (YYYY-MM-DD if printed, else "").
Return ONLY valid JSON.`;

      const billPromptText = `Extract all line items and header details from this wholesaler invoice image.
Existing store catalog for matching (id | name | unit | currentCost | price):
${safeHints.map(h => `${h.id} | ${h.name} | ${h.unit || 'pack'} | ₹${h.cost || 0} | ₹${h.price || 0}`).join('\n') || '(empty catalog)'}`;

      const billSchema = {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            supplierName: { type: 'string' },
            billNo: { type: 'string' },
            billDate: { type: 'string' },
            paymentMode: { type: 'string' },
            totalAmount: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rawName: { type: 'string' },
                  matchedProductId: { type: 'string' },
                  qty: { type: 'number' },
                  unit: { type: 'string' },
                  costRate: { type: 'number' },
                  mrp: { type: 'number' },
                  sellingPrice: { type: 'number' },
                  gstRate: { type: 'number' },
                  expiryDate: { type: 'string' },
                  lineTotal: { type: 'number' }
                },
                required: ['rawName', 'qty', 'costRate']
              }
            }
          },
          required: ['supplierName', 'items']
        }
      };

      const multimodalInput = [
        { type: 'text', text: billPromptText },
        { type: 'image', data: cleanBase64, mime_type: safeMime }
      ];

      const result = await executeInteraction({
        apiKey,
        systemInstruction,
        input: multimodalInput,
        fallbackTextInput: [
          {
            type: 'text',
            text: `${billPromptText}\nReturn ONLY raw JSON object with keys: supplierName, billNo, billDate, paymentMode, totalAmount, items[{rawName, matchedProductId, qty, unit, costRate, mrp, sellingPrice, gstRate, expiryDate, lineTotal}].`
          },
          { type: 'image', data: cleanBase64, mime_type: safeMime }
        ],
        responseFormat: billSchema,
        maxOutputTokens: 4096,
        startedAt,
        remainingMs
      });

      if (!result.ok) {
        const finalStatus = result.lastIsAuth ? (result.lastStatus === 403 ? 403 : 401) : (result.lastStatus || 502);
        return res.status(finalStatus).json({
          error: result.lastError || 'Failed to read invoice image with Gemini Vision.',
          authError: result.lastIsAuth,
          status: result.lastStatus,
          attempts: result.attempts
        });
      }

      const parsed = extractJsonFromText(result.text);
      if (!parsed || !Array.isArray(parsed.items)) {
        return res.status(422).json({
          error: 'Gemini returned unreadable invoice structure. Please crop the bill tightly and retry.',
          raw: result.text.slice(0, 400)
        });
      }

      const allowedGst = [0, 5, 12, 18];
      const normalizedItems = parsed.items
        .filter(it => it && (it.rawName || it.name) && Number(it.qty) > 0)
        .map(it => {
          const qty = Math.round((Number(it.qty) || 1) * 1000) / 1000;
          const costRate = Math.round((Number(it.costRate) || 0) * 100) / 100;
          const mrp = Math.round((Number(it.mrp) || costRate * 1.2 || 0) * 100) / 100;
          const sellingPrice = Math.round((Number(it.sellingPrice) || mrp || costRate * 1.15 || 0) * 100) / 100;
          const rawGst = Number(it.gstRate);
          const gstRate = allowedGst.includes(rawGst) ? rawGst : 5;
          const lineTotal = Math.round((Number(it.lineTotal) || qty * costRate) * 100) / 100;
          return {
            rawName: String(it.rawName || it.name).trim(),
            matchedProductId: String(it.matchedProductId || '').trim(),
            qty,
            unit: String(it.unit || 'pack').trim(),
            costRate,
            mrp,
            sellingPrice,
            gstRate,
            expiryDate: String(it.expiryDate || '').trim().slice(0, 10),
            lineTotal
          };
        });

      const computedTotal = normalizedItems.reduce((s, i) => s + i.lineTotal, 0);

      return res.status(200).json({
        success: true,
        action: 'scanPurchaseBill',
        model: result.model,
        api: 'interactions',
        bill: {
          supplierName: String(parsed.supplierName || 'Wholesale Supplier').trim(),
          billNo: String(parsed.billNo || '').trim(),
          billDate: String(parsed.billDate || '').trim().slice(0, 10),
          paymentMode: ['Credit', 'Cash', 'UPI', 'Bank Transfer'].includes(parsed.paymentMode) ? parsed.paymentMode : 'Credit',
          totalAmount: Math.round((Number(parsed.totalAmount) || computedTotal) * 100) / 100,
          items: normalizedItems
        }
      });
    }

    // -------------------------------------------------------------
    // BRANCH 3: Multilingual Voice Cart Parser (All Indian & Global Scripts)
    // -------------------------------------------------------------
    if (cleanAction === 'parseVoiceCart') {
      const spoken = String(transcript || prompt || '').trim();
      if (!spoken) {
        return res.status(400).json({ error: 'Voice transcript is required.' });
      }

      const safeHints = Array.isArray(catalogHints) ? catalogHints.slice(0, 220) : [];
      const spokenLang = String(lang || 'auto').trim();
      const systemInstruction = `You are a multilingual Indian Kirana Voice Billing NLU assistant.
Translate and match customer orders spoken or typed in ANY language or script — including Hindi Devanagari (मैगी, बासमती चावल, आटा, मक्खन, तेल, चाय, दाल, दूध, कोलगेट, सर्फ, डेटॉल), Hinglish, Marathi, Bengali, Gujarati, Tamil, Telugu, Kannada, Malayalam, Punjabi, Urdu, Odia, Assamese, Nepali, or English — strictly against the provided catalogHints.
Handle Indic & Arabic digits (०१२३...) and Indian quantity idioms accurately:
- एक/ek=1, दो/do=2, तीन/teen=3, चार/char=4, पाँच/paanch=5, छह/chhah=6, सात/saat=7, आठ/aath=8, नौ/nau=9, दस/das=10
- आधा/aadha/half kilo or 500g/500ml for loose kg/litre SKUs -> qty: 0.5
- पाव/pav/pao or 250g/250ml for loose kg/litre SKUs -> qty: 0.25
- सवा/sawa=1.25, डेढ़/dedh=1.5, ढाई/dhai=2.5
- Never convert pack weight printed inside SKU title (e.g. "2 पैकेट मैगी" or "2 Maggi 70g") to 0.07; return qty: 2.
Put any phrase that genuinely matches no catalog SKU into unmatched[]. Return strictly valid JSON.`;

      const voicePrompt = `Language hint: ${spokenLang}
Spoken order: "${spoken}"
Store Catalog (id | name | unit | price):
${safeHints.map(h => `${h.id} | ${h.name} | ${h.unit || 'pack'} | ₹${h.price || 0}`).join('\n')}`;

      const voiceSchema = {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  matchedName: { type: 'string' },
                  spokenText: { type: 'string' },
                  qty: { type: 'number' }
                },
                required: ['productId', 'qty']
              }
            },
            unmatched: { type: 'array', items: { type: 'string' } },
            note: { type: 'string' }
          },
          required: ['items']
        }
      };

      const result = await executeInteraction({
        apiKey,
        systemInstruction,
        input: voicePrompt,
        fallbackTextInput: `${voicePrompt}\nReturn ONLY raw JSON: {"items":[{"productId":"...","matchedName":"...","spokenText":"...","qty":1}],"unmatched":[],"note":""}`,
        responseFormat: voiceSchema,
        maxOutputTokens: 1536,
        startedAt,
        remainingMs
      });

      if (!result.ok) {
        const finalStatus = result.lastIsAuth ? (result.lastStatus === 403 ? 403 : 401) : (result.lastStatus || 502);
        return res.status(finalStatus).json({
          error: result.lastError || 'Failed to parse voice order via Gemini API.',
          authError: result.lastIsAuth,
          status: result.lastStatus,
          attempts: result.attempts
        });
      }

      const parsed = extractJsonFromText(result.text) || {};
      const validIds = new Set(safeHints.map(h => String(h.id)));
      const cleanItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .filter(i => i && validIds.has(String(i.productId)) && Number(i.qty) > 0)
        .map(i => ({
          productId: String(i.productId),
          matchedName: String(i.matchedName || '').trim(),
          spokenText: String(i.spokenText || '').trim(),
          qty: Math.round(Number(i.qty) * 1000) / 1000
        }));

      return res.status(200).json({
        success: true,
        action: 'parseVoiceCart',
        model: result.model,
        api: 'interactions',
        result: {
          items: cleanItems,
          unmatched: Array.isArray(parsed.unmatched) ? parsed.unmatched.map(String) : [],
          note: String(parsed.note || '').trim()
        }
      });
    }

    // -------------------------------------------------------------
    // BRANCH 4: Smart Auto-Restock & Demand Prediction
    // -------------------------------------------------------------
    if (cleanAction === 'predictRestock') {
      const systemInstruction = `You are a Kirana Supply Chain & Demand Forecasting AI Advisor for India.
Given 30-day SKU sales velocity metrics and current stock levels, give crisp, practical restock advice in Hinglish/English using INR (₹). Prioritize items close to stockout, festival/season staple demand, and margin optimization.`;

      const restockInput = `${prompt || 'Provide smart restock and demand predictions based on the store sales velocity data below.'}

Velocity & Inventory Telemetry:
${velocitySummary || storeContext || 'No telemetry provided.'}`;

      const result = await executeInteraction({
        apiKey,
        systemInstruction,
        input: restockInput,
        maxOutputTokens: 2048,
        startedAt,
        remainingMs
      });

      if (!result.ok) {
        const finalStatus = result.lastIsAuth ? (result.lastStatus === 403 ? 403 : 401) : (result.lastStatus || 502);
        return res.status(finalStatus).json({
          error: result.lastError || 'Failed to generate demand forecast.',
          authError: result.lastIsAuth,
          status: result.lastStatus,
          attempts: result.attempts
        });
      }

      return res.status(200).json({
        success: true,
        action: 'predictRestock',
        text: result.text,
        model: result.model,
        api: 'interactions'
      });
    }

    // -------------------------------------------------------------
    // BRANCH 5: Standard Retail Advisor Chat
    // -------------------------------------------------------------
    const systemInstruction = `You are "MyDukaan24 AI", an expert retail business advisor for small businesses and Kirana stores in India.
You provide intelligent, actionable, practical, and culturally relevant advice in the user's language (English, Hindi, or Hinglish matching the user's prompt).
Always format currency in Indian Rupees (₹).
Keep answers structured, concise, accurate to the provided live store numbers, and focused on business growth, inventory health, cash flow, and customer relationships.

Current Live Business Context:
${storeContext || 'No store data provided.'}`;

    const result = await executeInteraction({
      apiKey,
      systemInstruction,
      input: String(prompt).trim(),
      maxOutputTokens: 2560,
      startedAt,
      remainingMs
    });

    if (!result.ok) {
      const finalStatus = result.lastIsAuth ? (result.lastStatus === 403 ? 403 : 401) : (result.lastStatus || 502);
      return res.status(finalStatus).json({
        error: result.lastError || 'Failed to get response from Gemini API.',
        authError: result.lastIsAuth,
        status: result.lastStatus,
        attempts: result.attempts,
        hint: result.lastIsAuth
          ? 'Your Gemini API key was rejected or revoked. Generate a fresh active key in Google AI Studio (aistudio.google.com/api-keys).'
          : 'Unable to reach Gemini Interactions API right now. Please retry.'
      });
    }

    return res.status(200).json({
      success: true,
      text: result.text,
      model: result.model,
      api: 'interactions'
    });
  } catch (err) {
    console.error('[Vercel Function Error]', err);
    return res.status(500).json({
      error: `Serverless Function Error: ${err.message}`
    });
  }
};
