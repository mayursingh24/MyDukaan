/**
 * MyDukaan24 — Secure Serverless Backend for Gemini 3.8 Flash AI
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
    const { prompt, storeContext, apiKey: clientApiKey } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt is required.' })
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

    // Build the system prompt with live store context
    const systemInstruction = `You are "MyDukaan24 AI", an expert retail business advisor for small businesses and Kirana stores in India.
You provide intelligent, actionable, practical, and culturally relevant advice for local shopkeepers.
Always format currency in Indian Rupees (₹).
Keep answers structured, concise, and focused on business growth, inventory health, cash flow, and customer relationships.

Current Live Business Context:
${storeContext || 'No store data provided.'}`;

    // Candidate models in preference order (gemini-2.5-flash first for high stability & capacity, plus fallbacks)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-3.8-flash'];
    let lastError = null;
    let successfulResult = null;

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

        // On 503 (High demand / Overloaded), 429 (Rate limit), 404 (Not found), or 500:
        // Automatically try next model in list!
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
