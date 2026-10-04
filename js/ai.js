/**
 * MyDukaan24 — Real Online AI Business Advisor (Gemini 3.8 Flash)
 * Created & Deployed by Mayur Singh (Lucknow, India)
 * Architecture: Client -> Secure Netlify Serverless Backend (/api/gemini) -> Google Gemini 3.8 Flash
 */

class DukaanAIEngine {
  constructor() {
    this.modelName = "gemini-3.8-flash";
    this.chatHistory = [];
    this.lastFailedPrompt = null;
    this.isRequestInProgress = false;
  }

  // Generate structured real-time business context snapshot
  getLiveBusinessContext() {
    const db = DB.getData();
    const shop = db.shop || {};
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];

    const lowStockItems = products
      .filter(p => p.stock <= p.minStock)
      .map(p => `${p.name} (Stock: ${p.stock} ${p.unit}, Min: ${p.minStock}, Price: ₹${p.price})`);

    const customersWithDue = customers
      .filter(c => (c.balanceDue || 0) > 0)
      .map(c => `${c.name}: Due ₹${c.balanceDue} (Phone: ${c.phone})`);

    const totalRevenue = invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalPendingDues = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const recentBills = invoices.slice(0, 5).map(i => 
      `${i.id} (${i.date}): ₹${i.total} (${i.paymentMode}, ${i.status}) - Customer: ${i.customerName}`
    );

