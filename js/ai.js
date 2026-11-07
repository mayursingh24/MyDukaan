/**
 * MyDukkan24 — Real Online AI Business Advisor (Google Gemini Engine)
 * Pure Serverless Architecture: Client -> Netlify Functions (/api/gemini) -> Google Gemini API.
 * Secure: Zero client-side API key exposure. Read from Netlify Environment Variables.
 */

class DukaanAIEngine {
  constructor() {
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
      .map(p => `${p.name} (Stock: ${p.stock} ${p.unit || 'unit'}, Min Alert: ${p.minStock}, Price: ₹${p.price})`);

    const customersWithDue = customers
      .filter(c => (c.balanceDue || 0) > 0)
      .map(c => `${c.name}: Due ₹${c.balanceDue} (Phone: ${c.phone})`);

    const totalRevenue = invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalPendingDues = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    return `
Store Information:
- Store Name: ${shop.name || 'MyDukkan24 Mart'}
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
`.trim();
  }

  // Open the Premium AI Copilot Interface
  openChatModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="mydukaan-ai-modal" onclick="if(event.target === this) DukaanAI.closeModal()">
        <div class="modal-card ai-chat-modal-window">
          <!-- AI Header -->
          <div class="modal-header ai-modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="ai-avatar-badge" style="color: #60A5FA; display: flex;">
                ${Icons.sparkles(18)}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; font-size: 15px; color: var(--text-primary);">Dukkan Copilot AI</span>
                  <span class="badge badge-primary">Netlify Serverless</span>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Grounded in real-time store inventory, sales & udhaar ledger
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="DukaanAI.clearHistory()" title="Clear Chat History">Clear</button>
              <button class="topbar-icon-btn" onclick="DukaanAI.closeModal()">✕</button>
            </div>
          </div>

          <!-- Conversation Thread -->
          <div id="ai-chat-thread" class="ai-chat-thread">
            <!-- Initial Greeting -->
            <div class="ai-msg-row ai">
              <div class="ai-msg-avatar">${Icons.sparkles(16)}</div>
              <div class="ai-msg-bubble">
                <div style="font-weight: 600; margin-bottom: 4px; color: var(--primary);">Hello! Welcome to Dukkan Copilot.</div>
                <p>I have live visibility into your store's stock levels, pending customer credit, and recent sales.</p>
                <p style="margin-top: 6px; font-size: 12px; color: var(--text-muted);">Select a quick question below or ask me anything:</p>
              </div>
            </div>
          </div>

          <!-- Suggested Quick Prompts -->
          <div class="ai-prompt-chips-row">
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Which products are low in stock and need reordering before tomorrow?')">
              Low Stock Alert
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Who owes me the most money in pending Udhaar and what is their phone number?')">
              Top Debtors
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Give me an executive business health summary of my store today')">
              Store Health Summary
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('What are 3 practical ways I can increase my net profit margin this month?')">
              Increase Profit Margin
            </button>
            <button class="cat-chip" onclick="DukaanAI.askSuggested('Draft a polite WhatsApp reminder message for customers with pending dues')">
              WhatsApp Due Message
            </button>
          </div>

          <!-- Input Footer -->
          <div class="ai-input-footer">
            <textarea id="ai-chat-textarea" class="form-input ai-textarea" rows="1" placeholder="Ask about stock, customer dues, margins, or daily sales..." onkeydown="DukaanAI.handleKeydown(event)"></textarea>
            <button id="ai-send-btn" class="btn btn-primary" onclick="DukaanAI.submitPrompt()">
              Send
            </button>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

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

  // Send Prompt to Netlify Serverless Backend
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

    // Append User Message
    this.appendMessage('user', promptText);

    // Loader Indicator
    const loaderId = `loader-${Date.now()}`;
    const loaderHtml = `
      <div id="${loaderId}" class="ai-msg-row ai">
        <div class="ai-msg-avatar">${Icons.sparkles(16)}</div>
        <div class="ai-msg-bubble" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12.5px; color: var(--text-muted);">Consulting AI Engine via Netlify serverless...</span>
        </div>
      </div>
    `;
    thread.insertAdjacentHTML('beforeend', loaderHtml);
    thread.scrollTop = thread.scrollHeight;

