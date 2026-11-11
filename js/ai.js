/**
 * MyDukkan24 — Real Online AI Business Advisor & Strict Offline Failover Engine
 * Strict Online/Offline Architecture:
 * - ONLINE (navigator.onLine === true): Exclusively calls live Gemini Interactions API via /api/gemini.
 *   Never silently mixes or falls back to local mock replies when online.
 * - OFFLINE (navigator.onLine === false): Automatically switches to Inbuilt Local Retail Rule-Engine.
 * Supports modern AI Studio keys (both `AQ.` and `AIza`) configured in Vercel / Netlify or Set Key.
 */

class DukaanAIEngine {
  constructor() {
    this.chatHistory = [];
    this.lastFailedPrompt = null;
    this.isRequestInProgress = false;
  }

  getEndpoint() {
    if (
      window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      return 'https://mydukaan-eta.vercel.app/api/gemini';
    }
    return '/api/gemini';
  }

  isSystemOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
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

  // Open the Premium AI Copilot Interface (Owner-only financial context)
  openChatModal() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.toast('warning', 'Owner Only', 'Dukkan Copilot financial insights are restricted in Cashier Mode.');
      return;
    }
    const isOnline = this.isSystemOnline();
    const badgeClass = isOnline ? 'badge-success' : 'badge-warning';
    const badgeText = isOnline ? '🟢 Online • Live Gemini API' : '🟠 Offline • Local Advisor';
    const subText = isOnline
      ? 'Live Gemini Interactions API • Real-time inventory, sales & Udhaar'
      : 'Offline Mode active • Inbuilt Local Store Advisor';

    const modalHtml = `
      <div class="modal-backdrop ai-modal-backdrop" id="mydukaan-ai-modal" onclick="if(event.target === this) DukaanAI.closeModal()">
        <div class="modal-card ai-chat-modal-window">
          <!-- AI Header -->
          <div class="modal-header ai-modal-header">
            <div class="ai-header-brand">
              <div class="ai-avatar-badge" style="color: #fff; display: flex;">
                ${Icons.sparkles(17)}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="font-weight: 700; font-size: 14.5px; color: var(--text-primary); white-space: nowrap;">Dukkan Copilot</span>
                  <span id="ai-mode-badge" class="badge ${badgeClass}" style="font-size: 10px;">${badgeText}</span>
                </div>
                <div id="ai-mode-subtext" style="font-size: 11px; color: var(--text-muted); margin-top: 2px; line-height: 1.3;">
                  ${subText}
                </div>
              </div>
            </div>
            <div class="ai-header-actions">
              <button class="btn btn-secondary btn-sm" onclick="DukaanAI.clearHistory()" title="Clear Chat History">Clear</button>
              <button class="topbar-icon-btn" onclick="DukaanAI.closeModal()" aria-label="Close">✕</button>
            </div>
          </div>

          <!-- Conversation Thread -->
          <div id="ai-chat-thread" class="ai-chat-thread">
            <!-- Initial Greeting -->
            <div class="ai-msg-row ai">
              <div class="ai-msg-avatar">${Icons.sparkles(16)}</div>
              <div class="ai-msg-bubble">
                <div style="font-weight: 700; margin-bottom: 4px; color: var(--primary);">Namaste! Welcome to Dukkan Copilot.</div>
                <p id="ai-welcome-desc">${isOnline
                  ? 'System is <strong>Online</strong> — all queries are answered strictly via the live <strong>Gemini API</strong> with your real-time store context.'
                  : 'System is <strong>Offline</strong> — running on the inbuilt <strong>Local Store Advisor</strong> until internet returns.'
                }</p>
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

  updateConnectionBadge() {
    const isOnline = this.isSystemOnline();
    const badge = document.getElementById('ai-mode-badge');
    const sub = document.getElementById('ai-mode-subtext');
    const welcome = document.getElementById('ai-welcome-desc');

    if (badge) {
      badge.className = `badge ${isOnline ? 'badge-success' : 'badge-warning'}`;
      badge.textContent = isOnline ? '🟢 Online • Live Gemini API' : '🟠 Offline • Local Advisor';
    }
    if (sub) {
      sub.textContent = isOnline
        ? 'Live Gemini Interactions API • Real-time inventory, sales & Udhaar'
        : 'Offline Mode active • Inbuilt Local Store Advisor';
    }
    if (welcome) {
      welcome.innerHTML = isOnline
        ? 'System is <strong>Online</strong> — all queries are answered strictly via the live <strong>Gemini API</strong> with your real-time store context.'
        : 'System is <strong>Offline</strong> — running on the inbuilt <strong>Local Store Advisor</strong> until internet returns.';
    }
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

  // Quick prompt to save user's custom Gemini API key locally (supports both AQ. and AIza keys)
  promptSetApiKey() {
    const existing = localStorage.getItem('mydukaan_gemini_api_key') || '';
    const newKey = prompt(
      'Paste your active Google Gemini API Key from aistudio.google.com/api-keys (supports AQ. and AIza keys; leave blank to use Vercel / Netlify environment key):',
      existing
    );
    if (newKey !== null) {
      const trimmed = newKey.trim();
      if (trimmed) {
        localStorage.setItem('mydukaan_gemini_api_key', trimmed);
        App.toast('success', 'Gemini API Key Saved', 'Custom key saved for live Copilot & Barcode lookups.');
        this.appendMessage(
          'ai',
          '🔑 **Custom Gemini API Key saved!**\nAll online queries will now authenticate using your configured key.',
          { mode: 'system' }
        );
      } else {
        localStorage.removeItem('mydukaan_gemini_api_key');
        App.toast('info', 'API Key Cleared', 'Reverted to Vercel / Netlify server environment key.');
      }
    }
  }

  // Submit Prompt: STRICTLY Online API when online; Offline Rule-Engine ONLY when offline
  async submitPrompt(customPrompt = null) {
    if (this.isRequestInProgress) return;

    const textarea = document.getElementById('ai-chat-textarea');
    const promptText = (customPrompt || (textarea ? textarea.value : '')).trim();
    if (!promptText) return;

    if (textarea) {
      textarea.value = '';
      textarea.style.height = 'auto';
    }

    this.appendMessage('user', promptText);

    // STRICT OFFLINE BRANCH: Only run local engine when system is actually offline
    if (!this.isSystemOnline()) {
      const offlineReply = this.generateOfflineRetailAdvice(promptText);
      this.appendMessage('ai', offlineReply, { mode: 'offline' });
      this.lastFailedPrompt = null;
      return;
    }

    // STRICT ONLINE BRANCH: Call live /api/gemini endpoint exclusively
    this.isRequestInProgress = true;
    this.updateSendButtonState(true);
    this.updateConnectionBadge();

    const thread = document.getElementById('ai-chat-thread');
    const loaderId = `loader-${Date.now()}`;
    const loaderHtml = `
      <div id="${loaderId}" class="ai-msg-row ai">
        <div class="ai-msg-avatar" style="animation: pulse 1.5s infinite;">${Icons.sparkles(16)}</div>
        <div class="ai-msg-bubble" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12.5px; color: var(--text-muted);">Contacting Live Gemini API...</span>
        </div>
      </div>
    `;
    if (thread) {
      thread.insertAdjacentHTML('beforeend', loaderHtml);
      thread.scrollTop = thread.scrollHeight;
    }

    try {
      const storeContext = this.getLiveBusinessContext();
      const endpoint = this.getEndpoint();
      const customApiKey = localStorage.getItem('mydukaan_gemini_api_key') || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 24000);

      let response = null;
      let result = null;
      let netError = null;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            storeContext,
            apiKey: customApiKey
          }),
          signal: controller.signal
        });
        result = await response.json().catch(() => ({}));
      } catch (err) {
        netError = err;
        response = null;
      } finally {
        clearTimeout(timeoutId);
      }

      const loader = document.getElementById(loaderId);
      if (loader) loader.remove();

      if (response && response.ok && result && result.text) {
        this.appendMessage('ai', result.text, {
          mode: 'online',
          model: result.model || 'gemini-3.8-flash'
        });
        this.lastFailedPrompt = null;
        return;
      }

      // If connectivity dropped mid-request and browser is now offline -> use local engine
      if (!this.isSystemOnline()) {
        const offlineReply = this.generateOfflineRetailAdvice(promptText);
        this.appendMessage('ai', offlineReply, { mode: 'offline' });
        this.lastFailedPrompt = null;
        return;
      }

      // System is ONLINE but API returned an error or failed -> surface exact error honestly (DO NOT mix fake/local response!)
      this.lastFailedPrompt = promptText;
      const errStatus = response ? response.status : (netError?.name === 'AbortError' ? 504 : 0);
      const errMsg =
        (result && result.error) ||
        (netError?.name === 'AbortError'
          ? 'Gemini API request timed out after 24s.'
          : netError?.message) ||
        `Gemini API returned HTTP ${errStatus || 'Error'}.`;
      const hintMsg = (result && result.hint) || '';
      const isAuthFail = Boolean((result && result.authError) || errStatus === 401 || errStatus === 403);

      this.renderErrorMessage(errMsg, errStatus, hintMsg, isAuthFail);
    } finally {
      this.isRequestInProgress = false;
      this.updateSendButtonState(false);
    }
  }

  runOfflineFallbackForLastPrompt() {
    if (!this.lastFailedPrompt) return;
    const offlineReply = this.generateOfflineRetailAdvice(this.lastFailedPrompt);
    this.appendMessage('ai', offlineReply, { mode: 'offline' });
  }

  // Inbuilt Offline Retail Rule-Engine (Activated strictly when Offline or explicitly requested)
  generateOfflineRetailAdvice(prompt) {
    const db = DB.getData();
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];
    const pLow = (prompt || '').toLowerCase().trim();

    if (
      pLow.includes('connect') ||
      pLow.includes('api') ||
      pLow.includes('online') ||
      pLow.includes('model') ||
      pLow.includes('server') ||
      pLow.includes('work kr') ||
      pLow.includes('chal rha') ||
      pLow.includes('active')
    ) {
      const onlineNow = this.isSystemOnline();
      return `🛡️ **Offline Store Advisor Status:**\n\n` +
        `• **Network Status:** ${onlineNow ? '🟢 Online (API Mode Preferred)' : '🟠 Offline Mode'}\n` +
        `• **Store Local DB:** 🟢 Active (${products.length} SKUs, ₹${invoices.reduce((s, i) => s + (i.paid || 0), 0).toLocaleString('en-IN')} Sales)\n` +
        `• **Live Gemini Models:** \`gemini-3.8-flash\` / \`gemini-3.5-flash-lite\` (Interactions API)\n\n` +
        `💡 **Server Status:** Online queries connect directly via the built-in \`/api/gemini\` endpoint.`;
    }

    if (
      pLow === 'hii' || pLow === 'hi' || pLow === 'hello' || pLow === 'hey' || pLow === 'yo' ||
      pLow.includes('namaste') || pLow.includes('kaise ho') || pLow.includes('kya hal') ||
      pLow.includes('who are you') || pLow.includes('kaun ho')
    ) {
      return `🙏 **Namaste! (Offline Store Advisor Mode)**\n\n` +
        `Aapke device ka local store data active hai:\n` +
        `• Catalog me **${products.length} items** hain.\n` +
        `• **${invoices.length} billing transactions** aur **${customers.length} customer accounts** tracked hain.\n\n` +
        `Aap pooch sakte hain:\n` +
        `• *"Which products are low in stock?"*\n` +
        `• *"Who owes me the most Udhaar?"*\n` +
        `• *"Store health summary"*`;
    }

    const matchedProduct = products.find(
      p => pLow.includes(p.name.toLowerCase()) || (p.barcode && pLow.includes(p.barcode))
    );
    if (matchedProduct && (pLow.includes('stock') || pLow.includes('price') || pLow.includes('rate') || pLow.includes('kitna'))) {
      const profit = Math.max(0, matchedProduct.price - matchedProduct.cost);
      const margin = matchedProduct.price > 0 ? Math.round((profit / matchedProduct.price) * 100) : 0;
      const isLow = matchedProduct.stock <= matchedProduct.minStock;

      return `📦 **Local Stock Lookup — ${matchedProduct.name}:**\n\n` +
        `• **Current Stock:** **${matchedProduct.stock} ${matchedProduct.unit}** ${isLow ? '⚠️ *(Low Stock)*' : '✅'}\n` +
        `• **Selling Price:** **₹${matchedProduct.price}** (MRP: ₹${matchedProduct.mrp})\n` +
        `• **Wholesale Cost:** ₹${matchedProduct.cost}\n` +
        `• **Margin/Unit:** **₹${profit} (${margin}%)**\n` +
        `• **Barcode:** \`${matchedProduct.barcode || 'N/A'}\``;
    }

    if (pLow.includes('stock') || pLow.includes('reorder') || pLow.includes('khatam') || pLow.includes('maal')) {
      const low = products.filter(p => p.stock <= p.minStock);
      if (!low.length) {
        return `✅ **Stock Health Good (Offline Check):** All **${products.length} catalog products** meet minimum safe stock levels.`;
      }
      return `⚠️ **Low Stock Reorder List (${low.length} Items):**\n\n` +
        low.map(p => `• **${p.name}**: **${p.stock} ${p.unit}** (Min: ${p.minStock}) — Cost: ₹${p.cost || p.price}`).join('\n');
    }

    if (pLow.includes('udhaar') || pLow.includes('debt') || pLow.includes('due') || pLow.includes('owe') || pLow.includes('baki')) {
      const debtors = customers.filter(c => (c.balanceDue || 0) > 0).sort((a, b) => b.balanceDue - a.balanceDue);
      const totalDue = debtors.reduce((s, c) => s + c.balanceDue, 0);
      if (!debtors.length) {
        return `🎉 **Clean Khata (Offline Check):** ₹0 pending customer Udhaar across all accounts.`;
      }
      return `📒 **Customer Udhaar Summary (Total: ₹${totalDue.toLocaleString('en-IN')}):**\n\n` +
        debtors.map((c, i) => `${i + 1}. **${c.name}**: **₹${c.balanceDue.toLocaleString('en-IN')}** (📞 ${c.phone || 'No phone'})`).join('\n');
    }

    if (pLow.includes('summary') || pLow.includes('health') || pLow.includes('revenue') || pLow.includes('sale') || pLow.includes('aaj') || pLow.includes('earning')) {
      const today = (window.DB && DB.getLocalDateStr) ? DB.getLocalDateStr() : new Date().toISOString().split('T')[0];
      const todayInvoices = invoices.filter(i => (i.date || '').startsWith(today));
      const todayRev = todayInvoices.reduce((s, i) => s + (i.paid || 0), 0);
      const totalRev = invoices.reduce((s, i) => s + (i.paid || 0), 0);
      const totalUdhaar = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
      const stockVal = Math.round(products.reduce((s, p) => s + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0));
      const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      return `📊 **Local Store Snapshot (Offline Advisor):**\n\n` +
        `• **Today's Revenue:** ₹${todayRev.toLocaleString('en-IN')} (${todayInvoices.length} Bills)\n` +
        `• **Total Sales:** ₹${totalRev.toLocaleString('en-IN')} (${invoices.length} Invoices)\n` +
        `• **Inventory Value:** ₹${stockVal.toLocaleString('en-IN')} (${products.length} SKUs)\n` +
        `• **Pending Udhaar:** ₹${totalUdhaar.toLocaleString('en-IN')}\n` +
        `• **Operating Expenses:** ₹${totalExp.toLocaleString('en-IN')}`;
    }

    if (pLow.includes('whatsapp') || pLow.includes('reminder') || pLow.includes('draft') || pLow.includes('message')) {
      const topDebtor = customers.find(c => (c.balanceDue || 0) > 0) || { name: 'Customer', balanceDue: 500 };
      const shopName = db.shop ? (db.shop.name || 'MyDukkan24 Mart') : 'MyDukkan24 Mart';
      const upi = db.shop ? (db.shop.upiId || '6306437348@upi') : '6306437348@upi';

      return `📱 **WhatsApp Reminder Draft (Offline):**\n\n` +
        `\`\`\`\n` +
        `Namaste ${topDebtor.name} ji,\n` +
        `Aapka ${shopName} par ₹${topDebtor.balanceDue.toLocaleString('en-IN')} ka hisab pending hai.\n` +
        `Kripya is UPI ID par bhugtan karein: ${upi}\n` +
        `Dhanyawad!\n` +
        `\`\`\``;
    }

    if (pLow.includes('margin') || pLow.includes('profit') || pLow.includes('grow') || pLow.includes('increase') || pLow.includes('munafa')) {
      return `💡 **3 Kirana Margin Boosters (Offline Advisor):**\n\n` +
        `1. **Counter Placement:** Keep high-margin FMCG items (spices, chocolates, snacks) right at the counter.\n` +
        `2. **Staple Combos:** Bundle Atta + Cooking Oil to raise average bill value.\n` +
        `3. **Udhaar Turnover:** Cap unpaid credit per customer and use 1-click WhatsApp UPI reminders weekly.`;
    }

    return `🟠 **Offline Mode • Local Store Summary:**\n\n` +
      `Your local database tracks **${products.length} SKUs**, **${invoices.length} invoices**, and **${customers.length} customers**.\n` +
      `Internet connection will automatically re-enable full conversational **Live Gemini API** answers.\n\n` +
      `Try asking: *"Low stock items"*, *"Top Udhaar debtors"*, or *"Store summary"*.`;
  }

  renderNoticeBanner(noticeText) {
    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const bannerHtml = `
      <div class="ai-msg-row ai" style="opacity: 0.9;">
        <div class="ai-msg-avatar" style="background: rgba(37,99,235,0.15); color: #60A5FA;">
          ${Icons.info(14)}
        </div>
        <div class="ai-msg-bubble" style="font-size: 11.5px; color: var(--text-muted); border-left: 2px solid var(--primary);">
          ${this.escapeHtml(noticeText)}
        </div>
      </div>
    `;
    thread.insertAdjacentHTML('beforeend', bannerHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  appendMessage(role, text, meta = {}) {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.chatHistory.push({ role, text, timestamp: ts, meta });

    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const isAi = role === 'ai';
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const formattedText = isAi ? this.formatMarkdown(text) : this.escapeHtml(text);

    let sourceTag = '';
    if (isAi && meta.mode === 'online') {
      sourceTag = `<span style="color: var(--success); font-weight: 700; margin-right: 8px;">🟢 Live • ${this.escapeHtml(meta.model || 'Gemini API')}</span>`;
    } else if (isAi && meta.mode === 'offline') {
      sourceTag = `<span style="color: var(--warning); font-weight: 700; margin-right: 8px;">🟠 Offline • Local Engine</span>`;
    }

    const msgHtml = `
      <div class="ai-msg-row ${role}" id="${msgId}">
        <div class="ai-msg-avatar">${isAi ? Icons.sparkles(16) : Icons.staff(16)}</div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-text">${formattedText}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 4px;">
            ${sourceTag}<span>${ts}</span>
          </div>
        </div>
      </div>
    `;

    thread.insertAdjacentHTML('beforeend', msgHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  renderErrorMessage(errorText, status = 0, hint = '', isAuthFail = false) {
    const thread = document.getElementById('ai-chat-thread');
    if (!thread) return;

    const statusBadge = status ? `HTTP ${status}` : 'Connection Error';

    const errorHtml = `
      <div class="ai-msg-row ai">
        <div class="ai-msg-avatar" style="background: var(--danger-light); color: var(--danger);">
          ${Icons.alert(16)}
        </div>
        <div class="ai-msg-bubble" style="border-color: var(--danger-border);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; color: var(--danger); font-size: 13px;">Live Gemini API Error</span>
            <span class="badge badge-danger" style="font-size: 10px;">${this.escapeHtml(statusBadge)}</span>
          </div>
          <div style="font-size: 12.5px; color: var(--text-primary); margin-top: 6px; word-break: break-word;">${this.escapeHtml(errorText)}</div>
          ${hint ? `
            <div style="margin-top: 6px; font-size: 11.5px; color: var(--text-muted); line-height: 1.45;">
              ${this.escapeHtml(hint)}
            </div>
          ` : ''}
          ${isAuthFail ? `
            <div style="margin-top: 6px; font-size: 11px; color: var(--warning); line-height: 1.45;">
              Note: Online mode does not substitute fake local replies when live server authentication needs attention.
            </div>
          ` : ''}
          <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
            ${this.lastFailedPrompt ? `
              <button class="btn btn-primary btn-sm" onclick="DukaanAI.retryLastPrompt()">
                ${Icons.refresh(13)} Retry API
              </button>
              <button class="btn btn-secondary btn-sm" onclick="DukaanAI.runOfflineFallbackForLastPrompt()">
                🛡️ Use Offline Advisor Once
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
      const msgId = `msg-hist-${Math.random().toString(36).slice(2, 8)}`;
      const formattedText = isAi ? this.formatMarkdown(msg.text) : this.escapeHtml(msg.text);
      const meta = msg.meta || {};
      let sourceTag = '';
      if (isAi && meta.mode === 'online') {
        sourceTag = `<span style="color: var(--success); font-weight: 700; margin-right: 8px;">🟢 Live • ${this.escapeHtml(meta.model || 'Gemini API')}</span>`;
      } else if (isAi && meta.mode === 'offline') {
        sourceTag = `<span style="color: var(--warning); font-weight: 700; margin-right: 8px;">🟠 Offline • Local Engine</span>`;
      }

      thread.insertAdjacentHTML('beforeend', `
        <div class="ai-msg-row ${msg.role}" id="${msgId}">
          <div class="ai-msg-avatar">${isAi ? Icons.sparkles(16) : Icons.staff(16)}</div>
          <div class="ai-msg-bubble">
            <div class="ai-msg-text">${formattedText}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: flex-end; align-items: center; gap: 4px;">
              ${sourceTag}<span>${msg.timestamp || ''}</span>
            </div>
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
      const isOnline = this.isSystemOnline();
      thread.innerHTML = `
        <div class="ai-msg-row ai">
          <div class="ai-msg-avatar">${Icons.sparkles(16)}</div>
          <div class="ai-msg-bubble">
            <p>Chat history cleared. ${isOnline ? 'System is Online (Live Gemini API ready).' : 'System is Offline (Local Advisor ready).'}</p>
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
    if (!text) return '';
    return this.escapeHtml(text)
      .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '<pre style="background: var(--bg-input); padding: 8px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 11.5px; white-space: pre-wrap; margin: 6px 0; border: 1px solid var(--border-subtle);">$1</pre>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: var(--bg-input); padding: 2px 4px; border-radius: 4px; font-family: var(--font-mono); font-size: 11.5px;">$1</code>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Lookup barcode details online strictly via serverless /api/gemini
  async lookupBarcodeOnline(barcode) {
    const cleanBarcode = String(barcode || '').trim();
    if (!cleanBarcode) return { ok: false, found: false, error: 'Empty barcode' };

    if (!this.isSystemOnline()) {
      return { ok: false, offline: true, found: false, error: 'System is offline.' };
    }

    const endpoint = this.getEndpoint();
    const customApiKey = localStorage.getItem('mydukaan_gemini_api_key') || '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookupBarcode',
          barcode: cleanBarcode,
          apiKey: customApiKey
        }),
        signal: controller.signal
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          ok: true,
          found: Boolean(result && result.found && result.product),
          product: (result && result.product) || null,
          model: (result && result.model) || 'gemini-3.8-flash',
          message: (result && result.message) || ''
        };
      }

      return {
        ok: false,
        status: response.status,
        authError: Boolean(result?.authError || response.status === 401 || response.status === 403),
        error: result?.error || `Gemini API returned HTTP ${response.status}`,
        hint: result?.hint || '',
        found: false
      };
    } catch (e) {
      console.warn('[Dukaan AI] Barcode lookup error:', e);
      return {
        ok: false,
        offline: !this.isSystemOnline(),
        found: false,
        error: e.name === 'AbortError' ? 'Live barcode search timed out.' : (e.message || 'Network error')
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Gemini Vision: Parse Wholesaler Bill / Purchase Invoice Photo
  async scanPurchaseBillOnline(imageBase64, mimeType = 'image/jpeg', catalogHints = []) {
    if (!imageBase64) return { ok: false, error: 'Bill image is required.' };
    if (!this.isSystemOnline()) {
      return { ok: false, offline: true, error: 'System is offline. Internet connection required for AI Bill Vision Scanner.' };
    }

    const endpoint = this.getEndpoint();
    const customApiKey = localStorage.getItem('mydukaan_gemini_api_key') || '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 26000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scanPurchaseBill',
          imageBase64,
          mimeType,
          catalogHints,
          apiKey: customApiKey
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result && result.bill) {
        return {
          ok: true,
          bill: result.bill,
          model: result.model || 'gemini-3.8-flash'
        };
      }
      return {
        ok: false,
        status: response.status,
        error: result?.error || `Gemini Bill Vision returned HTTP ${response.status}`,
        hint: result?.hint || ''
      };
    } catch (e) {
      return {
        ok: false,
        offline: !this.isSystemOnline(),
        error: e.name === 'AbortError' ? 'AI bill scan timed out. Try a tighter crop or smaller photo.' : (e.message || 'Network error')
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Gemini NLU: Parse Hindi / Hinglish Voice Order against store catalog
  async parseVoiceCartOnline(transcript, catalogHints = []) {
    if (!transcript || !String(transcript).trim()) {
      return { ok: false, error: 'Empty voice transcript.' };
    }
    if (!this.isSystemOnline()) {
      return { ok: false, offline: true, error: 'System is offline.' };
    }

    const endpoint = this.getEndpoint();
    const customApiKey = localStorage.getItem('mydukaan_gemini_api_key') || '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parseVoiceCart',
          transcript,
          catalogHints,
          apiKey: customApiKey
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result && result.result) {
        return {
          ok: true,
          result: result.result,
          model: result.model || 'gemini-3.8-flash'
        };
      }
      return {
        ok: false,
        status: response.status,
        error: result?.error || `Voice NLU returned HTTP ${response.status}`
      };
    } catch (e) {
      return {
        ok: false,
        offline: !this.isSystemOnline(),
        error: e.name === 'AbortError' ? 'Voice NLU request timed out.' : (e.message || 'Network error')
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Gemini Demand Prediction: 30-day velocity restock analysis
  async predictRestockOnline(velocitySummary, prompt = '') {
    if (!this.isSystemOnline()) {
      return { ok: false, offline: true, error: 'System is offline.' };
    }

    const endpoint = this.getEndpoint();
    const customApiKey = localStorage.getItem('mydukaan_gemini_api_key') || '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'predictRestock',
          velocitySummary,
          prompt,
          apiKey: customApiKey
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result && result.text) {
        return { ok: true, text: result.text, model: result.model || 'gemini-3.8-flash' };
      }
      return {
        ok: false,
        status: response.status,
        error: result?.error || `Restock AI returned HTTP ${response.status}`
      };
    } catch (e) {
      return {
        ok: false,
        offline: !this.isSystemOnline(),
        error: e.name === 'AbortError' ? 'Restock forecast timed out.' : (e.message || 'Network error')
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  closeModal() {
    const modal = document.getElementById('mydukaan-ai-modal');
    if (modal) modal.remove();
  }
}

window.DukaanAI = new DukaanAIEngine();
