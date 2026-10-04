/**
 * MyDukaan24 — Secure Serverless Backend for Gemini AI & Barcode Grounding
 * Supports:
 * 1. Retail Advisor Chat (Gemini 2.5 Flash / 3.8 Flash)
 * 2. Real-time Google & Web Barcode / EAN Lookup with Structured JSON Extraction
 * Created & Deployed by Mayur Singh (Lucknow, India)
 */

exports.handler = async (event, context) => {
  // Handle CORS Preflight
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, barcode, prompt, storeContext, apiKey: clientApiKey } = body;

    const isBarcodeLookup = action === 'lookupBarcode' || Boolean(barcode);

    if (!isBarcodeLookup && !prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt or barcode is required.' })
      };
    }

    // Resolve API key: Priority: Server Environment Variable -> Client-provided key
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;

    if (!apiKey) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'No Gemini API Key found. Configure GEMINI_API_KEY in your Netlify Environment Variables or enter it in MyDukaan24 Settings.'
        })
      };
    }

    // Candidate models in preference order (gemini-2.5-flash first for high stability & capacity, plus fallbacks)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-3.8-flash'];
    let lastError = null;
    let successfulResult = null;

    // -------------------------------------------------------------
    // BRANCH A: Live Barcode & Google Grounding Product Lookup
    // -------------------------------------------------------------
    if (isBarcodeLookup) {
      const cleanBarcode = String(barcode || prompt).trim();
      const barcodePrompt = `Search Google and retail barcode databases for product barcode/EAN-13/GTIN: "${cleanBarcode}".
In India and global consumer retail (FMCG, groceries, packaged foods, personal care, electronics, stationery, snacks, beverages):
1. Identify the exact commercial product name and variant (with net quantity / weight if applicable).
2. Identify brand name and primary retail category.
3. Determine realistic MRP in Indian Rupees (₹), standard retail selling price in INR, wholesale cost, and single matching emoji icon.

Respond ONLY with a strict, valid JSON object in this exact schema (no prose, no explanation, only raw JSON):
{
  "found": true,
  "barcode": "${cleanBarcode}",
  "name": "Exact Product Name & Variant (e.g. Parle-G Gold Biscuits 100g)",
  "brand": "Brand Name (e.g. Parle)",
  "cat": "Category (Grocery / Snacks / Beverages / Dairy / Personal Care / Household / Stationary / Spices)",
  "mrp": 20,
  "price": 20,
  "cost": 17,
  "stock": 25,
  "unit": "pack",
  "emoji": "🍪"
}

If no commercial product can be identified with reasonable certainty for barcode "${cleanBarcode}", return:
{
  "found": false,
  "barcode": "${cleanBarcode}",
  "name": "",
  "brand": "",
  "cat": "Grocery",
  "mrp": 0,
  "price": 0,
  "cost": 0,
  "stock": 20,
  "unit": "pack",
  "emoji": "📦"
}`;

      for (const model of modelsToTry) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          // Try first with Google Search grounding tool
          let payload = {
            contents: [
              {
                role: 'user',
                parts: [{ text: barcodePrompt }]
              }
            ],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500
            }
          };

          let response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          // If tools cause an error (e.g. 400 bad request or unsupported tool), retry without tools
          if (!response.ok && response.status === 400) {
            delete payload.tools;
            response = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }

          const data = await response.json();

          if (response.ok) {
            const candidate = data.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;
            if (text) {
              successfulResult = { text, model };
              break;
            }
          }

          const errMsg = data.error?.message || `Google API error (Status ${response.status})`;
          lastError = errMsg;

          if (data.error?.status === 'INVALID_ARGUMENT' && errMsg.toLowerCase().includes('api key')) {
            lastError = 'Invalid Gemini API Key. Please verify your key at aistudio.google.com';
            break;
          }
          if (response.status === 401 || response.status === 403) {
            lastError = errMsg || 'API key unauthorized. Please check your credentials.';
            break;
          }

          console.warn(`[Barcode Failover] Model ${model} returned status ${response.status} (${errMsg}). Switching...`);
        } catch (err) {
          lastError = err.message;
        }
      }

      if (!successfulResult) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: lastError || 'Failed to lookup barcode via Gemini.' })
        };
      }

      // Parse JSON from result
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

      if (parsed && parsed.found !== false && parsed.name) {
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
            product: {
              barcode: cleanBarcode,
              name: String(parsed.name).trim(),
              brand: String(parsed.brand || '').trim(),
              cat: String(parsed.cat || 'Grocery').trim(),
              mrp: mrp,
              price: price,
              cost: cost,
              stock: stock,
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
          message: 'Product could not be identified automatically.'
        })
      };
    }

    // -------------------------------------------------------------
    // BRANCH B: Standard Retail Advisor Chat
    // -------------------------------------------------------------
    const systemInstruction = `You are "MyDukaan24 AI", an expert retail business advisor for small businesses and Kirana stores in India.
You provide intelligent, actionable, practical, and culturally relevant advice for local shopkeepers.
Always format currency in Indian Rupees (₹).
Keep answers structured, concise, and focused on business growth, inventory health, cash flow, and customer relationships.

Current Live Business Context:
${storeContext || 'No store data provided.'}`;

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemInstruction}\n\nUser Question: ${prompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        };

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          const candidate = data.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;
          if (text) {
            successfulResult = { text, model };
            break;
          }
        }

        const errMsg = data.error?.message || `Google API error (Status ${response.status})`;
        lastError = errMsg;

        // Abort ONLY if the API key itself is fundamentally invalid
        if (data.error?.status === 'INVALID_ARGUMENT' && errMsg.toLowerCase().includes('api key')) {
          lastError = 'Invalid Gemini API Key. Please verify your key at aistudio.google.com';
          break;
        }
        if (response.status === 401 || response.status === 403) {
          lastError = errMsg || 'API key unauthorized. Please check your credentials.';
          break;
        }

        console.warn(`[Gemini Failover] Model ${model} returned status ${response.status} (${errMsg}). Switching to next model...`);
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!successfulResult) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: lastError || 'Failed to get response from Gemini API.' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        text: successfulResult.text,
        model: successfulResult.model
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