    try {
      const storeContext = this.getLiveBusinessContext();

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          storeContext: storeContext
        })
      });

      const result = await response.json().catch(() => ({}));

      const loader = document.getElementById(loaderId);
      if (loader) loader.remove();

      if (response.ok && result.text) {
        this.appendMessage('ai', result.text);
        this.lastFailedPrompt = null;
      } else {
        const errorMsg = result.error || `Server responded with status ${response.status}`;
        this.renderErrorMessage(errorMsg);
      }
    } catch (error) {
      const loader = document.getElementById(loaderId);
      if (loader) loader.remove();
      this.renderErrorMessage(error.message || 'Unable to connect to /api/gemini endpoint.');
    } finally {
      this.isRequestInProgress = false;
      this.updateSendButtonState(false);
    }
  }

  appendMessage(role, text) {
    this.chatHistory.push({ role, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const isAi = role === 'ai';
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const formattedText = isAi ? this.formatMarkdown(text) : this.escapeHtml(text);

    const msgHtml = `
      <div class="ai-msg-row ${role}" id="${msgId}">
        <div class="ai-msg-avatar">${isAi ? Icons.sparkles(16) : Icons.staff(16)}</div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-text">${formattedText}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: right;">
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    `;

    thread.insertAdjacentHTML('beforeend', msgHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  renderErrorMessage(errorText) {
    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const isKeyIssue = errorText.includes('GEMINI_API_KEY') || errorText.includes('401');

    const errorHtml = `
      <div class="ai-msg-row ai">
        <div class="ai-msg-avatar" style="background: var(--danger-light); color: var(--danger);">
          ${Icons.alert(16)}
        </div>
        <div class="ai-msg-bubble" style="border-color: var(--danger-border);">
          <div style="font-weight: 700; color: var(--danger); font-size: 13px;">AI Connection Notice</div>
          <div style="font-size: 12.5px; color: var(--text-primary); margin-top: 4px;">${this.escapeHtml(errorText)}</div>
          ${isKeyIssue ? `
            <div style="margin-top: 8px; font-size: 11.5px; color: var(--text-muted); line-height: 1.5;">
              Ensure <code>GEMINI_API_KEY</code> is set in your <strong>Netlify Site Settings → Environment Variables</strong>.
            </div>
          ` : ''}
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            ${this.lastFailedPrompt ? `
              <button class="btn btn-primary btn-sm" onclick="DukaanAI.retryLastPrompt()">
                ${Icons.refresh(13)} Retry Request
              </button>
            ` : ''}
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

    this.chatHistory.forEach(msg => {
      const isAi = msg.role === 'ai';
      const msgId = `msg-hist-${Math.random().toString(36).substr(2, 6)}`;
      const formattedText = isAi ? this.formatMarkdown(msg.text) : this.escapeHtml(msg.text);

      thread.insertAdjacentHTML('beforeend', `
        <div class="ai-msg-row ${msg.role}" id="${msgId}">
          <div class="ai-msg-avatar">${isAi ? Icons.sparkles(16) : Icons.staff(16)}</div>
          <div class="ai-msg-bubble">
            <div class="ai-msg-text">${formattedText}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: right;">${msg.timestamp || ''}</div>
          </div>
        </div>
      `);
    });
    thread.scrollTop = thread.scrollHeight;
  }

  clearHistory() {
    this.chatHistory = [];
    const thread = document.getElementById('ai-chat-thread');
    if (thread) {
      thread.innerHTML = `
        <div class="ai-msg-row ai">
          <div class="ai-msg-avatar">${Icons.sparkles(16)}</div>
          <div class="ai-msg-bubble">
            <p>Chat history cleared. How can I assist your store operations?</p>
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
    btn.textContent = isWaiting ? 'Thinking...' : 'Send';
  }

  formatMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: var(--bg-input); padding: 2px 4px; border-radius: 4px; font-family: var(--font-mono); font-size: 11.5px;">$1</code>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Lookup barcode details online using Netlify serverless /api/gemini
  async lookupBarcodeOnline(barcode) {
    const cleanBarcode = String(barcode).trim();
    if (!cleanBarcode) return null;

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookupBarcode',
          barcode: cleanBarcode
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.found) {
          return result;
        }
      }
    } catch (e) {
      console.warn('[Dukaan AI] Barcode lookup error:', e);
    }
    return null;
  }

  closeModal() {
    const modal = document.getElementById('mydukaan-ai-modal');
    if (modal) modal.remove();
  }
}

window.DukaanAI = new DukaanAIEngine();
