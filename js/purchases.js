/**
 * MyDukkan24 — Wholesale Purchases & Supplier Management
 * Features:
 * 1. Supplier Directory (Vendors, Phone, GSTIN, Balance Due, Items)
 * 2. Inward Purchase Bills (Stock automatically updated in inventory)
 * 3. Supplier Payment Settlements
 * 4. Filter by Supplier / Status / Export CSV
 * Created & Deployed by Mayur Singh
 */

class PurchaseEngine {
  constructor() {
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.inwardCart = [];
  }

  render(container) {
    const db = DB.getData();
    const purchases = db.purchases || [];
    const suppliers = db.suppliers || [];

    const totalPurchased = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalSupplierDues = suppliers.reduce((s, sup) => s + (sup.balanceDue || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthPurchases = purchases
      .filter(p => (p.date || '').startsWith(thisMonth))
      .reduce((s, p) => s + (p.totalAmount || 0), 0);

    const filteredPurchases = purchases.filter(p => {
      const matchFilter = this.activeFilter === 'all' || p.status.toLowerCase() === this.activeFilter.toLowerCase();
      const matchSearch = !this.searchQuery || 
        (p.supplierName && p.supplierName.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (p.billNo && p.billNo.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchFilter && matchSearch;
    });

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>${I18n.t('pur_title', 'Wholesale Purchases & Supplier Ledger')}</h1>
          <p>${I18n.t('pur_subtitle', 'Record vendor deliveries, inward bills, and manage distributor payables')}</p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="Purchases.openSupplierModal()">
            ${Icons.users(14)} ${I18n.t('pur_btn_new_supplier', 'Add Supplier')}
          </button>
          <button class="btn btn-primary" onclick="Purchases.openInwardBillModal()">
            ${Icons.plus(14)} ${I18n.t('pur_btn_inward_bill', 'Record Inward Bill')}
          </button>
        </div>
      </div>

      <!-- Financial Metrics -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Purchases Recorded</span>
            <div class="kpi-icon-badge" style="background: rgba(37,99,235,0.15); color: #60A5FA;">
              ${Icons.package(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${totalPurchased.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${purchases.length} Inward Deliveries</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">This Month Stock Inward</span>
            <div class="kpi-icon-badge" style="background: rgba(16,185,129,0.15); color: #10B981;">
              ${Icons.chart(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: #10B981;">₹${monthPurchases.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Pending Supplier Payables</span>
            <div class="kpi-icon-badge" style="background: rgba(244,63,94,0.15); color: #F43F5E;">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: #F43F5E;">₹${totalSupplierDues.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--danger); font-weight: 600;">${suppliers.filter(s => (s.balanceDue || 0) > 0).length} Suppliers Outstanding</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Registered Suppliers</span>
            <div class="kpi-icon-badge" style="background: rgba(139,92,246,0.15); color: #A78BFA;">
              ${Icons.users(16)}
            </div>
          </div>
          <div class="kpi-val">${suppliers.length} Vendors</div>
          <div class="kpi-trend" style="color: var(--text-muted);">FMCG, Dairy, Wholesale Hubs</div>
        </div>
      </div>

      <!-- Responsive 2-Column Split: Inward Bills & Suppliers Directory -->
      <div class="responsive-split-grid" style="margin-bottom: 24px;">
        <!-- Left: Inward Purchase Bills -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header" style="flex-wrap: wrap; gap: 8px;">
            <div class="card-title">${Icons.receipt(16)} Wholesale Inward Bills</div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <input type="text" class="form-input" style="padding: 4px 10px; font-size: 12px; width: 150px;" placeholder="Search bills..." value="${this.searchQuery}" oninput="Purchases.searchQuery = this.value; Purchases.render(document.getElementById('main-view-container'));" />
              <button class="btn btn-secondary btn-sm" onclick="Purchases.exportPurchasesCSV()">
                ${Icons.download(13)} CSV
              </button>
            </div>
          </div>

          ${filteredPurchases.length ? `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredPurchases.map(p => `
                    <tr>
                      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); font-size: 12px;">${p.billNo || p.id}</td>
                      <td>${p.date}</td>
                      <td style="font-weight: 600;">${p.supplierName}</td>
                      <td style="font-size: 12px; color: var(--text-muted);">${(p.items || []).length} SKUs</td>
                      <td style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${(p.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td>
                        <span class="badge ${p.status === 'Paid' ? 'badge-success' : 'badge-danger'}">
                          ${p.status}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="Purchases.viewPurchaseDetails('${p.id}')" title="View Inward Breakdown">
                          ${Icons.info(13)} View
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
              <div style="margin-bottom: 8px;">${Icons.package(32)}</div>
              <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No inward purchase bills recorded yet</div>
              <p style="font-size: 12.5px; margin-top: 4px;">Record stock received from distributors to auto-update inventory.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="Purchases.openInwardBillModal()">
                + Record First Bill
              </button>
            </div>
          `}
        </div>

        <!-- Right: Supplier Directory with Dues & Quick Pay -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.users(16)} Supplier Master Directory</div>
            <button class="btn btn-secondary btn-sm" onclick="Purchases.openSupplierModal()">
              ${Icons.plus(13)} Add
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${suppliers.map(sup => `
              <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${sup.name}</div>
                    <div style="font-size: 11.5px; color: var(--text-muted);">📞 ${sup.phone} • 📍 ${sup.city || 'Local'}</div>
                  </div>
                  <span class="badge ${(sup.balanceDue || 0) > 0 ? 'badge-danger' : 'badge-success'}">
                    ${(sup.balanceDue || 0) > 0 ? `Due: ₹${sup.balanceDue.toLocaleString('en-IN')}` : 'Cleared'}
                  </span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                  Supplies: <span style="color: var(--text-muted);">${sup.itemsSupplied || 'FMCG goods'}</span>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end;">
                  ${(sup.balanceDue || 0) > 0 ? `
                    <button class="btn btn-primary btn-sm" style="padding: 3px 8px; font-size: 11px; background: #10B981;" onclick="Purchases.openPaySupplierModal('${sup.id}')">
                      ✓ Pay Balance
                    </button>
                  ` : ''}
                  <a href="tel:${sup.phone}" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;">
                    Call
                  </a>
                  <button class="btn btn-secondary btn-sm" style="padding: 3px 6px; font-size: 11px;" onclick="Purchases.deleteSupplier('${sup.id}')">
                    ${Icons.trash(12)}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Record Inward Supplier Bill Modal
  openInwardBillModal() {
    const db = DB.getData();
    const suppliers = db.suppliers || [];
    const products = db.products || [];
    this.inwardCart = [];

    const modalHtml = `
      <div class="modal-backdrop" id="inward-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 680px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.plus(16)} Record Inward Purchase Bill</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <form onsubmit="event.preventDefault(); Purchases.saveInwardBill();" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Select Supplier *</label>
                <select id="inward-supplier" class="form-select" required>
                  ${suppliers.map(s => `<option value="${s.id}">${s.name} (${s.city || 'Wholesale'})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Vendor Invoice / Bill No *</label>
                <input type="text" id="inward-billno" class="form-input" placeholder="e.g. INV-9921" required />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Delivery Date *</label>
                <input type="date" id="inward-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode *</label>
                <select id="inward-paymode" class="form-select">
                  <option value="Cash">Cash Paid</option>
                  <option value="UPI">UPI / Bank Transfer</option>
                  <option value="Credit">Credit (Add to Supplier Due)</option>
                </select>
              </div>
            </div>

            <!-- Inward Items Selector -->
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-weight: 700; font-size: 12.5px; color: var(--text-primary); margin-bottom: 8px;">
                📦 Add Received Items to Delivery:
              </div>
              <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; align-items: flex-end;">
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Product Catalog</label>
                  <select id="inward-item-prod" class="form-select" style="font-size: 12px;" onchange="Purchases.onProductSelectChange(this.value)">
                    <option value="">-- Choose Product --</option>
                    ${products.map(p => `<option value="${p.id}" data-cost="${p.cost}">${p.name} (Stock: ${p.stock})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Wholesale Cost (₹)</label>
                  <input type="number" id="inward-item-cost" class="form-input" style="font-size: 12px;" placeholder="Cost" min="1" />
                </div>
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Quantity (Units)</label>
                  <input type="number" id="inward-item-qty" class="form-input" style="font-size: 12px;" placeholder="Qty" min="1" value="10" />
                </div>
                <button type="button" class="btn btn-primary btn-sm" onclick="Purchases.addItemToInwardCart()">
                  + Add
                </button>
              </div>

              <!-- Cart preview list -->
              <div id="inward-cart-preview" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
              <div style="font-size: 14px; font-weight: 800; color: var(--text-primary);">
                Total Bill Amount: <span id="inward-grand-total" style="color: var(--primary);">₹0</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="Purchases.closeModals()">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">
                  ${Icons.check(14)} Confirm & Add to Inventory Stock
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  onProductSelectChange(prodId) {
    const db = DB.getData();
    const prod = (db.products || []).find(p => p.id === prodId);
    if (prod) {
      const costIn = document.getElementById('inward-item-cost');
      if (costIn) costIn.value = prod.cost || Math.round(prod.price * 0.85);
    }
  }

  addItemToInwardCart() {
    const sel = document.getElementById('inward-item-prod');
    const costIn = document.getElementById('inward-item-cost');
    const qtyIn = document.getElementById('inward-item-qty');

    if (!sel || !sel.value) {
      App.toast('danger', 'Select Product', 'Please choose a product from the list');
      return;
    }

    const prodId = sel.value;
    const cost = parseFloat(costIn.value) || 0;
    const qty = parseInt(qtyIn.value, 10) || 0;

    if (cost <= 0 || qty <= 0) {
      App.toast('danger', 'Invalid Input', 'Wholesale cost and quantity must be greater than zero');
      return;
    }

    const db = DB.getData();
    const prod = db.products.find(p => p.id === prodId);
    const prodName = prod ? prod.name : 'Item';

    this.inwardCart.push({
      id: prodId,
      name: prodName,
      cost: cost,
      qty: qty,
      total: cost * qty
    });

    this.renderInwardCartPreview();
  }

  renderInwardCartPreview() {
    const container = document.getElementById('inward-cart-preview');
    const totalEl = document.getElementById('inward-grand-total');
    if (!container) return;

    if (!this.inwardCart.length) {
      container.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 6px;">No items added to bill yet.</div>`;
      if (totalEl) totalEl.textContent = '₹0';
      return;
    }

    const grand = this.inwardCart.reduce((s, i) => s + i.total, 0);
    if (totalEl) totalEl.textContent = `₹${grand.toLocaleString('en-IN')}`;

    container.innerHTML = this.inwardCart.map((item, idx) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px;">
        <span style="font-weight: 600;">${item.name}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span>${item.qty} units × ₹${item.cost} = <strong>₹${item.total.toLocaleString('en-IN')}</strong></span>
          <button type="button" onclick="Purchases.removeInwardCartItem(${idx})" style="color: var(--danger); font-size: 14px; cursor: pointer;">✕</button>
        </div>
      </div>
    `).join('');
  }

  removeInwardCartItem(idx) {
    this.inwardCart.splice(idx, 1);
    this.renderInwardCartPreview();
  }

  saveInwardBill() {
    if (!this.inwardCart.length) {
      App.toast('danger', 'Empty Delivery', 'Add at least one item to the inward bill');
      return;
    }

    const supId = document.getElementById('inward-supplier').value;
    const billNo = (document.getElementById('inward-billno').value || '').trim();
    const date = document.getElementById('inward-date').value || new Date().toISOString().split('T')[0];
    const payMode = document.getElementById('inward-paymode').value || 'Cash';

    const db = DB.getData();
    const sup = (db.suppliers || []).find(s => s.id === supId);
    const supName = sup ? sup.name : 'Wholesale Distributor';

    const grandTotal = this.inwardCart.reduce((s, i) => s + i.total, 0);
    const isCredit = payMode === 'Credit';

    const newPurchase = {
      id: `PUR-${Date.now().toString().slice(-5)}`,
      billNo: billNo,
      date: date,
      supplierId: supId,
      supplierName: supName,
      items: [...this.inwardCart],
      totalAmount: grandTotal,
      paidAmount: isCredit ? 0 : grandTotal,
      dueAmount: isCredit ? grandTotal : 0,
      status: isCredit ? 'Due' : 'Paid',
      paymentMode: payMode
    };

    // Update stock in products catalog
    this.inwardCart.forEach(inItem => {
      const prod = db.products.find(p => p.id === inItem.id);
      if (prod) {
        prod.stock = (prod.stock || 0) + inItem.qty;
        prod.cost = inItem.cost; // Update wholesale cost
      }
    });

    // If Credit, update supplier balance
    if (isCredit && sup) {
      sup.balanceDue = (sup.balanceDue || 0) + grandTotal;
    }

    if (!db.purchases) db.purchases = [];
    db.purchases.unshift(newPurchase);

    DB.saveData(db);
    App.toast('success', 'Stock Inward Saved', `Added ${this.inwardCart.length} products to inventory stock (₹${grandTotal.toLocaleString('en-IN')})`);

    this.closeModals();
    this.render(document.getElementById('main-view-container'));
    App.updateNotificationBadge();
  }

  // Add Supplier Modal
  openSupplierModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="supplier-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.users(16)} Add Wholesale Supplier</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <form onsubmit="event.preventDefault(); Purchases.saveSupplier();" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Vendor / Company Name *</label>
              <input type="text" id="sup-name" class="form-input" placeholder="e.g. Metro Cash & Carry" required />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" id="sup-contact" class="form-input" placeholder="Sales Executive" />
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="text" id="sup-phone" class="form-input" placeholder="+91 98765 00000" required />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">City / Hub</label>
                <input type="text" id="sup-city" class="form-input" placeholder="Lucknow" />
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN Tax Number</label>
                <input type="text" id="sup-gstin" class="form-input" placeholder="09AAAAA0000A1Z5" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Items Supplied</label>
              <input type="text" id="sup-items" class="form-input" placeholder="e.g. Atta, Oil, FMCG Soaps" />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 8px;">
              ${Icons.check(14)} Save Supplier
            </button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveSupplier() {
    const name = (document.getElementById('sup-name').value || '').trim();
    const contact = (document.getElementById('sup-contact').value || '').trim();
    const phone = (document.getElementById('sup-phone').value || '').trim();
    const city = (document.getElementById('sup-city').value || '').trim();
    const gstin = (document.getElementById('sup-gstin').value || '').trim();
    const items = (document.getElementById('sup-items').value || '').trim();

    if (!name || !phone) return;

    const db = DB.getData();
    if (!db.suppliers) db.suppliers = [];

    const newSup = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: name,
      contactPerson: contact,
      phone: phone,
      city: city || 'Local',
      gstin: gstin,
      itemsSupplied: items || 'Retail FMCG Goods',
      balanceDue: 0
    };

    db.suppliers.push(newSup);
    DB.saveData(db);
    App.toast('success', 'Supplier Added', `Registered ${name}`);

    this.closeModals();
    this.render(document.getElementById('main-view-container'));
  }

  deleteSupplier(id) {
    if (!confirm('Are you sure you want to remove this supplier from directory?')) return;
    const db = DB.getData();
    db.suppliers = (db.suppliers || []).filter(s => s.id !== id);
    DB.saveData(db);
    App.toast('success', 'Supplier Deleted', 'Vendor removed from directory');
    this.render(document.getElementById('main-view-container'));
  }

  // Pay Supplier Balance
  openPaySupplierModal(supId) {
    const db = DB.getData();
    const sup = (db.suppliers || []).find(s => s.id === supId);
    if (!sup) return;

    const amtStr = prompt(`Enter payment amount to settle with ${sup.name} (Current Outstanding: ₹${sup.balanceDue}):`, sup.balanceDue);
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (isNaN(amt) || amt <= 0) return;

    sup.balanceDue = Math.max(0, (sup.balanceDue || 0) - amt);
    
    // Also record an expense for this payment
    if (!db.expenses) db.expenses = [];
    db.expenses.unshift({
      id: `E-${Date.now().toString().slice(-4)}`,
      desc: `Supplier Payment: ${sup.name}`,
      cat: 'Wholesale Purchase',
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      status: 'Paid'
    });

    DB.saveData(db);
    App.toast('success', 'Payment Settled', `Paid ₹${amt} to ${sup.name}`);
    this.render(document.getElementById('main-view-container'));
  }

  viewPurchaseDetails(purchaseId) {
    const db = DB.getData();
    const p = (db.purchases || []).find(x => x.id === purchaseId);
    if (!p) return;

    const modalHtml = `
      <div class="modal-backdrop" id="view-pur-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.receipt(16)} Inward Delivery: ${p.billNo || p.id}</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12.5px;">
              <div>
                <strong>Supplier:</strong> ${p.supplierName}<br>
                <strong>Date:</strong> ${p.date}
              </div>
              <div style="text-align: right;">
                <span class="badge ${p.status === 'Paid' ? 'badge-success' : 'badge-danger'}">${p.status}</span><br>
                <span style="font-size: 11px; color: var(--text-muted);">${p.paymentMode}</span>
              </div>
            </div>

            <table class="data-table" style="font-size: 12px; margin-bottom: 14px;">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Wholesale Cost</th>
                  <th>Quantity</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(p.items || []).map(i => `
                  <tr>
                    <td>${i.name}</td>
                    <td>₹${i.cost}</td>
                    <td>${i.qty}</td>
                    <td style="font-weight: 700;">₹${i.total}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
              <span>Total Invoice Amount:</span>
              <span style="color: var(--primary);">₹${(p.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>

            <button class="btn btn-secondary" style="width: 100%; justify-content: center; margin-top: 14px;" onclick="Purchases.closeModals()">
              Done
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  exportPurchasesCSV() {
    const db = DB.getData();
    const purchases = db.purchases || [];
    if (!purchases.length) {
      App.toast('danger', 'No Records', 'No inward purchases to export');
      return;
    }

    let csv = "ID,BillNo,Date,Supplier,TotalAmount,PaidAmount,DueAmount,Status,PaymentMode\n";
    purchases.forEach(p => {
      csv += `"${p.id}","${p.billNo}","${p.date}","${p.supplierName}",${p.totalAmount},${p.paidAmount},${p.dueAmount},"${p.status}","${p.paymentMode}"\n`;
    });

    DB.downloadFile(csv, `wholesale_purchases_${new Date().toISOString().split('T')[0]}.csv`);
    App.toast('success', 'Exported', 'Purchases CSV downloaded');
  }

  closeModals() {
    ['inward-modal', 'supplier-modal', 'view-pur-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}

window.Purchases = new PurchaseEngine();
