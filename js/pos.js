/**
 * MyDukkan24 — High-Speed Retail POS Billing Terminal, Weight Chips, Hold Queue & Voice Engine
 * Engineered for Kirana loose-weight decimal billing, multi-customer hold queue,
 * slab-wise GST (0/5/12/18%), Hinglish Voice billing, UPI QR & thermal printing.
 */

class POSEngine {
  constructor() {
    this.cart = [];
    this.selectedCustomerId = "";
    this.paymentMode = "Cash";
    this.discountType = "fixed"; // 'fixed' or 'percent'
    this.discountValue = 0;
    this.activeCategory = "All";
    this.searchQuery = "";
    this._expandedWeightId = null;
    this._voiceRecognition = null;
    this._voiceListening = false;
    this._voiceLang = "hi-IN";
    this._voiceParsedItems = [];
  }

  init() {
    this.renderCatalog();
    this.renderCart();
    this.updateParkedBadge();
  }

  isWeightUnit(unit = '') {
    return /^(kg|kilogram|g|gram|gm|l|ltr|litre|liter|ml|bag)$/i.test(String(unit || '').trim());
  }

  getWeightPresets(unit = '') {
    const u = String(unit || '').trim().toLowerCase();
    if (u === 'litre' || u === 'liter' || u === 'l' || u === 'ltr') {
      return [
        { label: '250ml', qty: 0.25 },
        { label: '500ml', qty: 0.5 },
        { label: '1L', qty: 1 },
        { label: '1.5L', qty: 1.5 },
        { label: '2L', qty: 2 }
      ];
    }
    if (u === 'kg' || u === 'kilogram' || u === 'bag') {
      return [
        { label: '250g', qty: 0.25 },
        { label: '500g', qty: 0.5 },
        { label: '1kg', qty: 1 },
        { label: '1.5kg', qty: 1.5 },
        { label: '2kg', qty: 2 }
      ];
    }
    return [
      { label: '0.5', qty: 0.5 },
      { label: '1', qty: 1 },
      { label: '2', qty: 2 },
      { label: '5', qty: 5 }
    ];
  }

  // Add Item to Bill Cart (supports decimal loose weights)
  addItemToCart(product, qty = 1) {
    if (!product) return;
    const safeStock = DB.roundQty(product.stock || 0);
    if (safeStock <= 0) {
      App.toast('danger', 'Out of Stock', `${product.name} is currently out of stock`);
      return false;
    }

    const addQty = Math.max(0.01, DB.roundQty(qty));
    const existing = this.cart.find(item => item.id === product.id);
    if (existing) {
      const nextQty = DB.roundQty(existing.qty + addQty);
      if (nextQty > safeStock) {
        App.toast('warning', 'Stock Limit', `Only ${safeStock} ${product.unit || 'unit'} available`);
        return false;
      }
      existing.qty = nextQty;
      existing.maxStock = safeStock;
    } else {
      if (addQty > safeStock) {
        App.toast('warning', 'Stock Limit', `Only ${safeStock} ${product.unit || 'unit'} available`);
        return false;
      }
      const gstRate = [0, 5, 12, 18].includes(Number(product.gstRate))
        ? Number(product.gstRate)
        : DB.inferDefaultGstRate(product.cat, product.name);
      this.cart.push({
        id: product.id,
        name: product.name,
        cat: product.cat || 'General',
        barcode: product.barcode || '',
        mrp: Number(product.mrp) || Number(product.price) || 0,
        price: Number(product.price) || 0,
        cost: Number(product.cost) || 0,
        unit: product.unit || 'pack',
        gstRate,
        emoji: product.emoji || '',
        maxStock: safeStock,
        qty: addQty
      });
    }

    DB.playScanBeep();
    this.renderCart();
    return true;
  }

  updateItemQty(productId, delta) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    const newQty = DB.roundQty(item.qty + delta);
    if (newQty <= 0) {
      this.removeItemFromCart(productId);
      return;
    }

    if (newQty > item.maxStock) {
      App.toast('warning', 'Stock Limit', `Only ${item.maxStock} ${item.unit || ''} available in store`);
      return;
    }

