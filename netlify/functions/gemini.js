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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
      const errorMessage = data.error?.message || `Google API error (Status ${response.status})`;
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errorMessage })
      };
    }

    const candidate = data.candidates?.[0];
    const generatedText = candidate?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gemini model returned an empty response. Please try again.' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        text: generatedText,
        model: 'gemini-3.8-flash'
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
