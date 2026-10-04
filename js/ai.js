/**
 * MyDukaan Pro — Dukaan AI (Powered by Gemini 3.8 Flash)
 * Created & Deployed by Mayur Singh
 */

class DukaanAIEngine {
  constructor() {
    this.modelName = "gemini-3.8-flash";
    this.chatHistory = [];
  }

  // Open AI Assistant Drawer / Modal
  openChatModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="dukaan-ai-modal" onclick="if(event.target === this) DukaanAI.closeModal()">
        <div class="modal-card" style="max-width: 520px; height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.08));">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #9333EA); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                ✨
              </div>
              <div>
                <div style="font-weight: 800; font-size: 15px; color: var(--text-primary);">Dukaan AI Advisor</div>
                <div style="font-size: 11px; color: var(--purple); font-weight: 600;">Powered by Gemini 3.8 Flash • Smart Retail Brain</div>
              </div>
            </div>
            <button class="topbar-icon-btn" onclick="DukaanAI.closeModal()">✕</button>
          </div>

          <!-- Chat Conversation Area -->
          <div id="ai-chat-messages" style="flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            <!-- Greeting Message -->
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #7C3AED; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">✨</div>
              <div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-subtle); font-size: 13.5px; line-height: 1.5; color: var(--text-primary); max-width: 85%;">
                Namaste <strong>${DB.getData().shop.owner || 'Mayur Singh'}</strong>! 🙏 I am your smart business advisor for <strong>${DB.getData().shop.name}</strong>.
                <br/><br/>
                I have live access to your inventory, customer Udhaar khata, and sales ledger. Ask me anything!
              </div>
            </div>
          </div>

          <!-- Quick Suggestion Chips -->
          <div style="padding: 10px 16px; background: var(--bg-surface); border-top: 1px solid var(--border-subtle); display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;">
            <button class="cat-chip" onclick="DukaanAI.askQuick('Which products are low on stock and need urgent reordering?')">📦 Low Stock Alert</button>
            <button class="cat-chip" onclick="DukaanAI.askQuick('Who owes the highest Udhaar and how can I recover dues?')">⏳ Recover Dues</button>
            <button class="cat-chip" onclick="DukaanAI.askQuick('Give me 3 practical ideas to increase my shop gross margin this month')">💡 Boost Margins</button>
            <button class="cat-chip" onclick="DukaanAI.askQuick('Draft a friendly WhatsApp festive discount offer for my top customers')">📱 Draft Promo</button>
          </div>

          <!-- Input Footer -->
          <div style="padding: 14px 18px; background: var(--bg-input); border-top: 1px solid var(--border-subtle); display: flex; gap: 10px; align-items: center;">
            <input type="text" id="ai-user-input" class="form-input" style="height: 42px;" placeholder="Ask about sales, stock, customers, or pricing..." onkeydown="if(event.key === 'Enter') DukaanAI.sendUserMessage()" />
            <button class="btn btn-ai" style="height: 42px; padding: 0 18px;" onclick="DukaanAI.sendUserMessage()">
              Send ➤
            </button>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      const inp = document.getElementById('ai-user-input');
      if (inp) inp.focus();
    }, 150);
  }

  askQuick(text) {
    const input = document.getElementById('ai-user-input');
    if (input) {
      input.value = text;
      this.sendUserMessage();
    }
  }

  async sendUserMessage() {
    const input = document.getElementById('ai-user-input');
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();
    input.value = '';

    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    // Append User Message
    container.innerHTML += `
      <div style="display: flex; justify-content: flex-end;">
        <div style="background: var(--primary); color: #fff; padding: 10px 16px; border-radius: 12px; font-size: 13.5px; max-width: 80%;">
          ${query}
        </div>
      </div>
    `;

    // Typing Loader
    const typingId = `typing-${Date.now()}`;
    container.innerHTML += `
      <div id="${typingId}" style="display: flex; gap: 10px; align-items: center; color: var(--text-muted); font-size: 12px;">
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #7C3AED; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px;">✨</div>
        <span>Dukaan AI analyzing live ledger...</span>
      </div>
    `;
    container.scrollTop = container.scrollHeight;

    // Get live retail context
    const reply = await this.generateResponse(query);

    const loader = document.getElementById(typingId);
    if (loader) loader.remove();

    container.innerHTML += `
      <div style="display: flex; gap: 10px; align-items: flex-start;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: #7C3AED; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">✨</div>
        <div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border-subtle); font-size: 13.5px; line-height: 1.6; color: var(--text-primary); max-width: 85%;">
          ${reply}
        </div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;
  }

  async generateResponse(userPrompt) {
    const db = DB.getData();
    const shop = db.shop;
    const key = db.geminiKey ? db.geminiKey.trim() : "";

    // Live store summary for context
    const lowStock = db.products.filter(p => p.stock <= p.minStock).map(p => `${p.name} (${p.stock} left)`).join(', ');
    const topDues = db.customers.filter(c => c.balanceDue > 0).map(c => `${c.name}: ₹${c.balanceDue}`).join(', ');
    const totalSales = db.invoices.reduce((s, i) => s + i.paid, 0);

    const systemPrompt = `You are "Dukaan AI", an expert retail business consultant for an Indian shop called "${shop.name}".
Live Store Context:
- Owner: ${shop.owner}
- Total Catalog Items: ${db.products.length}
- Low Stock Items: ${lowStock || 'None, inventory is healthy'}
- Total Uncollected Customer Dues: ${topDues || 'No outstanding customer dues'}
- Total Recorded Sales: ₹${totalSales}
- Location: ${shop.address}

Instructions:
- Be concise, direct, helpful, and culturally relevant to Indian Kirana/Retail shops.
- Use Indian Rupee (₹) and metrics.
- Keep responses within 2 to 3 practical, actionable bullet points or short paragraphs.
- No generic fluff.`;

    if (key) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }] }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 600
            }
          })
        });

        const data = await response.json();
        if (data && data.candidates && data.candidates[0].content) {
          const rawText = data.candidates[0].content.parts[0].text;
          return rawText.replace(/\n/g, '<br/>');
        } else if (data.error) {
          console.warn("[Gemini Error]", data.error);
        }
      } catch (err) {
        console.warn("[Gemini API Call Failed]", err);
      }
    }

    // High-Fidelity Local Offline Intelligence Fallback
    return this.generateOfflineInsight(userPrompt, db);
  }

  generateOfflineInsight(prompt, db) {
    const q = prompt.toLowerCase();
    const lowStock = db.products.filter(p => p.stock <= p.minStock);
    const topDues = db.customers.filter(c => c.balanceDue > 0);
    const totalSales = db.invoices.reduce((s, i) => s + i.paid, 0);

    if (q.includes('stock') || q.includes('reorder')) {
      if (lowStock.length) {
        return `⚠️ <strong>Inventory Reorder Advice:</strong><br/>
        You have <strong>${lowStock.length} items</strong> critically low or out of stock:<br/>
        ${lowStock.map(p => `• <strong>${p.name}</strong>: only ${p.stock} ${p.unit} remaining (Min: ${p.minStock})`).join('<br/>')}<br/><br/>
        💡 <em>Recommendation: Order wholesale batches before the weekend to prevent lost revenue.</em>`;
      }
      return `✅ <strong>Inventory Health:</strong> All your items currently have stock levels above the threshold. Keep tracking fast-moving items!`;
    }

    if (q.includes('due') || q.includes('udhaar') || q.includes('recover')) {
      if (topDues.length) {
        const total = topDues.reduce((s, c) => s + c.balanceDue, 0);
        return `⏳ <strong>Udhaar Recovery Plan:</strong><br/>
        Total pending in the market: <strong>₹${total.toLocaleString('en-IN')}</strong> across ${topDues.length} customers.<br/>
        Top pending accounts:<br/>
        ${topDues.slice(0, 3).map(c => `• <strong>${c.name}</strong>: ₹${c.balanceDue.toLocaleString('en-IN')}`).join('<br/>')}<br/><br/>
        💡 <em>Action: Use the one-click WhatsApp Reminder button in the Udhaar Khata tab to send gentle payment links.</em>`;
      }
      return `🎉 Great news! You have ₹0 pending Udhaar. All customer bills are fully settled.`;
    }

    if (q.includes('margin') || q.includes('profit') || q.includes('increase')) {
      return `📈 <strong>3 Profit Margin Accelerators:</strong><br/>
      1. <strong>Bundle High & Low Margin Items:</strong> Pair high-margin snacks/confectionery near the billing counter with daily staples like Atta and Oil.<br/>
      2. <strong>Early Supplier Settlement Discounts:</strong> Negotiate 2-3% cash discounts with FMCG distributors by paying upfront.<br/>
      3. <strong>Promote Private / Bulk Brands:</strong> Selling 5kg packs yields 12% higher net margin than single 1kg packs.`;
    }

    if (q.includes('whatsapp') || q.includes('promo') || q.includes('festival')) {
      return `📱 <strong>Ready-to-send WhatsApp Promo Copy:</strong><br/>
      <em>"Namaste! 🙏 Special weekend offer at ${db.shop.name}! Get flat ₹100 OFF on orders above ₹1,000 this Friday & Saturday. Fresh stock of daily essentials ready for free doorstep delivery. Call/WhatsApp us to order!"</em><br/><br/>
      Copy and share with your customer list!`;
    }

    return `💡 <strong>Business Summary for ${db.shop.name}:</strong><br/>
    • Total recorded revenue: <strong>₹${totalSales.toLocaleString('en-IN')}</strong><br/>
    • Active product catalog: <strong>${db.products.length} SKUs</strong><br/>
    • Pending Udhaar: <strong>₹${topDues.reduce((s, c) => s + c.balanceDue, 0).toLocaleString('en-IN')}</strong><br/><br/>
    <em>To activate full live AI reasoning via Google Cloud, add your free Gemini 3.8 Flash key in Settings.</em>`;
  }

  closeModal() {
    const el = document.getElementById('dukaan-ai-modal');
    if (el) el.remove();
  }
}

window.DukaanAI = new DukaanAIEngine();
