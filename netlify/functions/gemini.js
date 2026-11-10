/**
 * MyDukaan24 — Secure Serverless Backend for Gemini AI & Barcode Grounding
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  const startedAt = Date.now();
  const remainingMs = () => Math.max(1500, 9200 - (Date.now() - startedAt));

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, barcode, prompt, storeContext, apiKey: clientApiKey } = body;
    const isBarcodeLookup = action === 'lookupBarcode' || Boolean(barcode);

    if (!isBarcodeLookup && (!prompt || !String(prompt).trim())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt or barcode is required.' })
      };
    }

    // Resolve API key: explicit client setting (if user set one) -> Netlify environment variable
    const apiKey = (clientApiKey && String(clientApiKey).trim()) || (process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim()) || '';

    if (!apiKey) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in Netlify Environment Variables or Copilot Settings.',
          authError: true,
          status: 401,
          hint: 'Create an API key at aistudio.google.com/api-keys and add it to Netlify Environment Variables or click "🔑 Set Key".'
        })
      };
    }

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
    const attempts = [];
    let lastError = null;
    let lastStatus = 500;
    let lastIsAuth = false;
    let successfulResult = null;

    // -------------------------------------------------------------
    // BRANCH A: Live Barcode & Google Search Grounding Product Lookup
    // -------------------------------------------------------------
    if (isBarcodeLookup) {
      const cleanBarcode = String(barcode || prompt || '').trim();
      if (!cleanBarcode) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Valid barcode is required.' })
        };
      }

      const systemInstruction = `You are a precision Indian & Global FMCG / Retail Product Barcode Identifier for a Kirana POS system.
Search retail databases and the web to accurately identify consumer products by EAN-13, EAN-8, UPC-A, or GTIN.
If identified, determine realistic Indian Rupees (INR) MRP, retail selling price, approximate wholesale cost (~85% of price), primary category (one of: Grocery, Snacks, Beverages, Dairy, Personal Care, Household, Stationary, Spices), unit (pack, pcs, bottle, kg, L, pouch, box), and one matching emoji.
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
            stock: { type: 'number' },
            unit: { type: 'string' },
            emoji: { type: 'string' }
          },
          required: ['found', 'barcode', 'name', 'brand', 'cat', 'mrp', 'price', 'cost', 'unit', 'emoji']
        }
      };

      for (const model of modelsToTry) {
        if (Date.now() - startedAt > 7800) break;
        const perTryTimeout = Math.min(5800, remainingMs());

        try {
          // Attempt 1: Google Search grounding + structured JSON response_format
          let payload = {
            model,
            system_instruction: systemInstruction,
            input: barcodePrompt,
            tools: [{ type: 'google_search' }],
            response_format: barcodeSchema,
            generation_config: {
              thinking_level: 'low',
              max_output_tokens: 1536
            },
            store: false
          };

          let { response, data } = await postInteraction(apiKey, payload, perTryTimeout);

          // Attempt 2: Some models disallow combining tools + response_format; retry without response_format
          if (!response.ok && response.status === 400 && Date.now() - startedAt < 7500) {
            const errText = String(data?.error?.message || '').toLowerCase();
            if (!errText.includes('api key')) {
              const fallbackPayload = {
                model,
                system_instruction: systemInstruction,
                input: `${barcodePrompt}\nReturn ONLY raw JSON with keys: found, barcode, name, brand, cat, mrp, price, cost, stock, unit, emoji.`,
                tools: [{ type: 'google_search' }],
                generation_config: {
                  thinking_level: 'low',
                  max_output_tokens: 1536
                },
                store: false
              };
              const res2 = await postInteraction(apiKey, fallbackPayload, Math.min(4500, remainingMs()));
              response = res2.response;
              data = res2.data;
            }
          }

          // Attempt 3: Retry minimal payload without tools if 400 persists
          if (!response.ok && response.status === 400 && Date.now() - startedAt < 7500) {
            const errText = String(data?.error?.message || '').toLowerCase();
            if (!errText.includes('api key')) {
              const minimalPayload = {
                model,
                system_instruction: systemInstruction,
                input: `${barcodePrompt}\nReturn ONLY raw JSON with keys: found, barcode, name, brand, cat, mrp, price, cost, stock, unit, emoji.`,
                generation_config: {
                  max_output_tokens: 1024
                },
                store: false
              };
              const res3 = await postInteraction(apiKey, minimalPayload, Math.min(3500, remainingMs()));
              response = res3.response;
              data = res3.data;
            }
          }

          if (response.ok && data?.status !== 'failed') {
            const text = extractTextFromInteraction(data);
            if (text) {
              successfulResult = { text, model };
              break;
            }
          }

          const errObj = data?.error || {};
          const errMsg = errObj.message || `Gemini API returned HTTP ${response.status}`;
          const authFail = isAuthOrKeyError(response.status, errObj.status || errObj.code, errMsg);
          lastError = errMsg;
          lastStatus = authFail ? (response.status === 403 ? 403 : 401) : (response.status || 500);
          lastIsAuth = authFail;
          attempts.push({ model, status: response.status, error: errMsg });

          if (authFail) {
            break;
          }
        } catch (err) {
          lastError = err.name === 'TimeoutError' || err.name === 'AbortError'
            ? 'Gemini API request timed out.'
            : (err.message || 'Network error calling Gemini API.');
          lastStatus = 504;
          attempts.push({ model, status: 504, error: lastError });
        }
      }

      if (!successfulResult) {
        return {
          statusCode: lastIsAuth ? (lastStatus === 403 ? 403 : 401) : (lastStatus || 502),
          headers,
          body: JSON.stringify({
            error: lastError || 'Failed to lookup barcode via Gemini API.',
            authError: lastIsAuth,
            status: lastStatus,
            attempts,
            hint: lastIsAuth
              ? 'Your Gemini API key was rejected or revoked. Generate a fresh key in Google AI Studio (aistudio.google.com/api-keys) and update Netlify Environment Variables or click "🔑 Set Key".'
              : 'Live Gemini barcode lookup could not complete right now. Check connection or retry.'
          })
        };
      }

      let rawText = successfulResult.text.trim();
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch) {
        rawText = codeBlockMatch[1].trim();
      }

      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        const braceMatch = rawText.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try { parsed = JSON.parse(braceMatch[0]); } catch (e2) {}
        }
      }

      if (parsed && parsed.found !== false && parsed.name && String(parsed.name).trim()) {
        const mrp = Number(parsed.mrp) || Number(parsed.price) || 20;
        const price = Number(parsed.price) || mrp || 20;
        const cost = Number(parsed.cost) || Math.round(price * 0.85);
        const stock = Number(parsed.stock) || 25;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            found: true,
            action: 'lookupBarcode',
            model: successfulResult.model,
            api: 'interactions',
            product: {
              barcode: cleanBarcode,
              name: String(parsed.name).trim(),
              brand: String(parsed.brand || '').trim(),
              cat: String(parsed.cat || 'Grocery').trim(),
              mrp,
              price,
              cost,
              stock,
              unit: String(parsed.unit || 'pack').trim(),
              emoji: parsed.emoji || '📦'
            }
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          found: false,
          barcode: cleanBarcode,
          model: successfulResult.model,
          api: 'interactions',
          message: 'Product could not be identified by Gemini Search grounding.'
        })
      };
    }

    // -------------------------------------------------------------
    // BRANCH B: Standard Retail Advisor Chat
    // -------------------------------------------------------------
    const systemInstruction = `You are "MyDukaan24 AI", an expert retail business advisor for small businesses and Kirana stores in India.
You provide intelligent, actionable, practical, and culturally relevant advice in the user's language (English, Hindi, or Hinglish matching the user's prompt).
Always format currency in Indian Rupees (₹).
Keep answers structured, concise, accurate to the provided live store numbers, and focused on business growth, inventory health, cash flow, and customer relationships.

Current Live Business Context:
${storeContext || 'No store data provided.'}`;

    for (const model of modelsToTry) {
      if (Date.now() - startedAt > 7800) break;
      const perTryTimeout = Math.min(5800, remainingMs());

      try {
        let payload = {
          model,
          system_instruction: systemInstruction,
          input: String(prompt).trim(),
          generation_config: {
            thinking_level: 'low',
            max_output_tokens: 2048
          },
          store: false
        };

        let { response, data } = await postInteraction(apiKey, payload, perTryTimeout);

        // Retry without thinking_level if model rejects it with 400
        if (!response.ok && response.status === 400 && Date.now() - startedAt < 7500) {
          const errText = String(data?.error?.message || '').toLowerCase();
          if (!errText.includes('api key')) {
            const simplerPayload = {
              model,
              system_instruction: systemInstruction,
              input: String(prompt).trim(),
              generation_config: {
                max_output_tokens: 2048
              },
              store: false
            };
            const res2 = await postInteraction(apiKey, simplerPayload, Math.min(4500, remainingMs()));
            response = res2.response;
            data = res2.data;
          }
        }

        if (response.ok && data?.status !== 'failed') {
          const text = extractTextFromInteraction(data);
          if (text) {
            successfulResult = { text, model };
            break;
          }
        }

        const errObj = data?.error || {};
        const errMsg = errObj.message || `Gemini API returned HTTP ${response.status}`;
        const authFail = isAuthOrKeyError(response.status, errObj.status || errObj.code, errMsg);
        lastError = errMsg;
        lastStatus = authFail ? (response.status === 403 ? 403 : 401) : (response.status || 500);
        lastIsAuth = authFail;
        attempts.push({ model, status: response.status, error: errMsg });

        if (authFail) {
          break;
        }
      } catch (err) {
        lastError = err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'Gemini API request timed out.'
          : (err.message || 'Network error calling Gemini API.');
        lastStatus = 504;
        attempts.push({ model, status: 504, error: lastError });
      }
    }

    if (!successfulResult) {
      return {
        statusCode: lastIsAuth ? (lastStatus === 403 ? 403 : 401) : (lastStatus || 502),
        headers,
        body: JSON.stringify({
          error: lastError || 'Failed to get response from Gemini API.',
          authError: lastIsAuth,
          status: lastStatus,
          attempts,
          hint: lastIsAuth
            ? 'Your Gemini API key was rejected or revoked. Generate a fresh active key in Google AI Studio (aistudio.google.com/api-keys) — note: both AQ. and AIza keys are supported, but keys exposed in screenshots are auto-revoked by Google.'
            : 'Unable to reach Gemini Interactions API right now. Please retry.'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        text: successfulResult.text,
        model: successfulResult.model,
        api: 'interactions'
      })
    };
  } catch (err) {
    console.error('[Netlify Function Error]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: `Serverless Function Error: ${err.message}`
      })
    };
  }
};