    return `
Store Information:
- Store Name: ${shop.name || 'MyDukaan24 Store'}
- Owner: ${shop.owner || 'Mayur Singh'}
- Location: ${shop.address || 'India'}
- GSTIN: ${shop.gstin || 'None'}
- UPI ID: ${shop.upiId || 'Not set'}

Real-time Financial Snapshot:
- Total Sales Recorded: ₹${totalRevenue.toLocaleString('en-IN')}
- Outstanding Customer Udhaar: ₹${totalPendingDues.toLocaleString('en-IN')}
- Total Operating Expenses: ₹${totalExpenses.toLocaleString('en-IN')}

Inventory Status (${products.length} Total SKUs):
- Low Stock or Out of Stock Items (${lowStockItems.length}):
  ${lowStockItems.length ? lowStockItems.join('\n  ') : 'All products have healthy stock levels.'}

Customer Udhaar Ledger:
- Customers with Unpaid Balances (${customersWithDue.length}):
  ${customersWithDue.length ? customersWithDue.join('\n  ') : 'Zero outstanding customer dues.'}

Recent Invoices:
  ${recentBills.length ? recentBills.join('\n  ') : 'No sales recorded yet.'}
`.trim();
  }

  // Open the Premium Full-Screen / Modal AI Chat Interface
  openChatModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="mydukaan-ai-modal" onclick="if(event.target === this) DukaanAI.closeModal()">
        <div class="modal-card ai-chat-modal-window">
          <!-- AI Header -->
          <div class="modal-header ai-modal-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="ai-avatar-badge">✨</div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 800; font-size: 16px; color: var(--text-primary);">MyDukaan24 AI</span>
                  <span class="badge badge-primary" style="font-size: 10px; font-weight: 700;">Gemini 3.8 Flash Online</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                  Live Real-Time Store Brain • Contextually Grounded
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="DukaanAI.clearHistory()" title="Clear Chat History">🗑️ Clear</button>
              <button class="topbar-icon-btn" onclick="DukaanAI.closeModal()">✕</button>
            </div>
          </div>

          <!-- Conversation Area -->
          <div id="ai-chat-thread" class="ai-chat-thread">
            ${!DB.getData().geminiKey ? `
              <!-- In-App API Key Setup Banner -->
              <div id="ai-key-setup-banner" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(59, 130, 246, 0.1)); border: 1px solid rgba(124, 58, 237, 0.35); border-radius: 12px; padding: 16px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--purple); font-size: 14px;">
                  <span>🔑</span>
                  <span>Connect Your Gemini API Key</span>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin: 6px 0 12px; line-height: 1.5;">
                  To unlock real online AI business advice, enter your Google Gemini API key. It is 100% free from Google AI Studio.
                </p>
                <div style="display: flex; gap: 8px;">
                  <input type="password" id="inline-gemini-key-input" class="form-input" style="height: 38px; font-size: 12.5px;" placeholder="Paste API key here (AIzaSy...)" />
                  <button class="btn btn-ai btn-sm" style="white-space: nowrap;" onclick="DukaanAI.saveInlineKey()">
                    Save & Activate
                  </button>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                  Don't have a key? <a href="https://aistudio.google.com" target="_blank" style="color: var(--primary); text-decoration: underline;">Get free key at aistudio.google.com</a>
                </div>
              </div>
            ` : ''}

            <!-- Greeting Message -->
            <div class="ai-msg-row ai">
              <div class="ai-msg-avatar">✨</div>
              <div class="ai-msg-bubble">
                <div style="font-weight: 700; margin-bottom: 4px; color: var(--purple);">Namaste! 🙏 Welcome to MyDukaan24 AI</div>
                <p>I am your dedicated store intelligence consultant. I have real-time access to your live inventory, customer Udhaar ledger, and sales records.</p>
                <p style="margin-top: 6px; font-size: 12px; color: var(--text-muted);">Ask me any business question or pick from the suggested prompts below:</p>
              </div>
            </div>
          </div>

          <!-- Suggested Quick Prompts -->
          <div class="ai-prompt-chips-row">
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Which products are low in stock and need reordering?')">
              📦 Low Stock Alert
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Who owes me the most money in pending Udhaar?')">
              ⏳ Pending Dues
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Give me a full business health summary of my shop today')">
              📊 Store Health Summary
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('What are 3 practical ways I can increase my profit margin this month?')">
              💡 Increase Margins
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Draft a polite WhatsApp reminder message for customers with pending dues')">
              📱 WhatsApp Due Draft
            </button>
          </div>

          <!-- Input Footer -->
          <div class="ai-input-footer">
            <textarea id="ai-chat-textarea" class="form-input ai-textarea" rows="1" placeholder="Ask anything about your stock, dues, margins, or sales..." onkeydown="DukaanAI.handleKeydown(event)"></textarea>
            <button id="ai-send-btn" class="btn btn-ai" onclick="DukaanAI.submitPrompt()">
              <span>Send</span>
              <span>➤</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Restore previous session conversation if any
    if (this.chatHistory.length) {
      this.renderHistory();
    }

    setTimeout(() => {
      const textarea = document.getElementById('ai-chat-textarea');
      if (textarea) textarea.focus();
    }, 120);
  }

  handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submitPrompt();
    }
  }

  askSuggested(text) {
    const input = document.getElementById('ai-chat-textarea');
    if (input) {
      input.value = text;
      this.submitPrompt();
    }
  }

  // Send Prompt to Online AI
  async submitPrompt(retryText = null) {
    if (this.isRequestInProgress) return;

    const input = document.getElementById('ai-chat-textarea');
    const promptText = (retryText || (input ? input.value : '')).trim();

    if (!promptText) return;

    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }

    this.lastFailedPrompt = promptText;
    this.isRequestInProgress = true;
    this.updateSendButtonState(true);

    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    // Append User Message to UI & History
    this.appendMessage('user', promptText);

    // Append Animated Typing Indicator
    const loaderId = `loader-${Date.now()}`;
    const loaderHtml = `
      <div id="${loaderId}" class="ai-msg-row ai">
        <div class="ai-msg-avatar">✨</div>
        <div class="ai-msg-bubble" style="display: flex; align-items: center; gap: 8px;">
          <div class="typing-dots-spinner">
            <span></span><span></span><span></span>
          </div>
          <span style="font-size: 12.5px; color: var(--text-muted);">Consulting Gemini 3.8 Flash Online...</span>
        </div>
      </div>
    `;
    thread.insertAdjacentHTML('beforeend', loaderHtml);
    thread.scrollTop = thread.scrollHeight;

    try {
      const storeContext = this.getLiveBusinessContext();
      const db = DB.getData();
      const clientApiKey = db.geminiKey ? db.geminiKey.trim() : "";

      let responseText = "";

      // 1. Attempt connection via Netlify Serverless Backend (/api/gemini)
      try {
        const netlifyResponse = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            storeContext: storeContext,
            apiKey: clientApiKey || undefined
          })
        });

        if (netlifyResponse.ok) {
          const result = await netlifyResponse.json();
          if (result && result.text) {
            responseText = result.text;
          } else if (result && result.error) {
            throw new Error(result.error);
          }
        } else {
          // If Netlify function returned a specific client error, parse it
          const errBody = await netlifyResponse.json().catch(() => ({}));
          if (errBody && errBody.error) {
            throw new Error(errBody.error);
          }
          throw new Error(`Netlify function returned status ${netlifyResponse.status}`);
        }
      } catch (backendErr) {
        console.warn('[Dukaan AI] Backend route unavailable, checking direct client connection:', backendErr.message);

        // 2. Direct client fallback for localhost / file:// testing if key is present
        if (clientApiKey) {
          responseText = await this.callGeminiDirect(promptText, storeContext, clientApiKey);
        } else {
          throw new Error(backendErr.message || 'No API key configured.');
        }
      }

      // Remove loader
      const loader = document.getElementById(loaderId);
      if (loader) loader.remove();

      // Append real AI response
      this.appendMessage('ai', responseText);
      this.lastFailedPrompt = null;

    } catch (error) {
      console.error('[Dukaan AI Error]', error);

      const loader = document.getElementById(loaderId);
      if (loader) loader.remove();

      this.renderErrorMessage(error.message || 'Unknown network error');
    } finally {
      this.isRequestInProgress = false;
      this.updateSendButtonState(false);
    }
  }

  // Direct client call to Gemini 3.8 Flash (Used when running in dev/preview without Netlify Functions)
  async callGeminiDirect(prompt, storeContext, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are "MyDukaan24 AI", an expert retail business advisor for small businesses and Kirana stores in India.
Always format currency in Indian Rupees (₹).
Keep answers structured, concise, and focused on business growth, inventory health, cash flow, and customer relationships.

Current Live Business Context:
${storeContext}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Google Gemini API returned status ${response.status}`);
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      throw new Error('Received an empty response from Gemini 3.8 Flash.');
    }

    return reply;
  }

  // Append user or AI message into UI & history
  appendMessage(role, text) {
    this.chatHistory.push({ role, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const isAi = role === 'ai';
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const formattedText = isAi ? this.formatMarkdown(text) : this.escapeHtml(text);

    const msgHtml = `
      <div class="ai-msg-row ${role}" id="${msgId}">
        <div class="ai-msg-avatar">${isAi ? '✨' : '👤'}</div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-text">${formattedText}</div>
          <div class="ai-msg-footer">
            <span style="font-size: 10px; color: var(--text-muted);">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ${isAi ? `
              <button class="ai-copy-btn" onclick="DukaanAI.copyText('${msgId}')" title="Copy reply">
                📋 Copy
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    thread.insertAdjacentHTML('beforeend', msgHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  // Display user-friendly error card with Retry & Settings CTAs
  renderErrorMessage(errorText) {
    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    let guidance = "";
    if (errorText.toLowerCase().includes('key') || errorText.toLowerCase().includes('unauthorized') || errorText.toLowerCase().includes('401')) {
      guidance = `
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
          <strong>How to fix:</strong> Get your free API key at 
          <a href="https://aistudio.google.com" target="_blank" style="color: var(--primary); text-decoration: underline;">aistudio.google.com</a>
          and paste it in <strong>Store Settings → AI Key</strong>, or configure <code>GEMINI_API_KEY</code> in Netlify Environment Variables.
        </div>
      `;
    }

    const errorHtml = `
      <div class="ai-msg-row ai">
        <div class="ai-msg-avatar" style="background: var(--danger-light); color: var(--danger);">⚠️</div>
        <div class="ai-msg-bubble" style="border-color: var(--danger-border); background: var(--bg-card);">
          <div style="font-weight: 700; color: var(--danger); font-size: 13.5px;">API Connection Error</div>
          <div style="font-size: 12.5px; color: var(--text-primary); margin-top: 4px;">${this.escapeHtml(errorText)}</div>
          ${guidance}
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            ${this.lastFailedPrompt ? `
              <button class="btn btn-primary btn-sm" onclick="DukaanAI.retryLastPrompt()">
                🔄 Retry Question
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="DukaanAI.closeModal(); App.navigate('settings');">
              ⚙️ Open AI Settings
            </button>
          </div>
        </div>
      </div>
    `;

    thread.insertAdjacentHTML('beforeend', errorHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  retryLastPrompt() {
    if (this.lastFailedPrompt) {
      this.submitPrompt(this.lastFailedPrompt);
    }
  }

  renderHistory() {
    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    // Preserve first greeting, render stored messages
    const stored = this.chatHistory;
    stored.forEach(msg => {
      const isAi = msg.role === 'ai';
      const msgId = `msg-hist-${Math.random().toString(36).substr(2, 6)}`;
      const formattedText = isAi ? this.formatMarkdown(msg.text) : this.escapeHtml(msg.text);

      thread.insertAdjacentHTML('beforeend', `
        <div class="ai-msg-row ${msg.role}" id="${msgId}">
          <div class="ai-msg-avatar">${isAi ? '✨' : '👤'}</div>
          <div class="ai-msg-bubble">
            <div class="ai-msg-text">${formattedText}</div>
            <div class="ai-msg-footer">
              <span style="font-size: 10px; color: var(--text-muted);">${msg.timestamp || ''}</span>
              ${isAi ? `<button class="ai-copy-btn" onclick="DukaanAI.copyText('${msgId}')">📋 Copy</button>` : ''}
            </div>
          </div>
        </div>
      `);
    });
    thread.scrollTop = thread.scrollHeight;
  }

  copyText(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const textEl = el.querySelector('.ai-msg-text');
    if (textEl) {
      navigator.clipboard.writeText(textEl.innerText || textEl.textContent)
        .then(() => App.toast('success', 'Copied!', 'AI response copied to clipboard'))
        .catch(() => {});
    }
  }

  clearHistory() {
    this.chatHistory = [];
    const thread = document.getElementById('ai-chat-thread');
    if (thread) {
      thread.innerHTML = `
        <div class="ai-msg-row ai">
          <div class="ai-msg-avatar">✨</div>
          <div class="ai-msg-bubble">
            <p>Chat history cleared. How can I assist your shop today?</p>
          </div>
        </div>
      `;
    }
    App.toast('info', 'Chat Cleared', 'Conversation history reset');
  }

  updateSendButtonState(isWaiting) {
    const btn = document.getElementById('ai-send-btn');
    if (!btn) return;
    btn.disabled = isWaiting;
    btn.innerHTML = isWaiting ? '<span>Thinking...</span>' : '<span>Send</span> <span>➤</span>';
  }

  formatMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: var(--bg-input); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/• /g, '•&nbsp;');
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  saveInlineKey() {
    const input = document.getElementById('inline-gemini-key-input');
    if (!input || !input.value.trim()) {
      App.toast('warning', 'Key Required', 'Please paste your Gemini API key');
      return;
    }
    const key = input.value.trim();
    const db = DB.getData();
    db.geminiKey = key;
    DB.saveData(db);

    const banner = document.getElementById('ai-key-setup-banner');
    if (banner) {
      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="color: var(--success); font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <span>✓</span> <span>Gemini 3.8 Flash Online Activated!</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">Ready to assist</span>
        </div>
      `;
      setTimeout(() => banner.remove(), 2500);
    }
    App.toast('success', 'Gemini AI Online!', 'Key saved successfully');
  }

  closeModal() {
    const el = document.getElementById('mydukaan-ai-modal');
    if (el) el.remove();
  }
}

window.DukaanAI = new DukaanAIEngine();
