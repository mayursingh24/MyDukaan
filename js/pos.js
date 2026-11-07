/**
 * MyDukkan24 — High-Speed Retail POS Billing Terminal & Instant Cart Engine
 * Engineered for sub-5-second checkouts, dynamic UPI QR, and instant WhatsApp billing.
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
  }

  init() {
    this.renderCatalog();
    this.renderCart();
  }

  // Add Item to Bill Cart
  addItemToCart(product, qty = 1) {
    if (!product) return;
    if (product.stock <= 0) {
      App.toast('danger', 'Out of Stock', `${product.name} is currently out of stock`);
      return;
    }

    const existing = this.cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty + qty > product.stock) {
        App.toast('warning', 'Stock Limit', `Only ${product.stock} ${product.unit} available`);
        return;
      }
      existing.qty += qty;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        cat: product.cat || 'General',
        barcode: product.barcode,
        mrp: product.mrp,
        price: product.price,
        cost: product.cost,
        unit: product.unit || 'unit',
        maxStock: product.stock,
        qty: qty
      });
    }

    DB.playScanBeep();
    this.renderCart();
  }

  updateItemQty(productId, delta) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      this.removeItemFromCart(productId);
      return;
    }

    if (newQty > item.maxStock) {
      App.toast('warning', 'Stock Limit', `Only ${item.maxStock} available in store`);
      return;
    }

    item.qty = newQty;
    this.renderCart();
  }

  removeItemFromCart(productId) {
    this.cart = this.cart.filter(i => i.id !== productId);
    this.renderCart();
  }

  clearCart() {
    this.cart = [];
    this.discountValue = 0;
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
      input.value = grandTotal;
    } else {
      const current = parseFloat(input.value) || 0;
      input.value = current + amount;
    }
    this.calculateCashChange(grandTotal);
  }

  calculateCashChange(grandTotal) {
    const input = document.getElementById('pos-cash-tendered');
    const changeEl = document.getElementById('pos-cash-change');
    if (!input || !changeEl) return;
    const tendered = parseFloat(input.value) || 0;
    const change = Math.max(0, tendered - grandTotal);
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
    this.searchQuery = query.toLowerCase().trim();
    this.renderCatalog();
  }

  // Calculate bill finances
  calculateTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalMrp = this.cart.reduce((sum, item) => sum + (item.mrp * item.qty), 0);
    const mrpSavings = Math.max(0, totalMrp - subtotal);

    let discount = 0;
    if (this.discountType === 'percent') {
      discount = Math.round((subtotal * this.discountValue) / 100);
    } else {
      discount = Number(this.discountValue) || 0;
    }
    discount = Math.min(discount, subtotal);

    const discountedSubtotal = subtotal - discount;
    const db = DB.getData();
    const taxRate = db.shop.taxRate || 0;
    const taxAmount = Math.round((discountedSubtotal * taxRate) / 100);
    const grandTotal = discountedSubtotal + taxAmount;

    return {
      subtotal,
      totalMrp,
      mrpSavings,
      discount,
      taxRate,
      taxAmount,
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
        p.name.toLowerCase().includes(this.searchQuery) || 
        (p.barcode && p.barcode.includes(this.searchQuery)) ||
        (p.cat && p.cat.toLowerCase().includes(this.searchQuery))
      );
    }

    if (!products.length) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">${Icons.search(32)}</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">No products match your search</div>
          <p style="font-size: 12px; margin-top: 4px;">Try searching with a different product name or category.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="POS.clearSearch()">Clear Filter</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(p => {
      const isOutOfStock = p.stock <= 0;
      const isLowStock = p.stock > 0 && p.stock <= p.minStock;
      const discount = p.mrp > p.price ? p.mrp - p.price : 0;

      return `
        <div class="pos-prod-card" onclick="POS.addItemToCart(DB.getData().products.find(x => x.id === '${p.id}'))" style="${isOutOfStock ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
          <div class="pos-prod-top">
            <span class="pos-prod-badge">${p.cat || 'General'}</span>
            <span class="pos-prod-sku">${p.barcode ? p.barcode.slice(-5) : p.id}</span>
          </div>

          <div class="pos-prod-title">${p.name}</div>

          <div class="pos-prod-mrp-row">
            <span class="pos-prod-mrp">MRP ₹${p.mrp}</span>
            ${discount > 0 ? `<span class="pos-prod-save">Save ₹${discount}</span>` : ''}
          </div>

          <div class="pos-prod-price-row">
            <div class="pos-prod-price tnum">₹${p.price}</div>
            <div class="pos-prod-stock" style="color: ${isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)'};">
              ${isOutOfStock ? 'Out of stock' : `${p.stock} ${p.unit}`}
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

  // Mobile Bottom Drawer Toggle
  toggleMobileCartDrawer() {
    const panel = document.getElementById('pos-cart-panel');
    if (panel) {
      panel.classList.toggle('open-mobile');
    }
  }

  // Render Cart Register Side Panel
  renderCart() {
    const list = document.getElementById('pos-cart-items-list');
    const summaryArea = document.getElementById('pos-cart-summary-area');
    const countBadge = document.getElementById('pos-cart-count');
    const mobileCartCount = document.getElementById('mobile-cart-count');
    const mobileCartTotal = document.getElementById('mobile-cart-total');

    if (!list || !summaryArea) return;

    const totalQty = this.cart.reduce((s, i) => s + i.qty, 0);
    const calc = this.calculateTotals();

    if (countBadge) countBadge.textContent = totalQty;
    if (mobileCartCount) mobileCartCount.textContent = totalQty;
    if (mobileCartTotal) mobileCartTotal.textContent = `₹${calc.grandTotal.toLocaleString('en-IN')}`;

    if (!this.cart.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 48px 12px; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">${Icons.pos(32)}</div>
          <div style="font-weight: 600; font-size: 13.5px; color: var(--text-secondary);">Cart is empty</div>
          <p style="font-size: 12px; margin-top: 4px;">Click products or scan barcode to add items</p>
        </div>
      `;
      summaryArea.innerHTML = '';
      return;
    }

    list.innerHTML = this.cart.map(item => `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-sub">₹${item.price} × ${item.qty} ${item.unit}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button class="cart-qty-btn" onclick="POS.updateItemQty('${item.id}', -1)">-</button>
          <span class="cart-qty-val">${item.qty}</span>
          <button class="cart-qty-btn" onclick="POS.updateItemQty('${item.id}', 1)">+</button>
        </div>
        <div class="cart-item-total">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
        <button class="cart-item-del" onclick="POS.removeItemFromCart('${item.id}')" title="Remove Item">
          ${Icons.close(14)}
        </button>
      </div>
    `).join('');

    const db = DB.getData();
    const customers = db.customers || [];

    summaryArea.innerHTML = `
      <div class="pos-cart-summary">
        <!-- Customer Selector -->
        <div class="form-group" style="margin-bottom: 8px;">
          <div style="display: flex; gap: 6px;">
            <select id="pos-customer-select" class="form-select" style="font-size: 12.5px; padding: 6px 10px;" onchange="POS.selectedCustomerId = this.value">
              <option value="">Walk-in Customer</option>
              ${customers.map(c => `
                <option value="${c.id}" ${this.selectedCustomerId === c.id ? 'selected' : ''}>
                  ${c.name} (${c.phone}) ${c.balanceDue > 0 ? `• Due: ₹${c.balanceDue}` : ''}
                </option>
              `).join('')}
            </select>
            <button class="btn btn-secondary btn-sm" onclick="Khata.openCustomerModal()" title="Add Customer">
              ${Icons.plus(13)}
            </button>
          </div>
        </div>

        <!-- Financial Breakdown Lines -->
        <div class="summary-line">
          <span>Subtotal (${totalQty} items):</span>
          <span class="tnum">₹${calc.subtotal.toLocaleString('en-IN')}</span>
        </div>

        ${calc.mrpSavings > 0 ? `
          <div class="summary-line" style="color: var(--success);">
            <span>Total MRP Savings:</span>
            <span class="tnum">-₹${calc.mrpSavings.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}

        ${calc.taxAmount > 0 ? `
          <div class="summary-line">
            <span>GST (${calc.taxRate}%):</span>
            <span class="tnum">+₹${calc.taxAmount.toLocaleString('en-IN')}</span>
          </div>
        ` : ''}

        <!-- Quick Bill Discount Buttons -->
        <div style="display: flex; gap: 6px; align-items: center; margin: 4px 0;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Discount:</span>
          <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='percent'; POS.discountValue=5; POS.renderCart();">5%</button>
          <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='percent'; POS.discountValue=10; POS.renderCart();">10%</button>
          <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px;" onclick="POS.discountType='fixed'; POS.discountValue=50; POS.renderCart();">₹50</button>
          ${this.discountValue > 0 ? `
            <button class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 11px; color: var(--danger);" onclick="POS.discountValue=0; POS.renderCart();">✕ Clear</button>
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

        <!-- Payment Mode Selectors -->
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

        <!-- Fast Cash Mode Helpers -->
        ${this.paymentMode === 'Cash' ? `
          <div style="background: var(--bg-input); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 6px;">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Tendered: ₹</span>
              <input type="number" id="pos-cash-tendered" class="form-input" style="height: 32px; padding: 4px 8px; font-weight: 700; font-size: 14px;" value="${calc.grandTotal}" oninput="POS.calculateCashChange(${calc.grandTotal})" />
            </div>

            <!-- Fast Currency Denomination Buttons -->
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

        <!-- UPI Mode Helper -->
        ${this.paymentMode === 'UPI' ? `
          <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); text-align: center; margin-bottom: 6px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--primary); margin-bottom: 8px;">
              Scan with PhonePe • Google Pay • Paytm • BHIM
            </div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(db.shop.upiId || 'mydukaan24@upi')}%26pn%3D${encodeURIComponent(db.shop.name || 'MyDukkan24')}%26am%3D${calc.grandTotal}%26cu%3DINR" alt="UPI QR Code" style="width: 130px; height: 130px; border-radius: 6px; background: #FFF; padding: 4px;" />
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; font-family: var(--font-mono);">
              ${db.shop.upiId || 'mydukaan24@upi'} • ₹${calc.grandTotal}
            </div>
          </div>
        ` : ''}

        <!-- Complete Checkout Action Button -->
        <button class="btn btn-primary w100 btn-lg" style="margin-top: 4px;" onclick="POS.processCheckout()">
          ${Icons.check(16)} Complete Bill (₹${calc.grandTotal.toLocaleString('en-IN')})
        </button>
      </div>
    `;
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
      customer = db.customers.find(c => c.id === this.selectedCustomerId);
    }

    if (this.paymentMode === 'Udhaar' && !customer) {
      App.toast('warning', 'Customer Required', 'Select a customer from the dropdown for Udhaar (Credit) billing');
      return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const invoiceId = `INV-${Date.now().toString().slice(-5)}`;

    const isPaid = this.paymentMode !== 'Udhaar';
    const invoice = {
      id: invoiceId,
      date: dateStr,
      time: timeStr,
      customerId: customer ? customer.id : "WALKIN",
      customerName: customer ? customer.name : "Walk-in Customer",
      customerPhone: customer ? customer.phone : "",
      items: this.cart.map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        mrp: i.mrp,
        price: i.price,
        cost: i.cost,
        unit: i.unit,
        total: i.price * i.qty
      })),
      subtotal: calc.subtotal,
      tax: calc.taxAmount,
      discount: calc.discount,
      total: calc.grandTotal,
      paid: isPaid ? calc.grandTotal : 0,
      due: isPaid ? 0 : calc.grandTotal,
      paymentMode: this.paymentMode,
      status: isPaid ? 'Paid' : 'Due'
    };

    // Deduct stock from database
    this.cart.forEach(cartItem => {
      const prod = db.products.find(p => p.id === cartItem.id);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - cartItem.qty);
      }
    });

    // Update customer loyalty & balance
    if (customer) {
      customer.totalSpent = (customer.totalSpent || 0) + calc.grandTotal;
      if (!isPaid) {
        customer.balanceDue = (customer.balanceDue || 0) + calc.grandTotal;
      }
      customer.points = (customer.points || 0) + Math.floor(calc.grandTotal / 20);
    }

    // Save invoice
    db.invoices.unshift(invoice);
    DB.saveData(db);

    // Audio chime
    DB.playCashChime();

    // Show thermal receipt modal
    this.openReceiptModal(invoice);

    // Reset Cart
    this.cart = [];
    this.selectedCustomerId = "";
    this.renderCart();
    this.renderCatalog();
    App.toast('success', 'Sale Completed!', `Invoice ${invoice.id} recorded`);
  }

  // Thermal Receipt Modal & WhatsApp Share
  openReceiptModal(invoice) {
    const db = DB.getData();
    const shop = db.shop || {};

    const cleanPhone = (invoice.customerPhone || '').replace(/\D/g, '');
    const itemsText = invoice.items.map(it => `• ${it.name} (${it.qty} x ₹${it.price}) = ₹${it.total}`).join('%0A');
    const waText = `*${encodeURIComponent(shop.name || 'MyDukkan24')}* - INVOICE %23${invoice.id}%0A` +
      `Date: ${invoice.date} ${invoice.time}%0A` +
      `Customer: ${encodeURIComponent(invoice.customerName)}%0A%0A` +
      `*Purchased Items:*%0A${itemsText}%0A%0A` +
      `*Total Amount:* ₹${invoice.total}%0A` +
      `*Payment:* ${invoice.paymentMode.toUpperCase()} (${invoice.status.toUpperCase()})%0A%0A` +
      `Pay via UPI: ${encodeURIComponent(shop.upiId || 'mydukaan24@upi')}%0A` +
      `_Thank you for your visit! Billed via MyDukkan24 OS_`;

    const waLink = cleanPhone ? 
      `https://wa.me/91${cleanPhone.slice(-10)}?text=${waText}` : 
      `https://wa.me/?text=${waText}`;

    // Populate the hidden #thermal-printable-area for native window.print()
    const printArea = document.getElementById('thermal-printable-area');
    if (printArea) {
      printArea.innerHTML = `
        <div style="font-family: monospace; font-size: 12px; width: 72mm; margin: 0 auto; line-height: 1.4;">
          <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="font-size: 15px; font-weight: bold;">${shop.name || 'MyDukkan24 Mart'}</div>
            <div style="font-size: 10px;">${shop.address || ''}</div>
            <div style="font-size: 10px;">Phone: ${shop.phone || ''} | GSTIN: ${shop.gstin || ''}</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
            <span>Bill: ${invoice.id}</span>
            <span>${invoice.date} ${invoice.time}</span>
          </div>
          <div style="font-size: 10px; margin-bottom: 6px;">Customer: ${invoice.customerName}</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin-bottom: 6px;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 3px 0;">Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(it => `
                <tr>
                  <td style="padding: 2px 0;">${it.name.slice(0, 16)}</td>
                  <td style="text-align: center;">${it.qty}</td>
                  <td style="text-align: right;">₹${it.price}</td>
                  <td style="text-align: right;">₹${it.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="font-size: 11px;">
            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${invoice.subtotal}</span></div>
            ${invoice.tax > 0 ? `<div style="display: flex; justify-content: space-between;"><span>GST:</span><span>₹${invoice.tax}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px;">
              <span>TOTAL:</span><span>₹${invoice.total}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 3px;">
              <span>Mode:</span><span>${invoice.paymentMode.toUpperCase()}</span>
            </div>
          </div>
          <div style="text-align: center; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 9px;">
            <div>UPI: ${shop.upiId}</div>
            <div>Thank you for shopping with us!</div>
          </div>
        </div>
      `;
    }

    const modalHtml = `
      <div class="modal-backdrop" id="receipt-modal" onclick="if(event.target === this) POS.closeReceiptModal()">
        <div class="modal-card" style="max-width: 420px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.receipt(16)} Invoice Receipt — ${invoice.id}</div>
            <button class="topbar-icon-btn" onclick="POS.closeReceiptModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div class="thermal-receipt-body" style="background: #FFF; color: #000; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 11.5px; border: 1px solid #E2E8F0;">
              <div style="text-align: center; border-bottom: 1px dashed #71717A; padding-bottom: 6px; margin-bottom: 6px;">
                <div class="thermal-shop-name">${shop.name || 'MyDukkan24 Mart'}</div>
                <div style="font-size: 10px; color: #4B5563;">${shop.address || ''}</div>
                <div style="font-size: 10px; color: #4B5563;">Phone: ${shop.phone || ''} | GSTIN: ${shop.gstin || ''}</div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
                <span>Bill: ${invoice.id}</span>
                <span>${invoice.date} ${invoice.time}</span>
              </div>
              <div style="font-size: 10.5px; margin-bottom: 6px;">Customer: ${invoice.customerName}</div>
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
                  ${invoice.items.map(it => `
                    <tr>
                      <td style="padding: 2px 0;">${it.name.slice(0, 18)}</td>
                      <td style="text-align: center;">${it.qty}</td>
                      <td style="text-align: right;">₹${it.price}</td>
                      <td style="text-align: right;">₹${it.total}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div style="font-size: 11px;">
                <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${invoice.subtotal}</span></div>
                ${invoice.tax > 0 ? `<div style="display: flex; justify-content: space-between;"><span>GST:</span><span>₹${invoice.tax}</span></div>` : ''}
                <div class="thermal-total-row">
                  <span>GRAND TOTAL:</span>
                  <span>₹${invoice.total.toLocaleString('en-IN')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  <span>Payment Mode:</span>
                  <strong>${invoice.paymentMode.toUpperCase()} (${invoice.status.toUpperCase()})</strong>
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 14px;">
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="window.print()">
                  ${Icons.print(15)} Print Thermal Slip
                </button>
                <a href="${waLink}" target="_blank" class="btn btn-success" style="flex: 1;">
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

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  closeReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.remove();
  }
}

window.POS = new POSEngine();
