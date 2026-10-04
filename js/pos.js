/**
 * MyDukaan Pro — POS Billing Terminal & Instant Cart Engine
 * Created & Deployed by Mayur Singh
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
    if (product.stock <= 0) {
      App.toast('danger', 'Out of Stock', `${product.name} has 0 stock`);
      return;
    }

    const existing = this.cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty + qty > product.stock) {
        App.toast('warning', 'Stock Limit Reached', `Only ${product.stock} ${product.unit} available`);
        return;
      }
      existing.qty += qty;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        emoji: product.emoji || '📦',
        barcode: product.barcode,
        mrp: product.mrp,
        price: product.price,
        cost: product.cost,
        unit: product.unit,
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
      App.toast('warning', 'Max Stock', `Only ${item.maxStock} available`);
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
    document.querySelectorAll('.pm-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
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
    let products = db.products;

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
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 15px; font-weight: 600;">No products match your search</div>
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
        <div class="pos-prod-card" onclick="POS.addItemToCart(DB.getData().products.find(x => x.id === '${p.id}'))" style="${isOutOfStock ? 'opacity: 0.55; cursor: not-allowed;' : ''}">
          <div class="pos-prod-top">
            <div class="pos-prod-emoji">${p.emoji || '📦'}</div>
            <div class="pos-prod-barcode-badge">${p.barcode ? p.barcode.slice(-5) : p.id}</div>
          </div>
          <div class="pos-prod-title">${p.name}</div>
          <div class="pos-prod-mrp">MRP ₹${p.mrp}</div>
          <div class="pos-prod-price-row">
            <div class="pos-prod-price">₹${p.price}</div>
            <div class="pos-prod-stock" style="color: ${isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)'};">
              ${isOutOfStock ? '0 Stock' : `${p.stock} ${p.unit}`}
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

  // Render Cart Side Panel
  renderCart() {
    const list = document.getElementById('pos-cart-items-list');
    const summaryArea = document.getElementById('pos-cart-summary-area');
    const badge = document.getElementById('pos-cart-count');
    if (!list || !summaryArea) return;

    if (badge) badge.textContent = this.cart.reduce((s, i) => s + i.qty, 0);

    if (!this.cart.length) {
      list.innerHTML = `
        <div style="text-align: center; padding: 48px 12px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
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
          <div class="cart-item-name">${item.emoji} ${item.name}</div>
          <div class="cart-item-sub">₹${item.price} × ${item.qty} ${item.unit}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button class="cart-qty-btn" onclick="POS.updateItemQty('${item.id}', -1)">-</button>
          <span class="cart-qty-val">${item.qty}</span>
          <button class="cart-qty-btn" onclick="POS.updateItemQty('${item.id}', 1)">+</button>
        </div>
        <div class="cart-item-total">₹${item.price * item.qty}</div>
        <button class="cart-item-del" onclick="POS.removeItemFromCart('${item.id}')" title="Remove">✕</button>
      </div>
    `).join('');

    const calc = this.calculateTotals();
    const db = DB.getData();

    summaryArea.innerHTML = `
      <div class="pos-cart-summary">
        <!-- Customer Selector -->
        <div class="form-group" style="margin-bottom: 8px;">
          <select id="pos-customer-select" class="form-select" style="font-size: 12.5px; padding: 6px 10px;" onchange="POS.selectedCustomerId = this.value">
            <option value="">Walk-in Customer (Cash/UPI)</option>
            ${db.customers.map(c => `
              <option value="${c.id}" ${this.selectedCustomerId === c.id ? 'selected' : ''}>
                ${c.name} (${c.phone}) ${c.balanceDue > 0 ? `• Due: ₹${c.balanceDue}` : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="summary-line">
          <span>Subtotal (${this.cart.reduce((s, i) => s + i.qty, 0)} items)</span>
          <span>₹${calc.subtotal}</span>
        </div>

        ${calc.mrpSavings > 0 ? `
          <div class="summary-line" style="color: var(--success); font-weight: 600;">
            <span>MRP Discount Savings</span>
            <span>-₹${calc.mrpSavings}</span>
          </div>
        ` : ''}

        ${calc.taxAmount > 0 ? `
          <div class="summary-line">
            <span>GST (${calc.taxRate}%)</span>
            <span>+₹${calc.taxAmount}</span>
          </div>
        ` : ''}

        <div class="summary-line total">
          <span>Total Payable</span>
          <span style="color: var(--primary);">₹${calc.grandTotal}</span>
        </div>

        <!-- Payment Modes -->
        <div class="payment-modes-grid">
          ${['Cash', 'UPI', 'Card', 'Udhaar'].map(mode => `
            <button class="pm-btn ${this.paymentMode === mode ? 'active' : ''}" data-mode="${mode}" onclick="POS.setPaymentMode('${mode}')">
              ${mode === 'Cash' ? '💵' : mode === 'UPI' ? '📱' : mode === 'Card' ? '💳' : '📒'} ${mode}
            </button>
          `).join('')}
        </div>

        <!-- Checkout Trigger -->
        <button class="btn btn-primary w100" style="padding: 12px; font-size: 15px; margin-top: 4px;" onclick="POS.processCheckout()">
          ⚡ Complete Bill (₹${calc.grandTotal})
        </button>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="POS.clearCart()">Clear Cart</button>
          <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.openScannerModal()">📷 Scan More</button>
        </div>
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
      customer.totalSpent += calc.grandTotal;
      if (!isPaid) {
        customer.balanceDue += calc.grandTotal;
      }
      customer.points += Math.floor(calc.grandTotal / 20);
    }

    // Save invoice
    db.invoices.unshift(invoice);
    DB.saveData(db);

    // Audio confirmation
    DB.playCashChime();

    // Show receipt view modal
    this.openReceiptModal(invoice);

    // Reset Cart
    this.cart = [];
    this.selectedCustomerId = "";
    this.renderCart();
    this.renderCatalog();
    App.toast('success', 'Sale Completed! 🎉', `Bill ${invoice.id} recorded successfully`);
  }

  // Invoice Receipt Modal with Thermal Print & WhatsApp Share
  openReceiptModal(invoice) {
    const db = DB.getData();
    const shop = db.shop;

    // Build WhatsApp invoice text
    const itemsText = invoice.items.map(it => `• ${it.name} (${it.qty} x ₹${it.price}) = ₹${it.total}`).join('%0A');
    const waText = `*${encodeURIComponent(shop.name)}* - INVOICE %23${invoice.id}%0A` +
      `Date: ${invoice.date} ${invoice.time}%0A` +
      `Customer: ${encodeURIComponent(invoice.customerName)}%0A%0A` +
      `*Items:*%0A${itemsText}%0A%0A` +
      `*Total Amount:* ₹${invoice.total}%0A` +
      `*Status:* ${invoice.status.toUpperCase()} (${invoice.paymentMode})%0A%0A` +
      `Pay via UPI: ${encodeURIComponent(shop.upiId)}%0A` +
      `_Thank you for shopping with us! Billed via MyDukaan Pro • Dev: Mayur Singh_`;

    const waLink = invoice.customerPhone ? 
      `https://wa.me/91${invoice.customerPhone}?text=${waText}` : 
      `https://wa.me/?text=${waText}`;

    const modalHtml = `
      <div class="modal-backdrop" id="receipt-modal" onclick="if(event.target === this) POS.closeReceiptModal()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 16px;">🧾 Bill Receipt — ${invoice.id}</div>
            <button class="topbar-icon-btn" onclick="POS.closeReceiptModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <!-- Thermal Receipt Preview -->
            <div id="printable-receipt-area" style="background: #fff; color: #000; padding: 18px; border-radius: 8px; font-family: monospace; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
              <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
                <div style="font-size: 16px; font-weight: bold;">${shop.name}</div>
                <div style="font-size: 10px;">${shop.address}</div>
                <div style="font-size: 10px;">Phone: ${shop.phone} | GSTIN: ${shop.gstin}</div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                <span>Bill: ${invoice.id}</span>
                <span>${invoice.date} ${invoice.time}</span>
              </div>
              <div style="font-size: 11px; margin-bottom: 8px;">Cust: ${invoice.customerName} ${invoice.customerPhone ? `(${invoice.customerPhone})` : ''}</div>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
                <thead>
                  <tr style="border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
                    <th style="text-align: left; padding: 4px 0;">Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoice.items.map(it => `
                    <tr>
                      <td style="padding: 3px 0;">${it.name.slice(0, 18)}</td>
                      <td style="text-align: center;">${it.qty}</td>
                      <td style="text-align: right;">₹${it.price}</td>
                      <td style="text-align: right;">₹${it.total}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${invoice.subtotal}</span></div>
                ${invoice.tax > 0 ? `<div style="display: flex; justify-content: space-between;"><span>GST:</span><span>₹${invoice.tax}</span></div>` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
                  <span>TOTAL:</span><span>₹${invoice.total}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                  <span>Mode:</span><span style="font-weight: bold;">${invoice.paymentMode.toUpperCase()} (${invoice.status.toUpperCase()})</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 14px; border-top: 1px dashed #000; padding-top: 8px; font-size: 10px;">
                <div>UPI ID: ${shop.upiId}</div>
                <div>Thank you for visiting us! 🙏</div>
                <div style="color: #666; font-size: 8px; margin-top: 4px;">Powered by MyDukaan Pro • Built by Mayur Singh</div>
              </div>
            </div>

            <!-- Receipt Actions -->
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="window.print()">
                  🖨️ Print Thermal Receipt
                </button>
                <a href="${waLink}" target="_blank" class="btn btn-success" style="flex: 1;">
                  📱 WhatsApp Bill
                </a>
              </div>
              <button class="btn btn-secondary w100" onclick="POS.closeReceiptModal()">
                Close & Next Bill
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