    item.qty = newQty;
    this.renderCart();
  }

  setItemQty(productId, rawQty) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    const parsed = DB.roundQty(parseFloat(rawQty));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.removeItemFromCart(productId);
      return;
    }
    if (parsed > item.maxStock) {
      App.toast('warning', 'Stock Limit', `Capped to available stock: ${item.maxStock} ${item.unit || ''}`);
      item.qty = item.maxStock;
    } else {
      item.qty = parsed;
    }
    this.renderCart();
  }

  toggleWeightChips(productId) {
    this._expandedWeightId = this._expandedWeightId === productId ? null : productId;
    this.renderCart();
  }

  removeItemFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    if (this._expandedWeightId === productId) this._expandedWeightId = null;
    this.renderCart();
  }

  clearCart() {
    this.cart = [];
    this.discountValue = 0;
    this._expandedWeightId = null;
    this.renderCart();
  }

  setPaymentMode(mode) {
    this.paymentMode = mode;
    this.renderCart();
  }

  setQuickTender(amount, isExact = false, grandTotal = 0) {
    const input = document.getElementById('pos-cash-tendered');
    if (!input) return;
    if (isExact) {
      input.value = DB.round2(grandTotal);
    } else {
      const current = parseFloat(input.value) || 0;
      input.value = DB.round2(current + amount);
    }
    this.calculateCashChange(grandTotal);
  }

  calculateCashChange(grandTotal) {
    const input = document.getElementById('pos-cash-tendered');
    const changeEl = document.getElementById('pos-cash-change');
    if (!input || !changeEl) return;
    const tendered = parseFloat(input.value) || 0;
    const change = Math.max(0, DB.round2(tendered - grandTotal));
    changeEl.textContent = `₹${change.toLocaleString('en-IN')}`;
    changeEl.style.color = tendered >= grandTotal ? 'var(--success)' : 'var(--danger)';
  }

  setCategoryFilter(category) {
    this.activeCategory = category;
    document.querySelectorAll('.cat-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.cat === category);
    });
    this.renderCatalog();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderCatalog();
  }

  handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const query = (event.target.value || '').trim();
      if (!query) return;

      const db = DB.getData();
      const exactMatch = (db.products || []).find(p =>
        p.barcode === query ||
        p.id.toLowerCase() === query.toLowerCase() ||
        p.name.toLowerCase() === query.toLowerCase()
      );

      if (exactMatch) {
        this.addItemToCart(exactMatch);
        event.target.value = '';
        this.setSearchQuery('');
        App.toast('success', `Added: ${exactMatch.name}`, `₹${exactMatch.price} added to current bill`);
      } else if (/^\d{6,14}$/.test(query)) {
        if (window.BarcodeScanner) {
          BarcodeScanner.openScannerModal();
          BarcodeScanner.onBarcodeDetected(query, 'pos_manual');
        }
      }
    }
  }

  // Calculate bill finances with slab-wise GST & proportional discount allocation
  calculateTotals() {
    const db = DB.getData();
    const defaultRate = [0, 5, 12, 18].includes(Number(db.shop && db.shop.taxRate))
      ? Number(db.shop.taxRate)
      : 5;

    const subtotal = DB.round2(this.cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0));
    const totalMrp = DB.round2(this.cart.reduce((sum, item) => sum + ((Number(item.mrp) || Number(item.price)) * Number(item.qty)), 0));
    const mrpSavings = Math.max(0, DB.round2(totalMrp - subtotal));

    let discount = 0;
    if (this.discountType === 'percent') {
      discount = DB.round2((subtotal * (Number(this.discountValue) || 0)) / 100);
    } else {
      discount = DB.round2(Number(this.discountValue) || 0);
    }
    discount = Math.min(Math.max(0, discount), subtotal);

    const discountRatio = subtotal > 0 ? (discount / subtotal) : 0;
    const gstBreakdown = {};
    let taxAmount = 0;

    this.cart.forEach((item) => {
      const rate = [0, 5, 12, 18].includes(Number(item.gstRate)) ? Number(item.gstRate) : defaultRate;
      const lineGross = DB.round2(Number(item.price) * Number(item.qty));
      const lineNet = DB.round2(lineGross * (1 - discountRatio));
      const lineTax = DB.round2((lineNet * rate) / 100);
      taxAmount = DB.round2(taxAmount + lineTax);

      const key = String(rate);
      if (!gstBreakdown[key]) {
        gstBreakdown[key] = { rate, taxable: 0, tax: 0 };
      }
      gstBreakdown[key].taxable = DB.round2(gstBreakdown[key].taxable + lineNet);
      gstBreakdown[key].tax = DB.round2(gstBreakdown[key].tax + lineTax);
    });

    const discountedSubtotal = DB.round2(subtotal - discount);
    const grandTotal = DB.round2(discountedSubtotal + taxAmount);

    return {
      subtotal,
      totalMrp,
      mrpSavings,
      discount,
      taxRate: subtotal > 0 ? DB.round2((taxAmount / Math.max(1, discountedSubtotal)) * 100) : defaultRate,
      taxAmount,
      gstBreakdown,
      grandTotal
    };
  }

  // Render Product Catalog in POS
  renderCatalog() {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    const db = DB.getData();
    let products = db.products || [];

    if (this.activeCategory !== 'All') {
      products = products.filter(p => p.cat === this.activeCategory);
    }

    if (this.searchQuery) {
      products = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(this.searchQuery)) ||
        (p.barcode && p.barcode.includes(this.searchQuery)) ||
        (p.cat && p.cat.toLowerCase().includes(this.searchQuery))
      );
    }

    if (!products.length) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">${Icons.search(32)}</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">No products match your search</div>
          <p style="font-size: 12px; margin-top: 4px;">Try searching with a different product name or barcode.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="POS.clearSearch()">Clear Filter</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(p => {
      const stockNum = DB.roundQty(p.stock || 0);
      const isOutOfStock = stockNum <= 0;
      const isLowStock = stockNum > 0 && stockNum <= (Number(p.minStock) || 0);
      const mrpSave = (Number(p.mrp) || 0) > (Number(p.price) || 0) ? DB.round2(Number(p.mrp) - Number(p.price)) : 0;
      const gst = [0, 5, 12, 18].includes(Number(p.gstRate)) ? Number(p.gstRate) : DB.inferDefaultGstRate(p.cat, p.name);

      return `
        <div class="pos-prod-card" onclick="POS.addItemToCart(DB.getData().products.find(x => x.id === '${DB.escapeHtml(p.id)}'))" style="${isOutOfStock ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
          <div class="pos-prod-top">
            <span class="pos-prod-badge">${DB.escapeHtml(p.cat || 'General')} • ${gst}%</span>
            <span class="pos-prod-sku">${DB.escapeHtml(p.barcode ? p.barcode.slice(-5) : p.id)}</span>
          </div>

          <div class="pos-prod-title">${DB.escapeHtml(p.name)}</div>

          <div class="pos-prod-mrp-row">
            ${p.mrp > 0 ? `<span class="pos-prod-mrp">MRP ₹${DB.round2(p.mrp)}</span>` : ''}
            ${mrpSave > 0 ? `<span class="pos-prod-save">Save ₹${mrpSave}</span>` : ''}
          </div>

          <div class="pos-prod-price-row">
            <div class="pos-prod-price tnum">₹${DB.round2(p.price)}<span style="font-size: 10px; font-weight: 500; color: var(--text-muted);">/${DB.escapeHtml(p.unit || 'u')}</span></div>
            <div class="pos-prod-stock" style="color: ${isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)'};">
              ${isOutOfStock ? 'Out of stock' : `${stockNum} ${DB.escapeHtml(p.unit || '')}`}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  clearSearch() {
    this.searchQuery = "";
    const input = document.getElementById('pos-search-input');
    if (input) input.value = "";
    this.renderCatalog();
  }

  toggleMobileCartDrawer() {
    const panel = document.getElementById('pos-cart-panel');
    if (panel) panel.classList.toggle('open-mobile');
  }

  // Render Cart Register Side Panel
  renderCart() {
    const list = document.getElementById('pos-cart-items-list');
    const summaryArea = document.getElementById('pos-cart-summary-area');
    const countBadge = document.getElementById('pos-cart-count');
    const mobileCartCount = document.getElementById('mobile-cart-count');
    const mobileCartTotal = document.getElementById('mobile-cart-total');

    this.updateParkedBadge();
    if (!list || !summaryArea) return;

    const totalQty = DB.roundQty(this.cart.reduce((s, i) => s + Number(i.qty || 0), 0));
    const calc = this.calculateTotals();

    if (countBadge) countBadge.textContent = `${this.cart.length} (${totalQty})`;
    if (mobileCartCount) mobileCartCount.textContent = this.cart.length;
    if (mobileCartTotal) mobileCartTotal.textContent = `₹${calc.grandTotal.toLocaleString('en-IN')}`;

    if (!this.cart.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 36px 12px; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">${Icons.pos(30)}</div>
          <div style="font-weight: 600; font-size: 13.5px; color: var(--text-secondary);">Cart is empty</div>
          <p style="font-size: 12px; margin-top: 4px;">Tap products, scan barcode, or use Voice Mic</p>
        </div>
      `;
      summaryArea.innerHTML = '';
      return;
    }

    list.innerHTML = this.cart.map(item => {
      const showWeights = this.isWeightUnit(item.unit) || this._expandedWeightId === item.id;
      const presets = this.getWeightPresets(item.unit);
      const lineTotal = DB.round2(item.price * item.qty);
      const stepDelta = this.isWeightUnit(item.unit) ? 0.5 : 1;

      return `
        <div class="cart-item-block">
          <div class="cart-item-row">
            <div class="cart-item-info">
              <div class="cart-item-name">${DB.escapeHtml(item.name)}</div>
              <div class="cart-item-sub">₹${DB.round2(item.price)}/${DB.escapeHtml(item.unit)} • GST ${item.gstRate}%</div>
            </div>
            <div class="cart-qty-ctrl">
              <button class="cart-qty-btn" type="button" onclick="POS.updateItemQty('${DB.escapeHtml(item.id)}', -${stepDelta})" title="Decrease">−</button>
              <input type="number" step="any" min="0.01" class="cart-qty-input tnum" value="${DB.roundQty(item.qty)}" onchange="POS.setItemQty('${DB.escapeHtml(item.id)}', this.value)" title="Enter exact / decimal quantity" />
              <button class="cart-qty-btn" type="button" onclick="POS.updateItemQty('${DB.escapeHtml(item.id)}', ${stepDelta})" title="Increase">+</button>
            </div>
            <button class="cart-weight-toggle ${showWeights ? 'active' : ''}" type="button" onclick="POS.toggleWeightChips('${DB.escapeHtml(item.id)}')" title="Quick Loose Weight / Decimal Presets">
              ${Icons.scale(13)}
            </button>
            <div class="cart-item-total tnum">₹${lineTotal.toLocaleString('en-IN')}</div>
            <button class="cart-item-del" type="button" onclick="POS.removeItemFromCart('${DB.escapeHtml(item.id)}')" title="Remove Item">
              ${Icons.close(14)}
            </button>
          </div>
          ${showWeights ? `
            <div class="weight-chips-row">
              ${presets.map(pr => `
                <button type="button" class="weight-chip-btn ${Math.abs(item.qty - pr.qty) < 0.001 ? 'active' : ''}" onclick="POS.setItemQty('${DB.escapeHtml(item.id)}', ${pr.qty})">
                  ${pr.label}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const db = DB.getData();
    const customers = db.customers || [];
    const activeSlabs = Object.values(calc.gstBreakdown).filter(s => s.tax > 0);

    summaryArea.innerHTML = `
      <div class="pos-cart-summary">
        <div class="form-group" style="margin-bottom: 8px;">
          <div style="display: flex; gap: 6px;">
            <select id="pos-customer-select" class="form-select" style="flex: 1; min-width: 0; font-size: 12.5px; padding: 6px 10px;" onchange="POS.selectedCustomerId = this.value">
              <option value="">Walk-in Customer</option>
              ${customers.map(c => `
                <option value="${DB.escapeHtml(c.id)}" ${this.selectedCustomerId === c.id ? 'selected' : ''}>
                  ${DB.escapeHtml(c.name)} (${DB.escapeHtml(c.phone || '')}) ${c.balanceDue > 0 ? `• Due: ₹${DB.round2(c.balanceDue)}` : ''}
                </option>
              `).join('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Khata.openCustomerModal()" title="Add Customer">
              ${Icons.plus(13)}
            </button>
          </div>
        </div>

        <div class="summary-line">
          <span>Subtotal (${this.cart.length} items):</span>
          <span class="tnum">₹${calc.subtotal.toLocaleString('en-IN')}</span>
        </div>

        ${calc.mrpSavings > 0 ? `
          <div class="summary-line" style="color: var(--success);">
            <span>Total MRP Savings:</span>
            <span class="tnum">-₹${calc.mrpSavings.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}

        ${activeSlabs.length ? activeSlabs.map(sl => `
          <div class="summary-line" style="font-size: 11.5px;">
            <span>GST @ ${sl.rate}% (on ₹${sl.taxable.toLocaleString('en-IN')}):</span>
            <span class="tnum">+₹${sl.tax.toLocaleString('en-IN')}</span>
          </div>
        `).join('') : ''}

        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Discount:</span>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='percent'; POS.discountValue=5; POS.renderCart();">5%</button>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='percent'; POS.discountValue=10; POS.renderCart();">10%</button>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='fixed'; POS.discountValue=50; POS.renderCart();">₹50</button>
          ${this.discountValue > 0 ? `
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px; color: var(--danger);" onclick="POS.discountValue=0; POS.renderCart();">✕ Clear</button>
          ` : ''}
        </div>

        ${calc.discount > 0 ? `
          <div class="summary-line" style="color: var(--danger);">
            <span>Discount Applied:</span>
            <span class="tnum">-₹${calc.discount.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}

        <div class="summary-line total">
          <span>Grand Total:</span>
          <span class="tnum">₹${calc.grandTotal.toLocaleString('en-IN')}</span>
        </div>

        <div class="payment-modes-grid">
          <div class="pm-btn ${this.paymentMode === 'Cash' ? 'active' : ''}" onclick="POS.setPaymentMode('Cash')">
            <span>💵</span>
            <span>Cash (F8)</span>
          </div>
          <div class="pm-btn ${this.paymentMode === 'UPI' ? 'active' : ''}" onclick="POS.setPaymentMode('UPI')">
            <span>📱</span>
            <span>UPI QR (F9)</span>
          </div>
          <div class="pm-btn ${this.paymentMode === 'Card' ? 'active' : ''}" onclick="POS.setPaymentMode('Card')">
            <span>💳</span>
            <span>Card</span>
          </div>
          <div class="pm-btn ${this.paymentMode === 'Udhaar' ? 'active' : ''}" onclick="POS.setPaymentMode('Udhaar')">
            <span>📒</span>
            <span>Udhaar (F10)</span>
          </div>
        </div>

        ${this.paymentMode === 'Cash' ? `
          <div style="background: var(--bg-input); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 6px;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px;">
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500; white-space: nowrap;">Tendered: ₹</span>
              <input type="number" step="0.01" id="pos-cash-tendered" class="form-input" style="flex: 1; min-width: 110px; height: 32px; padding: 4px 8px; font-weight: 700; font-size: 14px;" value="${calc.grandTotal}" oninput="POS.calculateCashChange(${calc.grandTotal})" />
            </div>
            <div class="cash-tender-row">
              <div class="cash-note-chip" onclick="POS.setQuickTender(100, false, ${calc.grandTotal})">+₹100</div>
              <div class="cash-note-chip" onclick="POS.setQuickTender(200, false, ${calc.grandTotal})">+₹200</div>
              <div class="cash-note-chip" onclick="POS.setQuickTender(500, false, ${calc.grandTotal})">+₹500</div>
              <div class="cash-note-chip" onclick="POS.setQuickTender(0, true, ${calc.grandTotal})">Exact</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-subtle);">
              <span>Change to Return:</span>
              <span id="pos-cash-change" style="color: var(--success);">₹0</span>
            </div>
          </div>
        ` : ''}

        ${this.paymentMode === 'UPI' ? `
          <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center; margin-bottom: 6px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--primary); margin-bottom: 8px;">
              Scan with PhonePe • Google Pay • Paytm • BHIM
            </div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(db.shop.upiId || '6306437348@upi')}%26pn%3D${encodeURIComponent(db.shop.name || 'MyDukkan24')}%26am%3D${calc.grandTotal}%26cu%3DINR" alt="UPI QR Code" style="width: 130px; height: 130px; border-radius: 6px; background: #FFF; padding: 4px;" />
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; font-family: var(--font-mono);">
              ${DB.escapeHtml(db.shop.upiId || '6306437348@upi')} • ₹${calc.grandTotal}
            </div>
          </div>
        ` : ''}

        <button type="button" class="btn btn-primary w100 btn-lg" style="margin-top: 4px;" onclick="POS.processCheckout()">
          ${Icons.check(16)} Complete Bill (₹${calc.grandTotal.toLocaleString('en-IN')})
        </button>
      </div>
    `;
  }

  // =========================================================================
  // HOLD / PARK CART QUEUE (Multi-Customer Switching)
  // =========================================================================
  updateParkedBadge() {
    const badge = document.getElementById('pos-parked-count');
    const db = DB.getData();
    const count = (db.parkedCarts || []).length;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  parkActiveCart() {
    if (!this.cart.length) {
      App.toast('warning', 'Empty Cart', 'Add items before putting a bill on hold.');
      return;
    }

    const db = DB.getData();
    if (!Array.isArray(db.parkedCarts)) db.parkedCarts = [];
    const cust = this.selectedCustomerId ? (db.customers || []).find(c => c.id === this.selectedCustomerId) : null;
    const defaultLabel = cust ? `${cust.name}` : `Customer Hold #${db.parkedCarts.length + 1}`;
    const customLabel = prompt('Hold label / customer name (e.g. "Green Bag Aunty"):', defaultLabel);
    if (customLabel === null) return;

    const parked = {
      id: DB.uid('HOLD-'),
      label: (customLabel || defaultLabel).trim().slice(0, 80),
      customerId: this.selectedCustomerId || null,
      discountType: this.discountType === 'percent' ? 'pct' : 'flat',
      discountValue: Number(this.discountValue) || 0,
      paymentMode: this.paymentMode || 'Cash',
      parkedAt: Date.now(),
      items: this.cart.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        cost: i.cost,
        mrp: i.mrp,
        unit: i.unit,
        gstRate: i.gstRate,
        emoji: i.emoji || '',
        qty: i.qty
      }))
    };

    db.parkedCarts.unshift(parked);
    if (db.parkedCarts.length > 25) db.parkedCarts = db.parkedCarts.slice(0, 25);
    DB.saveData(db);

    this.cart = [];
    this.selectedCustomerId = "";
    this.discountValue = 0;
    this.renderCart();
    App.toast('info', 'Bill Put On Hold', `"${parked.label}" parked. Counter ready for next customer!`);
  }

  openParkedCartsModal() {
    const db = DB.getData();
    const parkedList = db.parkedCarts || [];

    const existing = document.getElementById('parked-carts-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-backdrop" id="parked-carts-modal" onclick="if(event.target===this) POS.closeParkedModal()">
        <div class="modal-card" style="max-width: 520px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.pause(16)} Held / Parked Customer Bills (${parkedList.length})</div>
            <button class="topbar-icon-btn" onclick="POS.closeParkedModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            ${parkedList.length ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${parkedList.map(h => {
                  const totalAmt = DB.round2((h.items || []).reduce((s, i) => s + (Number(i.price) * Number(i.qty)), 0));
                  const minsAgo = Math.max(1, Math.round((Date.now() - (h.parkedAt || Date.now())) / 60000));
                  return `
                    <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                      <div style="flex: 1 1 200px; min-width: 0;">
                        <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${DB.escapeHtml(h.label || 'Parked Bill')}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                          ${(h.items || []).length} items • ₹${totalAmt.toLocaleString('en-IN')} • Held ${minsAgo}m ago
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          ${(h.items || []).map(i => `${i.name} (${i.qty})`).join(', ')}
                        </div>
                      </div>
                      <div style="display: flex; gap: 6px;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="POS.resumeParkedCart('${DB.escapeHtml(h.id)}')">
                          Resume Bill
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="POS.deleteParkedCart('${DB.escapeHtml(h.id)}')" title="Discard Held Bill">
                          ${Icons.trash(13)}
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                <div style="margin-bottom: 8px;">${Icons.pause(30)}</div>
                <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No Bills on Hold</div>
                <p style="font-size: 12px; margin-top: 4px;">When a customer steps away to pick more items, click "Hold" in the cart panel.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  resumeParkedCart(holdId) {
    const db = DB.getData();
    const list = db.parkedCarts || [];
    const target = list.find(h => h.id === holdId);
    if (!target) return;

    // If counter currently has items, park them automatically so nothing is lost
    if (this.cart.length > 0) {
      list.unshift({
        id: DB.uid('HOLD-'),
        label: `Auto-Held Bill (${this.cart.length} items)`,
        customerId: this.selectedCustomerId || null,
        discountType: this.discountType === 'percent' ? 'pct' : 'flat',
        discountValue: Number(this.discountValue) || 0,
        paymentMode: this.paymentMode || 'Cash',
        parkedAt: Date.now(),
        items: this.cart.map(i => ({
          productId: i.id,
          name: i.name,
          price: i.price,
          cost: i.cost,
          mrp: i.mrp,
          unit: i.unit,
          gstRate: i.gstRate,
          emoji: i.emoji || '',
          qty: i.qty
        }))
      });
    }

    db.parkedCarts = list.filter(h => h.id !== holdId);
    DB.saveData(db);

    const restoredCart = [];
    const stockWarnings = [];
    (target.items || []).forEach(item => {
      const prodId = item.productId || item.id;
      const prod = (db.products || []).find(p => p.id === prodId);
      const maxStock = prod ? DB.roundQty(prod.stock || 0) : Number(item.qty || 1);
      if (prod && maxStock <= 0) {
        stockWarnings.push(`${item.name} is now out of stock`);
        return;
      }
      const clampedQty = prod ? Math.min(DB.roundQty(item.qty), maxStock) : DB.roundQty(item.qty);
      if (prod && clampedQty < item.qty) {
        stockWarnings.push(`${item.name} adjusted to ${clampedQty} (stock limit)`);
      }
      restoredCart.push({
        id: prodId,
        name: prod ? prod.name : item.name,
        cat: prod ? prod.cat : 'General',
        barcode: prod ? prod.barcode : '',
        mrp: prod ? prod.mrp : (item.mrp || item.price),
        price: prod ? prod.price : item.price,
        cost: prod ? prod.cost : (item.cost || item.price * 0.8),
        unit: prod ? prod.unit : (item.unit || 'pack'),
        gstRate: prod ? ([0, 5, 12, 18].includes(Number(prod.gstRate)) ? Number(prod.gstRate) : 5) : (item.gstRate ?? 5),
        maxStock,
        qty: clampedQty
      });
    });

    this.cart = restoredCart;
    this.selectedCustomerId = target.customerId || '';
    this.discountType = target.discountType === 'pct' ? 'percent' : 'fixed';
    this.discountValue = Number(target.discountValue) || 0;
    this.paymentMode = target.paymentMode || 'Cash';

    this.closeParkedModal();
    this.renderCart();
    App.toast('success', 'Resumed Held Bill', `Loaded "${target.label}" (${restoredCart.length} items)`);
    if (stockWarnings.length) {
      App.toast('warning', 'Stock Check', stockWarnings.join(' • '));
    }
  }

  deleteParkedCart(holdId) {
    const db = DB.getData();
    db.parkedCarts = (db.parkedCarts || []).filter(h => h.id !== holdId);
    DB.saveData(db);
    this.updateParkedBadge();
    this.openParkedCartsModal();
  }

  closeParkedModal() {
    const m = document.getElementById('parked-carts-modal');
    if (m) m.remove();
  }

  // =========================================================================
  // HINDI / HINGLISH VOICE BILLING ENGINE (Live Online Gemini + Offline Parser)
  // =========================================================================
  openVoiceBillingModal() {
    const existing = document.getElementById('voice-billing-modal');
    if (existing) existing.remove();
    this._voiceParsedItems = [];

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeech = Boolean(SpeechRec);
    const isOnline = navigator.onLine !== false;

    const modalHtml = `
      <div class="modal-backdrop" id="voice-billing-modal" onclick="if(event.target===this) POS.closeVoiceBillingModal()">
        <div class="modal-card" style="max-width: 560px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.mic(16)} Hindi / Hinglish Voice Billing</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge ${isOnline ? 'badge-success' : 'badge-warning'}">${isOnline ? '🟢 Online Gemini 3.8' : '🟠 Offline Matcher'}</span>
              <button class="topbar-icon-btn" onclick="POS.closeVoiceBillingModal()">✕</button>
            </div>
          </div>
          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Speak Order naturally in Hindi or English</div>
                <div style="font-size: 11px; color: var(--text-muted);">Supports "do packet Maggi", "aadha kilo Toor Dal", "1 litre Fortune oil"</div>
              </div>
              <select id="voice-lang-select" class="form-select" style="width: auto; font-size: 12px; padding: 5px 10px;" onchange="POS._voiceLang = this.value;">
                <option value="hi-IN" ${this._voiceLang === 'hi-IN' ? 'selected' : ''}>🇮🇳 Hindi / Hinglish</option>
                <option value="en-IN" ${this._voiceLang === 'en-IN' ? 'selected' : ''}>🌐 English (India)</option>
              </select>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" id="voice-mic-btn" class="btn ${hasSpeech ? 'btn-primary' : 'btn-secondary'}" style="flex: 1 1 170px; justify-content: center;" onclick="POS.toggleVoiceListening()">
                ${Icons.mic(15)} <span id="voice-mic-label">${hasSpeech ? 'Tap Mic & Speak' : 'Mic Unavailable (Type Below)'}</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('voice-transcript-input').value = '2 packet Maggi, 1 litre Fortune oil, aur 500g Butter add karo';">
                Try Sample Order
              </button>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Spoken / Typed Order Text</label>
              <textarea id="voice-transcript-input" class="form-textarea" rows="2" placeholder='e.g. "do Maggi, ek Amul butter aur 1 kilo atta add karo"'></textarea>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" style="flex: 1;" onclick="POS.parseVoiceTranscript()">
                ${Icons.sparkles(14)} Match Products to Cart
              </button>
            </div>

            <div id="voice-parse-status"></div>
            <div id="voice-parsed-results"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  toggleVoiceListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      App.toast('warning', 'Speech API Unsupported', 'Type or paste your Hindi/Hinglish order in the box below.');
      return;
    }

    if (this._voiceListening && this._voiceRecognition) {
      try { this._voiceRecognition.stop(); } catch (e) {}
      this._voiceListening = false;
      this.updateMicButtonUI(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = this._voiceLang || 'hi-IN';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      this._voiceRecognition = rec;
      this._voiceListening = true;
      this.updateMicButtonUI(true);

      rec.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        const input = document.getElementById('voice-transcript-input');
        if (input) input.value = transcript.trim();
        if (event.results[event.results.length - 1].isFinal) {
          this._voiceListening = false;
          this.updateMicButtonUI(false);
          this.parseVoiceTranscript();
        }
      };

      rec.onerror = (err) => {
        this._voiceListening = false;
        this.updateMicButtonUI(false);
        const msg = err && err.error === 'not-allowed'
          ? 'Microphone permission denied. Enable mic access or type below.'
          : `Voice capture notice: ${(err && err.error) || 'retry or type below'}`;
        App.toast('warning', 'Mic Notice', msg);
      };

      rec.onend = () => {
        this._voiceListening = false;
        this.updateMicButtonUI(false);
      };

      rec.start();
    } catch (err) {
      this._voiceListening = false;
      this.updateMicButtonUI(false);
      App.toast('warning', 'Voice Error', err.message || 'Unable to start microphone.');
    }
  }

  updateMicButtonUI(listening) {
    const btn = document.getElementById('voice-mic-btn');
    const label = document.getElementById('voice-mic-label');
    if (btn) btn.classList.toggle('voice-pulse-active', listening);
    if (label) label.textContent = listening ? 'Listening... (Tap to Stop)' : 'Tap Mic & Speak';
  }

  async parseVoiceTranscript(forceOffline = false) {
    const text = (document.getElementById('voice-transcript-input')?.value || '').trim();
    const statusEl = document.getElementById('voice-parse-status');
    const resultsEl = document.getElementById('voice-parsed-results');
    if (!statusEl || !resultsEl) return;

    if (!text) {
      App.toast('warning', 'Empty Input', 'Speak or enter an order first.');
      return;
    }

    const db = DB.getData();
    const products = db.products || [];
    const online = navigator.onLine !== false && !forceOffline;

    if (!online) {
      const matched = this.parseVoiceOfflineHinglish(text, products);
      this.renderVoiceParsedItems(
        matched,
        forceOffline ? '🟠 Offline Hinglish Parser (User Requested Fallback)' : '🟠 Offline Hinglish Parser',
        null
      );
      return;
    }

    statusEl.innerHTML = `<div style="font-size: 12px; color: var(--primary); font-weight: 600;">⚡ Matching "${DB.escapeHtml(text)}" with Gemini 3.8 Flash...</div>`;
    resultsEl.innerHTML = '';

    const res = window.DukaanAI && typeof DukaanAI.parseVoiceCartOnline === 'function'
      ? await DukaanAI.parseVoiceCartOnline(text, products)
      : { ok: false, error: 'AI helper unavailable' };

    if (res && res.ok) {
      const enriched = (res.items || []).map(it => {
        const prod = products.find(p => p.id === it.productId) ||
          products.find(p => p.name.toLowerCase().includes(String(it.name || '').toLowerCase()));
        if (!prod) return null;
        return {
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          unit: prod.unit || 'pack',
          stock: prod.stock,
          qty: Math.max(0.05, DB.roundQty(it.qty || 1))
        };
      }).filter(Boolean);

      this.renderVoiceParsedItems(enriched, `🟢 Live ${res.model || 'Gemini 3.8'}`, res.unmatched || []);
    } else {
      const errMsg = (res && res.error) || 'Could not reach live Gemini parser.';
      statusEl.innerHTML = `
        <div style="background: var(--danger-light); border: 1px solid var(--danger-border); padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; color: var(--danger); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span><strong>Live Voice API Error:</strong> ${DB.escapeHtml(errMsg)}</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="POS.parseVoiceTranscript(true)">Use Offline Hinglish Matcher</button>
        </div>
      `;
    }
  }

  parseVoiceOfflineHinglish(text, products) {
    const wordNums = {
      ek: 1, one: 1, a: 1,
      do: 2, two: 2,
      teen: 3, three: 3,
      char: 4, four: 4,
      paanch: 5, panch: 5, five: 5,
      chhah: 6, cheh: 6, six: 6,
      saat: 7, seven: 7,
      aath: 8, eight: 8,
      nau: 9, nine: 9,
      das: 10, ten: 10,
      aadha: 0.5, adha: 0.5, half: 0.5,
      pav: 0.25, pao: 0.25, quarter: 0.25,
      sawa: 1.25, dedh: 1.5, dhai: 2.5
    };

    const stopWords = new Set(['aur', 'and', 'add', 'karo', 'kardo', 'de', 'do', 'dena', 'chahiye', 'packet', 'packets', 'pack', 'packs', 'box', 'bottle', 'pcs', 'piece', 'pieces', 'unit', 'units', 'ka', 'ki', 'ke', 'bhai']);
    const clauses = String(text || '')
      .toLowerCase()
      .split(/[,;+&]+|\baur\b|\band\b/g)
      .map(s => s.trim())
      .filter(Boolean);

    const matchedMap = new Map();

    clauses.forEach(clause => {
      let qty = 1;
      let isGramsOrMl = false;
      const gramMatch = clause.match(/\b(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|ml)\b/i);
      const numMatch = clause.match(/\b(\d+(?:\.\d+)?)\b/);

      if (gramMatch) {
        qty = parseFloat(gramMatch[1]) / 1000;
        isGramsOrMl = true;
      } else if (numMatch) {
        qty = parseFloat(numMatch[1]);
      } else {
        const tokens = clause.split(/\s+/);
        for (const t of tokens) {
          if (wordNums[t] !== undefined) {
            qty = wordNums[t];
            break;
          }
        }
      }

      const keywords = clause
        .replace(/\b\d+(?:\.\d+)?\s*(kg|g|gm|gram|grams|l|ltr|litre|liter|ml)?\b/gi, ' ')
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length >= 2 && !stopWords.has(w) && wordNums[w] === undefined && w !== 'kilo' && w !== 'kg' && w !== 'litre' && w !== 'liter');

      if (!keywords.length) return;

      let bestProd = null;
      let bestScore = 0;
      products.forEach(p => {
        const hay = `${p.name} ${p.cat || ''}`.toLowerCase();
        let score = 0;
        keywords.forEach(k => {
          if (hay.includes(k)) score += (k.length >= 4 ? 3 : 2);
        });
        if (score > bestScore) {
          bestScore = score;
          bestProd = p;
        }
      });

      if (bestProd && bestScore >= 2) {
        let finalQty = qty;
        // If someone said "500g Maggi" vs "500g Basmati Rice" (kg unit): keep 0.5 only for kg/litre
        if (isGramsOrMl && !this.isWeightUnit(bestProd.unit)) {
          finalQty = 1;
        }
        finalQty = Math.max(0.05, DB.roundQty(finalQty));
        if (matchedMap.has(bestProd.id)) {
          matchedMap.get(bestProd.id).qty = DB.roundQty(matchedMap.get(bestProd.id).qty + finalQty);
        } else {
          matchedMap.set(bestProd.id, {
            productId: bestProd.id,
            name: bestProd.name,
            price: bestProd.price,
            unit: bestProd.unit || 'pack',
            stock: bestProd.stock,
            qty: finalQty
          });
        }
      }
    });

    return Array.from(matchedMap.values());
  }

  renderVoiceParsedItems(items, badgeLabel, unmatched = null) {
    const statusEl = document.getElementById('voice-parse-status');
    const resultsEl = document.getElementById('voice-parsed-results');
    if (!statusEl || !resultsEl) return;

    this._voiceParsedItems = items;
    statusEl.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted);">${badgeLabel} • Found ${items.length} matching catalog item(s)</div>`;

    if (!items.length) {
      resultsEl.innerHTML = `
        <div style="padding: 18px; text-align: center; background: var(--bg-input); border-radius: var(--radius-md); color: var(--text-muted); font-size: 12.5px;">
          No exact catalog match found. Try naming a stocked item like "Maggi", "Butter", "Atta", or "Tata Tea".
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;">
        ${items.map((it, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--bg-input); padding: 8px 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">${DB.escapeHtml(it.name)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">₹${DB.round2(it.price)}/${DB.escapeHtml(it.unit)} • Stock: ${DB.roundQty(it.stock)}</div>
            </div>
            <input type="number" step="any" min="0.05" class="form-input" style="width: 72px; height: 30px; padding: 4px 6px; font-size: 12.5px; font-weight: 700; text-align: center;" value="${it.qty}" onchange="POS._voiceParsedItems[${idx}].qty = Math.max(0.05, DB.roundQty(this.value))" />
            <button type="button" class="btn btn-danger btn-sm" onclick="POS._voiceParsedItems.splice(${idx}, 1); POS.renderVoiceParsedItems(POS._voiceParsedItems, '${DB.escapeHtml(badgeLabel)}')">✕</button>
          </div>
        `).join('')}
      </div>
      ${unmatched && unmatched.length ? `<div style="font-size: 11px; color: var(--warning); margin-top: 6px;">Unmatched: ${DB.escapeHtml(unmatched.join(', '))}</div>` : ''}
      <button type="button" class="btn btn-success w100" style="margin-top: 10px;" onclick="POS.applyVoiceItemsToCart()">
        ${Icons.check(15)} Add ${items.length} Item(s) to POS Cart
      </button>
    `;
  }

  applyVoiceItemsToCart() {
    const db = DB.getData();
    let added = 0;
    this._voiceParsedItems.forEach(it => {
      const prod = (db.products || []).find(p => p.id === it.productId);
      if (prod && this.addItemToCart(prod, it.qty)) added++;
    });
    this.closeVoiceBillingModal();
    if (added > 0) {
      App.toast('success', 'Voice Order Added', `${added} item(s) added to active POS bill!`);
    }
  }

  closeVoiceBillingModal() {
    if (this._voiceListening && this._voiceRecognition) {
      try { this._voiceRecognition.stop(); } catch (e) {}
    }
    this._voiceListening = false;
    const m = document.getElementById('voice-billing-modal');
    if (m) m.remove();
  }

  // Complete checkout & generate invoice
  processCheckout() {
    if (!this.cart.length) {
      App.toast('warning', 'Empty Cart', 'Add at least one item');
      return;
    }

    const calc = this.calculateTotals();
    const db = DB.getData();

    let customer = null;
    if (this.selectedCustomerId) {
      customer = (db.customers || []).find(c => c.id === this.selectedCustomerId);
    }

    if (this.paymentMode === 'Udhaar' && !customer) {
      App.toast('warning', 'Customer Required', 'Select a customer from the dropdown for Udhaar (Credit) billing');
      return;
    }

    const dateStr = DB.getLocalDateStr();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const invoiceId = DB.uid('INV-');

    const isPaid = this.paymentMode !== 'Udhaar';
    const cashierName = (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode())
      ? DB.getDeviceCashierName()
      : ((db.shop && db.shop.owner) || 'Owner');

    const discountRatio = calc.subtotal > 0 ? (calc.discount / calc.subtotal) : 0;

    const invoice = {
      id: invoiceId,
      date: dateStr,
      time: timeStr,
      customerId: customer ? customer.id : "WALKIN",
      customerName: customer ? customer.name : "Walk-in Customer",
      customerPhone: customer ? customer.phone : "",
      cashierName,
      items: this.cart.map(i => {
        const lineGross = DB.round2(i.price * i.qty);
        const lineTax = DB.round2((lineGross * (1 - discountRatio) * (i.gstRate ?? 5)) / 100);
        return {
          id: i.id,
          name: i.name,
          qty: DB.roundQty(i.qty),
          mrp: DB.round2(i.mrp),
          price: DB.round2(i.price),
          cost: DB.round2(i.cost),
          unit: i.unit,
          gstRate: [0, 5, 12, 18].includes(Number(i.gstRate)) ? Number(i.gstRate) : 5,
          tax: lineTax,
          total: lineGross
        };
      }),
      subtotal: calc.subtotal,
      tax: calc.taxAmount,
      gstBreakdown: calc.gstBreakdown,
      discountType: this.discountType === 'percent' ? 'pct' : 'flat',
      discountValue: Number(this.discountValue) || 0,
      discount: calc.discount,
      total: calc.grandTotal,
      paid: isPaid ? calc.grandTotal : 0,
      due: isPaid ? 0 : calc.grandTotal,
      paymentMode: this.paymentMode,
      status: isPaid ? 'Paid' : 'Due',
      refundAmount: 0,
      returnedItems: []
    };

    // Deduct stock from database accurately with decimal support
    this.cart.forEach(cartItem => {
      const prod = (db.products || []).find(p => p.id === cartItem.id);
      if (prod) {
        prod.stock = Math.max(0, DB.roundQty((Number(prod.stock) || 0) - cartItem.qty));
      }
    });

    // Update customer loyalty & balance
    if (customer) {
      customer.totalSpent = DB.round2((Number(customer.totalSpent) || 0) + calc.grandTotal);
      if (!isPaid) {
        customer.balanceDue = DB.round2((Number(customer.balanceDue) || 0) + calc.grandTotal);
      }
      customer.points = (Number(customer.points) || 0) + Math.floor(calc.grandTotal / 20);
    }

    if (!Array.isArray(db.invoices)) db.invoices = [];
    db.invoices.unshift(invoice);
    DB.saveData(db);

    DB.playCashChime();
    this.openReceiptModal(invoice);

    this.cart = [];
    this.selectedCustomerId = "";
    this.discountValue = 0;
    this._expandedWeightId = null;
    this.renderCart();
    this.renderCatalog();
    App.toast('success', 'Sale Completed!', `Invoice ${invoice.id} recorded`);
  }

  // Thermal Receipt Modal & WhatsApp Share
  openReceiptModal(invoice) {
    if (!invoice) return;
    const db = DB.getData();
    const shop = db.shop || {};
    const slipWidth = shop.rcptWidth === '58mm' ? '52mm' : '72mm';

    const cleanPhone = (invoice.customerPhone || '').replace(/\D/g, '');
    const itemsText = (invoice.items || []).map(it => `• ${it.name} (${it.qty} ${it.unit || ''} x ₹${it.price}) = ₹${it.total}`).join('%0A');
    const waText = `*${encodeURIComponent(shop.name || 'MyDukkan24')}* - INVOICE %23${invoice.id}%0A` +
      `Date: ${invoice.date} ${invoice.time || ''}%0A` +
      `Customer: ${encodeURIComponent(invoice.customerName || 'Walk-in')}%0A%0A` +
      `*Purchased Items:*%0A${itemsText}%0A%0A` +
      `*Total Amount:* ₹${invoice.total}%0A` +
      `*Payment:* ${(invoice.paymentMode || 'Cash').toUpperCase()} (${(invoice.status || 'Paid').toUpperCase()})%0A%0A` +
      `Pay via UPI: ${encodeURIComponent(shop.upiId || '6306437348@upi')}%0A` +
      `_Thank you for your visit! Billed via MyDukkan24 OS_`;

    const waLink = cleanPhone
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${waText}`
      : `https://wa.me/?text=${waText}`;

    const gstSlabs = Object.values(invoice.gstBreakdown || {}).filter(s => (s.tax || 0) > 0);

    const buildReceiptHtml = () => `
      <div style="text-align: center; border-bottom: 1px dashed #71717A; padding-bottom: 6px; margin-bottom: 6px;">
        <div class="thermal-shop-name">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')}</div>
        ${shop.rcptHeader ? `<div style="font-size: 9.5px; color: #374151; font-weight: 700;">${DB.escapeHtml(shop.rcptHeader)}</div>` : ''}
        <div style="font-size: 10px; color: #4B5563;">${DB.escapeHtml(shop.address || '')}</div>
        <div style="font-size: 10px; color: #4B5563;">Ph: ${DB.escapeHtml(shop.phone || '')} ${shop.gstin ? `| GSTIN: ${DB.escapeHtml(shop.gstin)}` : ''}</div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px;">
        <span>Bill: ${DB.escapeHtml(invoice.id)}</span>
        <span>${DB.escapeHtml(invoice.date)} ${DB.escapeHtml(invoice.time || '')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 6px;">
        <span>Customer: ${DB.escapeHtml(invoice.customerName || 'Walk-in')}</span>
        ${invoice.cashierName ? `<span>By: ${DB.escapeHtml(invoice.cashierName)}</span>` : ''}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border-top: 1px dashed #71717A; border-bottom: 1px dashed #71717A; margin-bottom: 6px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 3px 0;">Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.items || []).map(it => `
            <tr>
              <td style="padding: 2px 0;">${DB.escapeHtml(String(it.name || '').slice(0, 18))}</td>
              <td style="text-align: center;">${it.qty}${it.unit && /^(kg|g|litre|l)$/i.test(it.unit) ? it.unit : ''}</td>
              <td style="text-align: right;">₹${it.price}</td>
              <td style="text-align: right;">₹${it.total}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="font-size: 11px;">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${invoice.subtotal}</span></div>
        ${(invoice.discount || 0) > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Discount:</span><span>-₹${invoice.discount}</span></div>` : ''}
        ${gstSlabs.length
          ? gstSlabs.map(sl => `<div style="display: flex; justify-content: space-between; font-size: 10px;"><span>CGST+SGST @${sl.rate}%:</span><span>₹${sl.tax}</span></div>`).join('')
          : ((invoice.tax || 0) > 0 ? `<div style="display: flex; justify-content: space-between;"><span>GST:</span><span>₹${invoice.tax}</span></div>` : '')
        }
        <div class="thermal-total-row">
          <span>GRAND TOTAL:</span>
          <span>₹${Number(invoice.total || 0).toLocaleString('en-IN')}</span>
        </div>
        ${(invoice.refundAmount || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #DC2626; font-weight: 700; margin-top: 2px;">
            <span>Returned / Refunded:</span>
            <span>-₹${Number(invoice.refundAmount).toLocaleString('en-IN')}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Payment Mode:</span>
          <strong>${DB.escapeHtml((invoice.paymentMode || 'Cash').toUpperCase())} (${DB.escapeHtml((invoice.status || 'Paid').toUpperCase())})</strong>
        </div>
      </div>
      <div style="text-align: center; border-top: 1px dashed #71717A; margin-top: 8px; padding-top: 6px; font-size: 9.5px; color: #374151;">
        <div>UPI: ${DB.escapeHtml(shop.upiId || '6306437348@upi')}</div>
        <div>${DB.escapeHtml(shop.rcptFooter || 'Thank you for shopping with us!')}</div>
      </div>
    `;

    const printArea = document.getElementById('thermal-printable-area');
    if (printArea) {
      printArea.className = '';
      printArea.innerHTML = `<div style="font-family: monospace; font-size: 12px; width: ${slipWidth}; margin: 0 auto; line-height: 1.4;">${buildReceiptHtml()}</div>`;
    }

    const modalHtml = `
      <div class="modal-backdrop" id="receipt-modal" onclick="if(event.target === this) POS.closeReceiptModal()">
        <div class="modal-card" style="max-width: 420px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.receipt(16)} Invoice Receipt — ${DB.escapeHtml(invoice.id)}</div>
            <button class="topbar-icon-btn" onclick="POS.closeReceiptModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div class="thermal-receipt-body" style="background: #FFF; color: #000; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 11.5px; border: 1px solid #E2E8F0;">
              ${buildReceiptHtml()}
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 14px;">
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-primary" style="flex: 1 1 140px;" onclick="window.print()">
                  ${Icons.print(15)} Print Thermal Slip
                </button>
                <a href="${waLink}" target="_blank" class="btn btn-success" style="flex: 1 1 140px;">
                  ${Icons.whatsapp(15)} WhatsApp Bill
                </a>
              </div>
              <button class="btn btn-secondary w100" onclick="POS.closeReceiptModal()">
                Close & Next Customer
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.closeReceiptModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  closeReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.remove();
  }
}

window.POS = new POSEngine();
