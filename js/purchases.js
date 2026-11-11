/**
 * MyDukkan24 — Wholesale Purchases, Supplier Khata & AI Bill Photo Scanner
 * Features:
 * 1. Supplier Directory, FIFO Payable Settlement & Live-Search (focus-safe)
 * 2. Inward Purchase Bills with decimal qty, expiry date, GST & inline new SKUs
 * 3. Gemini Vision AI Wholesaler Bill Photo Scanner with editable SKU review
 */

class PurchaseEngine {
  constructor() {
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.inwardCart = [];
    this._scannedBillDraft = null;
  }

  render(container) {
    if (!container) return;
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('access wholesale purchases & supplier ledger');
      return;
    }

    const db = DB.getData();
    const purchases = db.purchases || [];
    const suppliers = db.suppliers || [];

    const totalPurchased = DB.round2(purchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0));
    const totalSupplierDues = DB.round2(suppliers.reduce((s, sup) => s + (Number(sup.balanceDue) || 0), 0));
    const thisMonth = DB.getLocalDateStr().slice(0, 7);
    const monthPurchases = DB.round2(
      purchases
        .filter(p => (p.date || '').startsWith(thisMonth))
        .reduce((s, p) => s + (Number(p.totalAmount) || 0), 0)
    );

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>${I18n.t('pur_title', 'Wholesale Purchases & Supplier Ledger')}</h1>
          <p>${I18n.t('pur_subtitle', 'Record vendor deliveries, scan paper bills with AI Vision, and settle distributor payables')}</p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="Purchases.printPurchasesReport()">
            ${Icons.print(14)} Print Register
          </button>
          <button class="btn btn-secondary" onclick="Purchases.openAiBillScannerModal()">
            ${Icons.camera(14)} Scan Bill Photo (AI)
          </button>
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
          <div class="kpi-trend" style="color: var(--danger); font-weight: 600;">${suppliers.filter(s => (Number(s.balanceDue) || 0) > 0).length} Suppliers Outstanding</div>
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
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; max-width: 100%;">
              <input type="text" id="purchases-search-input" class="form-input" style="padding: 4px 10px; font-size: 12px; flex: 1 1 130px; min-width: 0; width: 100%; max-width: 180px;" placeholder="Search supplier or bill..." value="${DB.escapeHtml(this.searchQuery)}" oninput="Purchases.setSearch(this.value);" />
              <select class="form-select" style="width: auto; font-size: 11.5px; padding: 4px 8px;" onchange="Purchases.setFilter(this.value)">
                <option value="all" ${this.activeFilter === 'all' ? 'selected' : ''}>All</option>
                <option value="Paid" ${this.activeFilter === 'Paid' ? 'selected' : ''}>Paid</option>
                <option value="Due" ${this.activeFilter === 'Due' ? 'selected' : ''}>Due / Partial</option>
              </select>
              <button class="btn btn-secondary btn-sm" onclick="Purchases.exportPurchasesCSV()">
                ${Icons.download(13)} CSV
              </button>
            </div>
          </div>

          <div id="purchases-bills-table-wrap"></div>
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
            ${suppliers.length ? suppliers.map(sup => {
              const dueAmt = DB.round2(sup.balanceDue || 0);
              return `
                <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); word-break: break-word;">${DB.escapeHtml(sup.name)}</div>
                      <div style="font-size: 11.5px; color: var(--text-muted);">📞 ${DB.escapeHtml(sup.phone || '')} • 📍 ${DB.escapeHtml(sup.city || 'Local')}</div>
                    </div>
                    <span class="badge ${dueAmt > 0 ? 'badge-danger' : 'badge-success'}">
                      ${dueAmt > 0 ? `Due: ₹${dueAmt.toLocaleString('en-IN')}` : 'Cleared'}
                    </span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary);">
                    Supplies: <span style="color: var(--text-muted);">${DB.escapeHtml(sup.itemsSupplied || 'FMCG goods')}</span>
                  </div>
                  <div style="display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end; flex-wrap: wrap;">
                    ${dueAmt > 0 ? `
                      <button class="btn btn-success btn-sm" style="padding: 3px 10px; font-size: 11px;" onclick="Purchases.openPaySupplierModal('${DB.escapeHtml(sup.id)}')">
                        ✓ Pay Balance
                      </button>
                    ` : ''}
                    ${sup.phone ? `<a href="tel:${DB.escapeHtml(sup.phone)}" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;">Call</a>` : ''}
                    <button class="btn btn-secondary btn-sm" style="padding: 3px 6px; font-size: 11px;" onclick="Purchases.deleteSupplier('${DB.escapeHtml(sup.id)}')" title="Remove Supplier">
                      ${Icons.trash(12)}
                    </button>
                  </div>
                </div>
              `;
            }).join('') : `
              <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
                No suppliers registered yet. Click "Add" to add your wholesaler.
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    this.renderPurchasesTable();
  }

  setSearch(val) {
    this.searchQuery = String(val || '');
    this.renderPurchasesTable();
  }

  setFilter(status) {
    this.activeFilter = status || 'all';
    this.renderPurchasesTable();
  }

  renderPurchasesTable() {
    const wrap = document.getElementById('purchases-bills-table-wrap');
    if (!wrap) return;

    const db = DB.getData();
    const purchases = db.purchases || [];
    const q = this.searchQuery.toLowerCase().trim();

    const filteredPurchases = purchases.filter(p => {
      const st = String(p.status || '').toLowerCase();
      const matchFilter = this.activeFilter === 'all' ||
        (this.activeFilter === 'Due' ? (st === 'due' || st === 'partial') : st === this.activeFilter.toLowerCase());
      const matchSearch = !q ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.billNo && p.billNo.toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });

    if (!filteredPurchases.length) {
      wrap.innerHTML = `
        <div style="padding: 40px 16px; text-align: center; color: var(--text-muted);">
          <div style="margin-bottom: 8px;">${Icons.package(32)}</div>
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No matching inward purchase bills</div>
          <p style="font-size: 12.5px; margin-top: 4px;">Record stock received from distributors or scan a bill photo to auto-update inventory.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="Purchases.openInwardBillModal()">
            + Record Inward Bill
          </button>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bill No</th>
              <th>Date</th>
              <th>Supplier</th>
              <th>SKUs</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPurchases.map(p => `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); font-size: 12px;">${DB.escapeHtml(p.billNo || p.id)}</td>
                <td>${DB.escapeHtml(p.date || '')}</td>
                <td style="font-weight: 600;">${DB.escapeHtml(p.supplierName || 'Distributor')}</td>
                <td style="font-size: 12px; color: var(--text-muted);">${(p.items || []).length} SKUs</td>
                <td>
                  <div style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${DB.round2(p.totalAmount || 0).toLocaleString('en-IN')}</div>
                  ${(p.dueAmount || 0) > 0 ? `<div style="font-size: 10.5px; color: var(--danger);">Due: ₹${DB.round2(p.dueAmount).toLocaleString('en-IN')}</div>` : ''}
                </td>
                <td>
                  <span class="badge ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-warning' : 'badge-danger'}">
                    ${DB.escapeHtml(p.status || 'Paid')}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="Purchases.viewPurchaseDetails('${DB.escapeHtml(p.id)}')" title="View Inward Breakdown">
                    ${Icons.info(13)} View
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Record Inward Supplier Bill Modal (accepts prefill items from Restock Predictor)
  openInwardBillModal(prefillItems = null) {
    const db = DB.getData();
    const suppliers = db.suppliers || [];
    const products = db.products || [];
    this.inwardCart = Array.isArray(prefillItems) ? prefillItems.map(x => ({ ...x })) : [];

    this.closeModals();

    const modalHtml = `
      <div class="modal-backdrop" id="inward-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 720px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.plus(16)} Record Inward Purchase Bill</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <form class="modal-body" onsubmit="event.preventDefault(); Purchases.saveInwardBill();" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div class="form-row-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Select Supplier *</label>
                <select id="inward-supplier" class="form-select" required>
                  ${suppliers.length
                    ? suppliers.map(s => `<option value="${DB.escapeHtml(s.id)}">${DB.escapeHtml(s.name)} (${DB.escapeHtml(s.city || 'Wholesale')})</option>`).join('')
                    : `<option value="">-- Add a supplier first --</option>`
                  }
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Vendor Invoice / Bill No *</label>
                <input type="text" id="inward-billno" class="form-input" placeholder="e.g. INV-9921" required />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Delivery Date *</label>
                <input type="date" id="inward-date" class="form-input" value="${DB.getLocalDateStr()}" required />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Payment Mode *</label>
                <select id="inward-paymode" class="form-select">
                  <option value="Cash">Cash Paid</option>
                  <option value="UPI">UPI / Bank Transfer</option>
                  <option value="Credit">Credit (Add to Supplier Khata Due)</option>
                </select>
              </div>
            </div>

            <!-- Inward Items Selector -->
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <span style="font-weight: 700; font-size: 12.5px; color: var(--text-primary);">📦 Add Received Items (Stock auto-updates):</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 135px), 1fr)); gap: 8px; align-items: end;">
                <div style="grid-column: span 2 / auto;">
                  <label class="form-label" style="font-size: 10.5px;">Product Catalog / Brand-New SKU</label>
                  <select id="inward-item-prod" class="form-select" style="font-size: 12px;" onchange="Purchases.onProductSelectChange(this.value)">
                    <option value="">-- Choose Existing Product --</option>
                    <option value="__NEW__">➕ Create Brand-New Product SKU</option>
                    ${products.map(p => `<option value="${DB.escapeHtml(p.id)}">${DB.escapeHtml(p.name)} (${DB.roundQty(p.stock)} ${DB.escapeHtml(p.unit || '')})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Wholesale Cost (₹)</label>
                  <input type="number" step="0.01" min="0.01" id="inward-item-cost" class="form-input" style="font-size: 12px;" placeholder="Cost" />
                </div>
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Quantity (Decimal OK)</label>
                  <input type="number" step="any" min="0.01" id="inward-item-qty" class="form-input" style="font-size: 12px;" placeholder="Qty" value="10" />
                </div>
                <div>
                  <label class="form-label" style="font-size: 10.5px;">Expiry Date (Opt.)</label>
                  <input type="date" id="inward-item-expiry" class="form-input" style="font-size: 11.5px;" />
                </div>
                <button type="button" class="btn btn-primary btn-sm" style="height: 36px; justify-content: center;" onclick="Purchases.addItemToInwardCart()">
                  + Add Item
                </button>
              </div>

              <!-- Optional Inline New SKU fields -->
              <div id="inward-new-sku-fields" style="display: none; margin-top: 10px; padding: 10px; background: var(--bg-input); border-radius: var(--radius-sm); border: 1px dashed var(--border-medium);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap: 8px;">
                  <div>
                    <label class="form-label" style="font-size: 10px;">New Product Name *</label>
                    <input type="text" id="inward-new-name" class="form-input" style="font-size: 12px;" placeholder="e.g. MDH Garam Masala 100g" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 10px;">Retail Sell Price (₹) *</label>
                    <input type="number" step="0.01" id="inward-new-price" class="form-input" style="font-size: 12px;" placeholder="85" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 10px;">Unit</label>
                    <select id="inward-new-unit" class="form-select" style="font-size: 12px;">
                      <option value="pack">pack</option>
                      <option value="kg">kg</option>
                      <option value="litre">litre</option>
                      <option value="bottle">bottle</option>
                      <option value="box">box</option>
                      <option value="piece">piece</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 10px;">GST Slab</label>
                    <select id="inward-new-gst" class="form-select" style="font-size: 12px;">
                      <option value="0">0%</option>
                      <option value="5" selected>5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div id="inward-cart-preview" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
              <div style="font-size: 14px; font-weight: 800; color: var(--text-primary);">
                Total Bill Amount: <span id="inward-grand-total" style="color: var(--primary);">₹0</span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
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
    this.renderInwardCartPreview();
  }

  onProductSelectChange(prodId) {
    const newBox = document.getElementById('inward-new-sku-fields');
    if (newBox) {
      newBox.style.display = prodId === '__NEW__' ? 'block' : 'none';
    }
    if (prodId === '__NEW__' || !prodId) return;

    const db = DB.getData();
    const prod = (db.products || []).find(p => p.id === prodId);
    if (prod) {
      const costIn = document.getElementById('inward-item-cost');
      const expIn = document.getElementById('inward-item-expiry');
      if (costIn) costIn.value = prod.cost || Math.round((prod.price || 0) * 0.85);
      if (expIn) expIn.value = prod.expiryDate || '';
    }
  }

  addItemToInwardCart() {
    const sel = document.getElementById('inward-item-prod');
    const costIn = document.getElementById('inward-item-cost');
    const qtyIn = document.getElementById('inward-item-qty');
    const expIn = document.getElementById('inward-item-expiry');

    if (!sel || !sel.value) {
      App.toast('danger', 'Select Product', 'Choose a product or "Create Brand-New Product SKU"');
      return;
    }

    const prodId = sel.value;
    const cost = DB.round2(parseFloat(costIn.value) || 0);
    const qty = DB.roundQty(parseFloat(qtyIn.value) || 0);
    const expiryDate = (expIn && expIn.value) ? expIn.value.trim() : '';

    if (cost <= 0 || qty <= 0) {
      App.toast('danger', 'Invalid Input', 'Wholesale cost and quantity must be greater than zero');
      return;
    }

    if (prodId === '__NEW__') {
      const newName = (document.getElementById('inward-new-name')?.value || '').trim();
      const newPrice = DB.round2(parseFloat(document.getElementById('inward-new-price')?.value) || Math.round(cost * 1.18));
      const newUnit = document.getElementById('inward-new-unit')?.value || 'pack';
      const newGst = parseInt(document.getElementById('inward-new-gst')?.value, 10) || 5;
      if (!newName) {
        App.toast('warning', 'Name Required', 'Enter the new product name.');
        return;
      }
      this.inwardCart.push({
        id: '__NEW__',
        createNewSku: true,
        name: newName,
        price: newPrice,
        unit: newUnit,
        gstRate: newGst,
        cost,
        qty,
        expiryDate,
        total: DB.round2(cost * qty)
      });
      if (document.getElementById('inward-new-name')) document.getElementById('inward-new-name').value = '';
    } else {
      const db = DB.getData();
      const prod = (db.products || []).find(p => p.id === prodId);
      const prodName = prod ? prod.name : 'Item';
      this.inwardCart.push({
        id: prodId,
        name: prodName,
        cost,
        qty,
        expiryDate,
        total: DB.round2(cost * qty)
      });
    }

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

    const grand = DB.round2(this.inwardCart.reduce((s, i) => s + (Number(i.total) || 0), 0));
    if (totalEl) totalEl.textContent = `₹${grand.toLocaleString('en-IN')}`;

    container.innerHTML = this.inwardCart.map((item, idx) => `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: var(--bg-surface); padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px;">
        <span style="font-weight: 600; flex: 1; min-width: 120px;">
          ${DB.escapeHtml(item.name)}
          ${item.createNewSku ? `<span class="badge badge-primary" style="font-size: 9px; padding: 1px 5px; margin-left: 4px;">NEW SKU</span>` : ''}
          ${item.expiryDate ? `<span style="font-size: 10px; color: var(--text-muted); margin-left: 4px;">Exp: ${DB.escapeHtml(item.expiryDate)}</span>` : ''}
        </span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="tnum">${item.qty} × ₹${item.cost} = <strong>₹${DB.round2(item.total).toLocaleString('en-IN')}</strong></span>
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
    const date = document.getElementById('inward-date').value || DB.getLocalDateStr();
    const payMode = document.getElementById('inward-paymode').value || 'Cash';

    const db = DB.getData();
    const sup = (db.suppliers || []).find(s => s.id === supId);
    const supName = sup ? sup.name : 'Wholesale Distributor';

    if (!Array.isArray(db.products)) db.products = [];

    const finalizedItems = this.inwardCart.map(inItem => {
      if (inItem.createNewSku) {
        const newId = DB.uid('P');
        const createdProd = {
          id: newId,
          name: inItem.name,
          cat: 'Grocery',
          barcode: '',
          mrp: Math.round((inItem.price || inItem.cost * 1.2) * 1.05),
          price: inItem.price || Math.round(inItem.cost * 1.2),
          cost: inItem.cost,
          stock: inItem.qty,
          unit: inItem.unit || 'pack',
          minStock: 5,
          gstRate: [0, 5, 12, 18].includes(Number(inItem.gstRate)) ? Number(inItem.gstRate) : 5,
          expiryDate: inItem.expiryDate || '',
          soldQty: 0,
          soldRevenue: 0,
          lastSoldAt: 0
        };
        db.products.unshift(createdProd);
        return { id: newId, name: inItem.name, cost: inItem.cost, qty: inItem.qty, total: inItem.total };
      }

      const prod = db.products.find(p => p.id === inItem.id);
      if (prod) {
        prod.stock = DB.roundQty((Number(prod.stock) || 0) + inItem.qty);
        prod.cost = inItem.cost;
        if (inItem.expiryDate) prod.expiryDate = inItem.expiryDate;
      }
      return { id: inItem.id, name: inItem.name, cost: inItem.cost, qty: inItem.qty, total: inItem.total };
    });

    const grandTotal = DB.round2(finalizedItems.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const isCredit = payMode === 'Credit';

    const newPurchase = {
      id: DB.uid('PUR-'),
      billNo,
      date,
      supplierId: supId || '',
      supplierName: supName,
      items: finalizedItems,
      totalAmount: grandTotal,
      paidAmount: isCredit ? 0 : grandTotal,
      dueAmount: isCredit ? grandTotal : 0,
      status: isCredit ? 'Due' : 'Paid',
      paymentMode: payMode
    };

    if (isCredit && sup) {
      sup.balanceDue = DB.round2((Number(sup.balanceDue) || 0) + grandTotal);
    }

    if (!Array.isArray(db.purchases)) db.purchases = [];
    db.purchases.unshift(newPurchase);

    DB.saveData(db);
    App.toast('success', 'Stock Inward Saved', `Added ${finalizedItems.length} SKU(s) to inventory (₹${grandTotal.toLocaleString('en-IN')})`);

    this.closeModals();
    this.render(document.getElementById('main-view-container'));
    if (window.POS) POS.renderCatalog();
    App.updateNotificationBadge();
  }

  // =========================================================================
  // AI WHOLESALER BILL PHOTO SCANNER (Gemini Vision Multimodal)
  // =========================================================================
  openAiBillScannerModal() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('scan wholesale purchase bills');
      return;
    }
    this.closeModals();
    this._scannedBillDraft = null;
    const isOnline = navigator.onLine !== false;

    const modalHtml = `
      <div class="modal-backdrop" id="ai-bill-scanner-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 720px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.camera(16)} AI Wholesaler Bill Photo Scanner (Gemini Vision)</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            ${!isOnline ? `
              <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.35); padding: 10px 12px; border-radius: var(--radius-md); font-size: 12.5px; color: var(--warning);">
                <strong>🟠 Offline Notice:</strong> AI Vision bill scanning requires an active internet connection. Connect online or use "Record Inward Bill" for manual offline entry.
              </div>
            ` : ''}

            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px dashed var(--border-medium); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div style="flex: 1 1 220px; min-width: 0;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Upload or Snap Distributor Paper Bill</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Gemini 3.8 Vision extracts supplier name, bill no, items, qty &amp; wholesale rates automatically.</div>
              </div>
              <label class="btn btn-primary btn-sm" style="cursor: pointer; margin: 0;">
                ${Icons.camera(14)} Choose / Snap Bill Photo
                <input type="file" id="ai-bill-photo-input" accept="image/*" capture="environment" style="display: none;" onchange="Purchases.handleBillPhotoSelect(event)" />
              </label>
            </div>

            <div id="ai-bill-scan-status"></div>
            <div id="ai-bill-preview-box"></div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async compressImageToBase64(file, maxDim = 1280) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image format'));
        img.onload = () => {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({
            dataUrl,
            base64: dataUrl.split(',')[1] || '',
            mimeType: 'image/jpeg'
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async handleBillPhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    event.target.value = '';

    const statusEl = document.getElementById('ai-bill-scan-status');
    const previewEl = document.getElementById('ai-bill-preview-box');
    if (!statusEl || !previewEl) return;

    if (navigator.onLine === false) {
      statusEl.innerHTML = `<div style="color: var(--danger); font-size: 12px;">Internet required for Gemini Vision OCR.</div>`;
      return;
    }

    try {
      statusEl.innerHTML = `<div style="font-size: 12px; color: var(--primary); font-weight: 600;">⏳ Optimizing photo &amp; reading items with Gemini 3.8 Vision...</div>`;
      previewEl.innerHTML = '';

      const compressed = await this.compressImageToBase64(file, 1280);
      if (!compressed.base64) throw new Error('Image compression failed');

      const res = window.DukaanAI && typeof DukaanAI.scanPurchaseBillOnline === 'function'
        ? await DukaanAI.scanPurchaseBillOnline(compressed.base64, compressed.mimeType)
        : { ok: false, error: 'AI Vision helper unavailable' };

      if (!res || !res.ok || !res.bill) {
        statusEl.innerHTML = `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; color: var(--danger);">Live Gemini Vision Error: ${DB.escapeHtml((res && res.error) || 'Failed to parse bill image')}</div>`;
        return;
      }

      const db = DB.getData();
      const catalog = db.products || [];
      const rawBill = res.bill;

      const draftItems = (rawBill.items || []).map(it => {
        const cleanName = String(it.name || 'Item').trim();
        const words = cleanName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
        let best = null;
        let bestScore = 0;
        catalog.forEach(p => {
          const hay = p.name.toLowerCase();
          let score = 0;
          words.forEach(w => { if (hay.includes(w)) score++; });
          if (score > bestScore) { bestScore = score; best = p; }
        });

        const matchedProd = bestScore >= 1 ? best : null;
        const cost = DB.round2(parseFloat(it.cost) || (matchedProd ? matchedProd.cost : 50));
        const qty = Math.max(0.05, DB.roundQty(parseFloat(it.qty) || 1));

        return {
          matchedProductId: matchedProd ? matchedProd.id : '__NEW__',
          name: matchedProd ? matchedProd.name : cleanName,
          qty,
          cost,
          sellPrice: matchedProd ? matchedProd.price : Math.round(cost * 1.18),
          unit: it.unit || (matchedProd ? matchedProd.unit : 'pack'),
          gstRate: [0, 5, 12, 18].includes(Number(it.gstRate)) ? Number(it.gstRate) : (matchedProd ? (matchedProd.gstRate ?? 5) : 5),
          expiryDate: ''
        };
      });

      this._scannedBillDraft = {
        thumbnail: compressed.dataUrl,
        supplierName: rawBill.supplierName || 'Wholesale Distributor',
        billNo: rawBill.billNo || `SCAN-${Date.now().toString().slice(-4)}`,
        date: /^\d{4}-\d{2}-\d{2}$/.test(rawBill.date || '') ? rawBill.date : DB.getLocalDateStr(),
        paymentMode: 'Credit',
        items: draftItems
      };

      statusEl.innerHTML = `<div style="font-size: 12px; color: var(--success); font-weight: 700;">🟢 Extracted ${draftItems.length} item(s) via ${DB.escapeHtml(res.model || 'Gemini 3.8')} — Review & Confirm below:</div>`;
      this.renderScannedBillDraft();
    } catch (err) {
      statusEl.innerHTML = `<div style="color: var(--danger); font-size: 12px;">Scan error: ${DB.escapeHtml(err.message)}</div>`;
    }
  }

  renderScannedBillDraft() {
    const box = document.getElementById('ai-bill-preview-box');
    const draft = this._scannedBillDraft;
    if (!box || !draft) return;

    const db = DB.getData();
    const products = db.products || [];
    const total = DB.round2(draft.items.reduce((s, it) => s + (it.cost * it.qty), 0));

    box.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 8px; margin-bottom: 10px;">
        <div>
          <label class="form-label" style="font-size: 10px;">Supplier Name</label>
          <input type="text" class="form-input" value="${DB.escapeHtml(draft.supplierName)}" onchange="Purchases._scannedBillDraft.supplierName = this.value" />
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">Bill No</label>
          <input type="text" class="form-input" value="${DB.escapeHtml(draft.billNo)}" onchange="Purchases._scannedBillDraft.billNo = this.value" />
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">Bill Date</label>
          <input type="date" class="form-input" value="${DB.escapeHtml(draft.date)}" onchange="Purchases._scannedBillDraft.date = this.value" />
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">Payment</label>
          <select class="form-select" onchange="Purchases._scannedBillDraft.paymentMode = this.value">
            <option value="Cash" ${draft.paymentMode === 'Cash' ? 'selected' : ''}>Cash</option>
            <option value="UPI" ${draft.paymentMode === 'UPI' ? 'selected' : ''}>UPI</option>
            <option value="Credit" ${draft.paymentMode === 'Credit' ? 'selected' : ''}>Credit (Due)</option>
          </select>
        </div>
      </div>

      <div class="table-container" style="max-height: 240px; overflow-y: auto; margin-bottom: 10px;">
        <table class="data-table" style="font-size: 11.5px;">
          <thead>
            <tr>
              <th>Catalog Link / New SKU</th>
              <th>Item Name</th>
              <th>Qty</th>
              <th>Cost (₹)</th>
              <th>MRP/Sell (₹)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${draft.items.map((it, idx) => `
              <tr>
                <td>
                  <select class="form-select" style="font-size: 11px; padding: 4px 6px;" onchange="Purchases._scannedBillDraft.items[${idx}].matchedProductId = this.value;">
                    <option value="__NEW__" ${it.matchedProductId === '__NEW__' ? 'selected' : ''}>✨ Create New SKU</option>
                    ${products.map(p => `<option value="${DB.escapeHtml(p.id)}" ${it.matchedProductId === p.id ? 'selected' : ''}>Link: ${DB.escapeHtml(p.name.slice(0, 22))}</option>`).join('')}
                  </select>
                </td>
                <td><input type="text" class="form-input" style="font-size: 11.5px; padding: 4px 6px;" value="${DB.escapeHtml(it.name)}" onchange="Purchases._scannedBillDraft.items[${idx}].name = this.value" /></td>
                <td><input type="number" step="any" min="0.05" class="form-input" style="width: 64px; font-size: 11.5px; padding: 4px 6px;" value="${it.qty}" onchange="Purchases._scannedBillDraft.items[${idx}].qty = Math.max(0.05, DB.roundQty(this.value)); Purchases.renderScannedBillDraft();" /></td>
                <td><input type="number" step="0.01" min="0" class="form-input" style="width: 72px; font-size: 11.5px; padding: 4px 6px;" value="${it.cost}" onchange="Purchases._scannedBillDraft.items[${idx}].cost = DB.round2(this.value); Purchases.renderScannedBillDraft();" /></td>
                <td><input type="number" step="0.01" min="0" class="form-input" style="width: 72px; font-size: 11.5px; padding: 4px 6px;" value="${it.sellPrice}" onchange="Purchases._scannedBillDraft.items[${idx}].sellPrice = DB.round2(this.value)" /></td>
                <td><button type="button" class="btn btn-danger btn-sm" onclick="Purchases._scannedBillDraft.items.splice(${idx}, 1); Purchases.renderScannedBillDraft();">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="font-weight: 800; font-size: 14px;">Extracted Bill Total: <span style="color: var(--primary);" class="tnum">₹${total.toLocaleString('en-IN')}</span></div>
        <button type="button" class="btn btn-success" onclick="Purchases.commitScannedBill()" ${draft.items.length ? '' : 'disabled'}>
          ${Icons.check(15)} Save Bill & Auto-Stock ${draft.items.length} SKU(s)
        </button>
      </div>
    `;
  }

  commitScannedBill() {
    const draft = this._scannedBillDraft;
    if (!draft || !draft.items.length) return;

    const db = DB.getData();
    if (!Array.isArray(db.products)) db.products = [];
    if (!Array.isArray(db.suppliers)) db.suppliers = [];
    if (!Array.isArray(db.purchases)) db.purchases = [];

    // Match or create supplier
    const supNameClean = (draft.supplierName || 'Wholesale Distributor').trim();
    let sup = db.suppliers.find(s => s.name.toLowerCase() === supNameClean.toLowerCase());
    if (!sup) {
      sup = {
        id: DB.uid('SUP-'),
        name: supNameClean,
        contactPerson: '',
        phone: '',
        city: 'Wholesale',
        gstin: '',
        itemsSupplied: draft.items.map(i => i.name).slice(0, 3).join(', '),
        balanceDue: 0
      };
      db.suppliers.push(sup);
    }

    const billItems = [];
    let grandTotal = 0;

    draft.items.forEach(it => {
      const qty = Math.max(0.05, DB.roundQty(it.qty));
      const cost = DB.round2(it.cost);
      const lineTotal = DB.round2(qty * cost);
      grandTotal = DB.round2(grandTotal + lineTotal);

      let prodId = it.matchedProductId;
      if (prodId && prodId !== '__NEW__') {
        const prod = db.products.find(p => p.id === prodId);
        if (prod) {
          prod.stock = DB.roundQty((Number(prod.stock) || 0) + qty);
          prod.cost = cost;
          if (it.sellPrice > 0) prod.price = DB.round2(it.sellPrice);
          billItems.push({ id: prod.id, name: prod.name, qty, cost, total: lineTotal });
          return;
        }
      }

      const newId = DB.uid('P');
      const sell = DB.round2(it.sellPrice > 0 ? it.sellPrice : cost * 1.18);
      db.products.unshift({
        id: newId,
        name: it.name,
        cat: 'Grocery',
        barcode: '',
        mrp: Math.round(sell * 1.08),
        price: sell,
        cost,
        stock: qty,
        unit: it.unit || 'pack',
        minStock: 5,
        gstRate: [0, 5, 12, 18].includes(Number(it.gstRate)) ? Number(it.gstRate) : 5,
        expiryDate: it.expiryDate || '',
        soldQty: 0,
        soldRevenue: 0,
        lastSoldAt: 0
      });
      billItems.push({ id: newId, name: it.name, qty, cost, total: lineTotal });
    });

    const isCredit = draft.paymentMode === 'Credit';
    db.purchases.unshift({
      id: DB.uid('PUR-'),
      billNo: draft.billNo || DB.uid('BILL-'),
      date: draft.date || DB.getLocalDateStr(),
      supplierId: sup.id,
      supplierName: sup.name,
      items: billItems,
      totalAmount: grandTotal,
      paidAmount: isCredit ? 0 : grandTotal,
      dueAmount: isCredit ? grandTotal : 0,
      status: isCredit ? 'Due' : 'Paid',
      paymentMode: draft.paymentMode || 'Credit'
    });

    if (isCredit) {
      sup.balanceDue = DB.round2((Number(sup.balanceDue) || 0) + grandTotal);
    }

    DB.saveData(db);
    this._scannedBillDraft = null;
    this.closeModals();
    this.render(document.getElementById('main-view-container'));
    if (window.POS) POS.renderCatalog();
    App.updateNotificationBadge();
    App.toast('success', 'AI Bill Imported ✓', `${billItems.length} SKU(s) stocked • ₹${grandTotal.toLocaleString('en-IN')}`);
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
          <form class="modal-body" onsubmit="event.preventDefault(); Purchases.saveSupplier();" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
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
      id: DB.uid('SUP-'),
      name,
      contactPerson: contact,
      phone,
      city: city || 'Local',
      gstin,
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

  // Pay Supplier Balance Modal (FIFO settles supplier balanceDue AND credit purchase bills)
  openPaySupplierModal(supId) {
    const db = DB.getData();
    const sup = (db.suppliers || []).find(s => s.id === supId);
    if (!sup) return;
    const due = DB.round2(sup.balanceDue || 0);
    if (due <= 0) return;

    const openBills = (db.purchases || []).filter(p => p.supplierId === supId && (Number(p.dueAmount) || 0) > 0);
    this.closeModals();

    const modalHtml = `
      <div class="modal-backdrop" id="pay-supplier-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.wallet(16)} Settle Supplier Payable — ${DB.escapeHtml(sup.name)}</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 14px;">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total Payable Balance</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--danger); margin-top: 2px;" class="tnum">₹${due.toLocaleString('en-IN')}</div>
              ${openBills.length ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Covers ${openBills.length} pending credit purchase bill(s) FIFO.</div>` : ''}
            </div>
            <form onsubmit="event.preventDefault(); Purchases.saveSupplierPayment('${DB.escapeHtml(sup.id)}');">
              <div class="form-group">
                <label class="form-label">Payment Amount (₹) *</label>
                <input type="number" step="0.01" min="1" max="${due}" id="sup-pay-amount" class="form-input" required value="${due}" />
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <select id="sup-pay-mode" class="form-select">
                  <option value="UPI">UPI / NEFT / Bank</option>
                  <option value="Cash">Cash Paid</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <input type="text" id="sup-pay-notes" class="form-input" placeholder="e.g. RTGS / GPay Ref #" />
              </div>
              <div class="modal-footer" style="padding: 12px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="Purchases.closeModals()">Cancel</button>
                <button type="submit" class="btn btn-success">${Icons.check(14)} Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveSupplierPayment(supId) {
    const db = DB.getData();
    const sup = (db.suppliers || []).find(s => s.id === supId);
    if (!sup) return;

    const rawAmt = DB.round2(parseFloat(document.getElementById('sup-pay-amount')?.value) || 0);
    const mode = document.getElementById('sup-pay-mode')?.value || 'UPI';
    const notes = (document.getElementById('sup-pay-notes')?.value || '').trim();
    const maxPayable = DB.round2(sup.balanceDue || 0);

    if (rawAmt <= 0 || rawAmt > maxPayable) {
      App.toast('warning', 'Invalid Amount', `Enter a valid amount between ₹1 and ₹${maxPayable}`);
      return;
    }

    sup.balanceDue = Math.max(0, DB.round2(maxPayable - rawAmt));

    // Settle open credit purchase invoices FIFO
    let remaining = rawAmt;
    const openBills = (db.purchases || [])
      .filter(p => p.supplierId === supId && (Number(p.dueAmount) || 0) > 0)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    openBills.forEach(bill => {
      if (remaining <= 0) return;
      const billDue = DB.round2(bill.dueAmount || 0);
      const settleAmt = Math.min(remaining, billDue);
      bill.paidAmount = DB.round2((Number(bill.paidAmount) || 0) + settleAmt);
      bill.dueAmount = Math.max(0, DB.round2(billDue - settleAmt));
      bill.status = bill.dueAmount <= 0.01 ? 'Paid' : 'Partial';
      if (bill.dueAmount <= 0.01) bill.dueAmount = 0;
      remaining = DB.round2(remaining - settleAmt);
    });

    if (!Array.isArray(db.expenses)) db.expenses = [];
    db.expenses.unshift({
      id: DB.uid('E'),
      desc: `Supplier Payment (${mode}): ${sup.name}${notes ? ' - ' + notes : ''}`,
      cat: 'Wholesale Purchase',
      amount: rawAmt,
      date: DB.getLocalDateStr(),
      status: 'Paid'
    });

    DB.saveData(db);
    DB.playCashChime();
    this.closeModals();
    App.toast('success', 'Payment Settled', `Paid ₹${rawAmt.toLocaleString('en-IN')} to ${sup.name}`);
    this.render(document.getElementById('main-view-container'));
  }

  viewPurchaseDetails(purchaseId) {
    const db = DB.getData();
    const p = (db.purchases || []).find(x => x.id === purchaseId);
    if (!p) return;

    this.closeModals();
    const modalHtml = `
      <div class="modal-backdrop" id="view-pur-modal" onclick="if(event.target===this) Purchases.closeModals()">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.receipt(16)} Inward Delivery: ${DB.escapeHtml(p.billNo || p.id)}</div>
            <button class="topbar-icon-btn" onclick="Purchases.closeModals()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12.5px;">
              <div>
                <strong>Supplier:</strong> ${DB.escapeHtml(p.supplierName || '')}<br>
                <strong>Date:</strong> ${DB.escapeHtml(p.date || '')}
              </div>
              <div style="text-align: right;">
                <span class="badge ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-warning' : 'badge-danger'}">${DB.escapeHtml(p.status)}</span><br>
                <span style="font-size: 11px; color: var(--text-muted);">${DB.escapeHtml(p.paymentMode || '')}</span>
              </div>
            </div>

            <div class="table-container" style="margin-bottom: 14px;">
              <table class="data-table" style="font-size: 12px;">
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
                      <td>${DB.escapeHtml(i.name)}</td>
                      <td class="tnum">₹${i.cost}</td>
                      <td class="tnum">${i.qty}</td>
                      <td style="font-weight: 700;" class="tnum">₹${i.total}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
              <span>Total Invoice Amount:</span>
              <span style="color: var(--primary);" class="tnum">₹${DB.round2(p.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 14px;">
              <button class="btn btn-primary" style="flex: 1; justify-content: center;" onclick="Purchases.printPurchaseBill('${DB.escapeHtml(p.id)}')">
                ${Icons.print(14)} Print Bill
              </button>
              <button class="btn btn-secondary" style="flex: 1; justify-content: center;" onclick="Purchases.closeModals()">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  printPurchaseBill(purchaseId) {
    const db = DB.getData();
    const shop = db.shop || {};
    const p = (db.purchases || []).find(x => x.id === purchaseId);
    if (!p) return;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 760px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:18px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Wholesale Inward GRN</h2>
            <div style="font-size:12px; color:#4B5563;">Supplier: <strong>${DB.escapeHtml(p.supplierName || '')}</strong></div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Bill No:</strong> ${DB.escapeHtml(p.billNo || p.id)}</div>
            <div><strong>Date:</strong> ${DB.escapeHtml(p.date || '')} • ${DB.escapeHtml(p.status || '')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:14px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:left;">Product</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:right;">Cost Rate</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:center;">Qty</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:right;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${(p.items || []).map(i => `
              <tr>
                <td style="padding:7px; border:1px solid #D1D5DB;">${DB.escapeHtml(i.name)}</td>
                <td style="padding:7px; border:1px solid #D1D5DB; text-align:right;">₹${DB.round2(i.cost)}</td>
                <td style="padding:7px; border:1px solid #D1D5DB; text-align:center;">${i.qty}</td>
                <td style="padding:7px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${DB.round2(i.total).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; padding:8px; background:#F9FAFB; border:1px solid #D1D5DB;">
          <span>Payment Mode: ${DB.escapeHtml(p.paymentMode || 'Credit')} (Paid: ₹${DB.round2(p.paidAmount || 0)} | Due: ₹${DB.round2(p.dueAmount || 0)})</span>
          <span>Total: ₹${DB.round2(p.totalAmount || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }

  printPurchasesReport() {
    const db = DB.getData();
    const shop = db.shop || {};
    const purchases = db.purchases || [];
    const total = DB.round2(purchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0));
    const totalDue = DB.round2(purchases.reduce((s, p) => s + (Number(p.dueAmount) || 0), 0));

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Wholesale Purchase Register</h2>
            <div style="font-size:12px; color:#4B5563;">Printed: ${DB.getLocalDateStr()} • ${purchases.length} Inward Bills</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Total Billed:</strong> ₹${total.toLocaleString('en-IN')}</div>
            <div><strong>Pending Dues:</strong> ₹${totalDue.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Date</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Bill No</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Supplier</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Amount</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Due</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${purchases.map(p => `
              <tr>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(p.date || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(p.billNo || p.id)}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(p.supplierName || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right;">₹${DB.round2(p.totalAmount || 0).toLocaleString('en-IN')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right;">₹${DB.round2(p.dueAmount || 0).toLocaleString('en-IN')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${DB.escapeHtml(p.status || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
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
      csv += `"${p.id}","${p.billNo}","${p.date}","${String(p.supplierName || '').replace(/"/g, '""')}",${p.totalAmount},${p.paidAmount},${p.dueAmount},"${p.status}","${p.paymentMode}"\n`;
    });

    DB.downloadFile(csv, `wholesale_purchases_${DB.getLocalDateStr()}.csv`);
    App.toast('success', 'Exported', 'Purchases CSV downloaded');
  }

  closeModals() {
    ['inward-modal', 'supplier-modal', 'view-pur-modal', 'pay-supplier-modal', 'ai-bill-scanner-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}

window.Purchases = new PurchaseEngine();
