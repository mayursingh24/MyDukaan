/**
 * MyDukkan24 — Inventory Catalog, Expiry Alerts, Bulk CSV Import & Smart Demand Predictor
 * Full owner stock management + Cashier Read-Only Stock view + decimal qty & GST slabs.
 */

class InventoryEngine {
  constructor() {
    this.searchQuery = "";
    this.filterCategory = "All";
    this.filterStock = "All"; // 'All', 'Low', 'OutOfStock', 'Expiring7', 'Expired'
    this._bulkParsedRows = [];
    this._restockPredictions = [];
  }

  isCashier() {
    return Boolean(window.App && typeof App.isCashierMode === 'function' && App.isCashierMode());
  }

  setSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.render();
  }

  getExpiryMeta(expiryDate) {
    const clean = String(expiryDate || '').trim();
    if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;

    const todayStr = DB.getLocalDateStr();
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
    const expMs = new Date(`${clean}T00:00:00`).getTime();
    if (Number.isNaN(todayMs) || Number.isNaN(expMs)) return null;

    const diffDays = Math.round((expMs - todayMs) / 86400000);
    if (diffDays < 0) {
      return { status: 'expired', days: diffDays, badgeClass: 'badge-danger', label: `Expired (${Math.abs(diffDays)}d ago)` };
    }
    if (diffDays === 0) {
      return { status: 'expiring7', days: 0, badgeClass: 'badge-danger', label: 'Expires Today!' };
    }
    if (diffDays <= 7) {
      return { status: 'expiring7', days: diffDays, badgeClass: 'badge-warning', label: `Expiring in ${diffDays}d` };
    }
    if (diffDays <= 30) {
      return { status: 'soon', days: diffDays, badgeClass: 'badge-muted', label: `Exp: ${clean}` };
    }
    return { status: 'ok', days: diffDays, badgeClass: 'badge-muted', label: `Exp: ${clean}` };
  }

  render() {
    const container = document.getElementById('inventory-table-tbody');
    const statsContainer = document.getElementById('inventory-kpi-row');
    if (!container) return;

    const cashier = this.isCashier();
    const db = DB.getData();
    let products = db.products || [];

    // KPI Counters
    const totalItems = products.length;
    const totalStockQty = DB.roundQty(products.reduce((s, p) => s + (Number(p.stock) || 0), 0));
    const lowStockItems = products.filter(p => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
    const outOfStockItems = products.filter(p => (Number(p.stock) || 0) <= 0);
    const expiringItems = products.filter(p => {
      const ex = this.getExpiryMeta(p.expiryDate);
      return ex && (ex.status === 'expiring7' || ex.status === 'expired');
    });
    const stockValuation = Math.round(products.reduce((s, p) => s + ((Number(p.cost) || 0) * (Number(p.stock) || 0)), 0));
    const retailValuation = Math.round(products.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0));

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Products</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.package(16)}
            </div>
          </div>
          <div class="kpi-val">${totalItems}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${totalStockQty} total units in stock</div>
        </div>

        ${!cashier ? `
          <div class="kpi-card">
            <div class="kpi-top">
              <span class="kpi-title">Cost Valuation</span>
              <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">
                ${Icons.wallet(16)}
              </div>
            </div>
            <div class="kpi-val tnum">₹${stockValuation.toLocaleString('en-IN')}</div>
            <div class="kpi-trend" style="color: var(--success);">Retail value: ₹${retailValuation.toLocaleString('en-IN')}</div>
          </div>
        ` : `
          <div class="kpi-card">
            <div class="kpi-top">
              <span class="kpi-title">Out of Stock</span>
              <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
                ${Icons.close(16)}
              </div>
            </div>
            <div class="kpi-val" style="color: var(--danger);">${outOfStockItems.length}</div>
            <div class="kpi-trend" style="color: var(--danger);">Ask Owner to restock</div>
          </div>
        `}

        <div class="kpi-card" style="cursor: pointer;" onclick="Inventory.setStockFilter('Low')">
          <div class="kpi-top">
            <span class="kpi-title">Low Stock Alerts</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">
              ${Icons.alert(16)}
            </div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">${lowStockItems.length}</div>
          <div class="kpi-trend" style="color: var(--warning);">Items below safe threshold</div>
        </div>

        <div class="kpi-card" style="cursor: pointer;" onclick="Inventory.setStockFilter('Expiring7')">
          <div class="kpi-top">
            <span class="kpi-title">Expiry Alerts (≤7d)</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.calendar(16)}
            </div>
          </div>
          <div class="kpi-val" style="color: ${expiringItems.length ? 'var(--danger)' : 'var(--success)'};">${expiringItems.length}</div>
          <div class="kpi-trend" style="color: ${expiringItems.length ? 'var(--danger)' : 'var(--text-muted)'};">${outOfStockItems.length} out of stock SKUs</div>
        </div>
      `;
    }

    // Filter Logic
    if (this.filterCategory !== 'All') {
      products = products.filter(p => p.cat === this.filterCategory);
    }
    if (this.filterStock === 'Low') {
      products = products.filter(p => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
    } else if (this.filterStock === 'OutOfStock') {
      products = products.filter(p => (Number(p.stock) || 0) <= 0);
    } else if (this.filterStock === 'Expiring7') {
      products = products.filter(p => {
        const ex = this.getExpiryMeta(p.expiryDate);
        return ex && (ex.status === 'expiring7' || ex.status === 'expired');
      });
    } else if (this.filterStock === 'Expired') {
      products = products.filter(p => {
        const ex = this.getExpiryMeta(p.expiryDate);
        return ex && ex.status === 'expired';
      });
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      products = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.cat && p.cat.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q))
      );
    }

    const colSpan = cashier ? 6 : 7;
    if (!products.length) {
      container.innerHTML = `
        <tr>
          <td colspan="${colSpan}" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
            <div>${Icons.search(32)}</div>
            <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">No matching inventory items found</div>
            <p style="font-size: 12px; margin-top: 4px;">Adjust your search keyword or active filter.</p>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = products.map(p => {
      const stockNum = DB.roundQty(p.stock || 0);
      const isOut = stockNum <= 0;
      const isLow = stockNum > 0 && stockNum <= (Number(p.minStock) || 0);
      const gst = [0, 5, 12, 18].includes(Number(p.gstRate)) ? Number(p.gstRate) : DB.inferDefaultGstRate(p.cat, p.name);
      const priceNum = Number(p.price) || 0;
      const costNum = Number(p.cost) || 0;
      const margin = priceNum > costNum && priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : 0;
      const profitUnit = Math.max(0, DB.round2(priceNum - costNum));
      const exp = this.getExpiryMeta(p.expiryDate);

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${DB.escapeHtml(p.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <span>SKU: ${DB.escapeHtml(p.id)} • ${DB.escapeHtml(p.unit || 'unit')} • GST ${gst}%</span>
              ${exp ? `<span class="badge ${exp.badgeClass}" style="font-size: 10px; padding: 1px 6px;">${DB.escapeHtml(exp.label)}</span>` : ''}
            </div>
          </td>
          <td><span class="badge badge-muted">${DB.escapeHtml(p.cat || 'General')}</span></td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${DB.round2(priceNum)}</div>
            ${p.mrp > priceNum ? `<div style="font-size: 11px; color: var(--text-muted); text-decoration: line-through;" class="tnum">MRP ₹${DB.round2(p.mrp)}</div>` : ''}
          </td>
          ${!cashier ? `
            <td>
              <div style="font-size: 12.5px; color: var(--text-secondary);" class="tnum">₹${DB.round2(costNum)}</div>
              <div style="font-size: 10.5px; color: var(--success); font-weight: 600;">
                ${margin}% (₹${profitUnit}/u)
              </div>
            </td>
          ` : ''}
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
              ${isOut ? 'Out of Stock' : `${stockNum} ${DB.escapeHtml(p.unit || '')}`}
            </span>
            ${isLow ? `<div style="font-size: 10px; color: var(--warning); margin-top: 3px;">Min alert: ${DB.roundQty(p.minStock)}</div>` : ''}
          </td>
          <td>
            <code style="font-family: var(--font-mono); font-size: 11px; background: var(--bg-input); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle);">
              ${DB.escapeHtml(p.barcode || 'N/A')}
            </code>
          </td>
          <td>
            ${cashier ? `
              <button class="btn btn-primary btn-sm" ${isOut ? 'disabled style="opacity:0.45;"' : ''} onclick="if(window.POS){ POS.addItemToCart(DB.getData().products.find(x => x.id === '${DB.escapeHtml(p.id)}')); App.navigate('pos'); }">
                ${Icons.plus(13)} Bill
              </button>
            ` : `
              <div style="display: flex; gap: 6px; align-items: center;">
                <button class="btn btn-secondary btn-sm" onclick="Inventory.quickRestock('${DB.escapeHtml(p.id)}')" title="Add Stock">
                  + Stock
                </button>
                <button class="btn btn-secondary btn-sm" onclick="Inventory.openEditProductModal('${DB.escapeHtml(p.id)}')" title="Edit Product">
                  ${Icons.edit(14)}
                </button>
                <button class="btn btn-danger btn-sm" onclick="Inventory.deleteProduct('${DB.escapeHtml(p.id)}')" title="Delete Product">
                  ${Icons.trash(14)}
                </button>
              </div>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  setStockFilter(val) {
    this.filterStock = val || 'All';
    const sel = document.getElementById('inv-filter-stock-select');
    if (sel) sel.value = this.filterStock;
    this.render();
  }

  // Quick Restock Function (supports decimal loose weight qty like 2.5 kg)
  quickRestock(id) {
    if (this.isCashier()) {
      App.requireOwner('restock inventory');
      return;
    }
    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (!prod) return;

    const qtyStr = prompt(`Enter quantity to add to "${prod.name}" (Current: ${DB.roundQty(prod.stock)} ${prod.unit}):`, "10");
    if (!qtyStr) return;
    const qty = DB.roundQty(parseFloat(qtyStr));
    if (isNaN(qty) || qty <= 0) return;

    prod.stock = DB.roundQty((Number(prod.stock) || 0) + qty);
    DB.saveData(db);
    App.toast('success', 'Stock Updated', `Added ${qty} ${prod.unit} to ${prod.name}`);
    this.render();
    if (App.currentView === 'dashboard') {
      const container = document.getElementById('main-view-container');
      if (container) App.renderDashboardView(container);
    }
    if (window.POS) POS.renderCatalog();
    App.updateNotificationBadge();
  }

  deleteProduct(id) {
    if (this.isCashier()) {
      App.requireOwner('delete products');
      return;
    }
    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (!prod) return;

    if (confirm(`Are you sure you want to delete "${prod.name}" from your catalog?`)) {
      DB.deleteItem('products', id);
      App.toast('info', 'Deleted', `${prod.name} removed from inventory`);
      this.render();
      if (window.POS) POS.renderCatalog();
      App.updateNotificationBadge();
    }
  }

  openAddProductWithBarcode(barcode = "") {
    this.openProductModal(null, barcode);
  }

  openEditProductModal(id) {
    if (this.isCashier()) {
      App.requireOwner('edit product pricing');
      return;
    }
    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (prod) {
      this.openProductModal(prod);
    }
  }

  generateSku() {
    const randomNum = Math.floor(100000000000 + Math.random() * 900000000000);
    const barcodeInput = document.getElementById('prod-form-barcode');
    if (barcodeInput) barcodeInput.value = `890${String(randomNum).slice(0, 10)}`;
  }

  openProductModal(product = null, prefilledBarcode = "") {
    if (this.isCashier()) {
      App.requireOwner('add or edit products');
      return;
    }
    const isEdit = !!product;
    const currentGst = isEdit
      ? ([0, 5, 12, 18].includes(Number(product.gstRate)) ? Number(product.gstRate) : 5)
      : 5;

    const modalHtml = `
      <div class="modal-backdrop" id="product-form-modal" onclick="if(event.target === this) Inventory.closeModal()">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">
              ${isEdit ? Icons.edit(16) : Icons.plus(16)}
              <span>${isEdit ? 'Edit Product Details' : 'Add New Product to Catalog'}</span>
            </div>
            <button class="topbar-icon-btn" onclick="Inventory.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Inventory.saveProductForm('${isEdit ? DB.escapeHtml(product.id) : ''}');">
              <div class="form-group">
                <label class="form-label">Product Name *</label>
                <input type="text" id="prod-form-name" class="form-input" required placeholder="e.g. Fortune Sunflower Oil 1L" value="${isEdit ? DB.escapeHtml(product.name) : ''}" />
              </div>

              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="prod-form-cat" class="form-select">
                    ${['Grocery', 'Dairy', 'Snacks', 'Beverages', 'Oils', 'Household', 'Personal Care', 'Healthcare', 'Chocolates', 'General'].map(c => `
                      <option value="${c}" ${isEdit && product.cat === c ? 'selected' : ''}>${c}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit Type</label>
                  <select id="prod-form-unit" class="form-select">
                    ${['pack', 'kg', 'gram', 'litre', 'bottle', 'box', 'piece', 'bag', 'tube', 'pouch', 'bar', 'tin', 'jar'].map(u => `
                      <option value="${u}" ${isEdit && product.unit === u ? 'selected' : ''}>${u}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">GST Slab (%)</label>
                  <select id="prod-form-gst" class="form-select">
                    ${[0, 5, 12, 18].map(r => `
                      <option value="${r}" ${currentGst === r ? 'selected' : ''}>${r}% GST</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Barcode / EAN-13 / SKU</label>
                <div class="barcode-input-group">
                  <input type="text" id="prod-form-barcode" class="form-input" style="font-family: var(--font-mono);" placeholder="8901234567890" value="${isEdit ? DB.escapeHtml(product.barcode || '') : DB.escapeHtml(prefilledBarcode || '')}" />
                  <button type="button" class="btn btn-secondary btn-sm" onclick="Inventory.generateSku()" title="Generate Random Barcode">
                    Generate
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="BarcodeScanner.openScannerModal(code => { document.getElementById('prod-form-barcode').value = code; Inventory.fetchBarcodeFromGoogle(); })" title="Scan with camera">
                    ${Icons.camera(14)}
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" onclick="Inventory.fetchBarcodeFromGoogle()" title="Auto-fill details">
                    Auto-Fill
                  </button>
                </div>
              </div>

              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">MRP (₹)</label>
                  <input type="number" step="0.01" min="0" id="prod-form-mrp" class="form-input" placeholder="100" value="${isEdit ? product.mrp : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" min="0.01" id="prod-form-price" class="form-input" required placeholder="90" value="${isEdit ? product.price : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Cost Price (₹)</label>
                  <input type="number" step="0.01" min="0" id="prod-form-cost" class="form-input" placeholder="75" value="${isEdit ? product.cost : ''}" />
                </div>
              </div>

              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">Stock Qty (Decimal OK) *</label>
                  <input type="number" step="any" min="0" id="prod-form-stock" class="form-input" required placeholder="50" value="${isEdit ? DB.roundQty(product.stock) : '20'}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Min Stock Alert</label>
                  <input type="number" step="any" min="0" id="prod-form-minstock" class="form-input" placeholder="5" value="${isEdit ? DB.roundQty(product.minStock) : '5'}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Expiry Date (Optional)</label>
                  <input type="date" id="prod-form-expiry" class="form-input" value="${isEdit && product.expiryDate ? DB.escapeHtml(product.expiryDate) : ''}" />
                </div>
              </div>

              <div class="modal-footer" style="padding: 14px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="Inventory.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  ${Icons.check(14)} ${isEdit ? 'Update Product' : 'Save to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveProductForm(editId = '') {
    if (this.isCashier()) {
      App.requireOwner('save products');
      return;
    }
    const name = document.getElementById('prod-form-name').value.trim();
    const cat = document.getElementById('prod-form-cat').value;
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const unit = document.getElementById('prod-form-unit').value;
    const gstRate = parseInt(document.getElementById('prod-form-gst').value, 10);
    const mrp = DB.round2(parseFloat(document.getElementById('prod-form-mrp').value) || 0);
    const price = DB.round2(parseFloat(document.getElementById('prod-form-price').value) || 0);
    const cost = DB.round2(parseFloat(document.getElementById('prod-form-cost').value) || (price * 0.8));
    const stock = Math.max(0, DB.roundQty(parseFloat(document.getElementById('prod-form-stock').value) || 0));
    const minStock = Math.max(0, DB.roundQty(parseFloat(document.getElementById('prod-form-minstock').value) || 0));
    const expiryDate = (document.getElementById('prod-form-expiry')?.value || '').trim();

    if (!name || price <= 0) {
      App.toast('danger', 'Validation Error', 'Product name and valid selling price are required');
      return;
    }

    const db = DB.getData();
    const validGst = [0, 5, 12, 18].includes(gstRate) ? gstRate : 5;

    if (editId) {
      const prod = db.products.find(p => p.id === editId);
      if (prod) {
        prod.name = name;
        prod.cat = cat;
        prod.barcode = barcode;
        prod.unit = unit;
        prod.gstRate = validGst;
        prod.mrp = mrp || price;
        prod.price = price;
        prod.cost = cost;
        prod.stock = stock;
        prod.minStock = minStock;
        prod.expiryDate = expiryDate;
        DB.saveData(db);
        App.toast('success', 'Updated', `${name} updated successfully`);
      }
    } else {
      const newProd = {
        id: DB.uid('P'),
        name,
        cat,
        barcode,
        unit,
        gstRate: validGst,
        mrp: mrp || price,
        price,
        cost,
        stock,
        minStock,
        expiryDate
      };
      db.products.unshift(newProd);
      DB.saveData(db);
      App.toast('success', 'Added', `${name} added to catalog`);
    }

    this.closeModal();
    this.render();
    if (App.currentView === 'dashboard') {
      const container = document.getElementById('main-view-container');
      if (container) App.renderDashboardView(container);
    }
    if (window.POS) POS.renderCatalog();
    App.updateNotificationBadge();
  }

  // =========================================================================
  // BULK CSV / EXCEL PRODUCT IMPORT (Supports 500+ Rows + Upsert by Barcode/Name)
  // =========================================================================
  downloadSampleCSV() {
    const sample = [
      'name,cat,barcode,mrp,price,cost,stock,unit,minStock,gstRate,expiryDate',
      '"Loose Toor Dal Premium",Grocery,8901030990011,195,175,148,42.5,kg,10,0,',
      '"Amul Kool Kesar 180ml",Dairy,8901262990022,30,28,22,48,bottle,12,12,' + DB.getOffsetDateStr(6),
      '"Dettol Handwash Refill 750ml",Household,8901396990033,199,185,152,18,pouch,5,18,' + DB.getOffsetDateStr(180)
    ].join('\n');
    DB.downloadFile(sample, 'mydukkan24_sample_products.csv', 'text/csv');
    App.toast('info', 'Sample Template Downloaded', 'Open in Excel or Google Sheets and save as CSV.');
  }

  openBulkImportModal() {
    if (this.isCashier()) {
      App.requireOwner('bulk import products');
      return;
    }
    this._bulkParsedRows = [];
    this.closeBulkImportModal();

    const modalHtml = `
      <div class="modal-backdrop" id="bulk-import-modal" onclick="if(event.target===this) Inventory.closeBulkImportModal()">
        <div class="modal-card" style="max-width: 680px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.upload(16)} Bulk Excel / CSV Product Import (500+ SKUs)</div>
            <button class="topbar-icon-btn" onclick="Inventory.closeBulkImportModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 12px; color: var(--text-secondary);">
                <strong style="color: var(--text-primary);">Columns:</strong> name, cat, barcode, mrp, price, cost, stock, unit, minStock, gstRate, expiryDate
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Inventory.downloadSampleCSV()">
                ${Icons.download(13)} Sample CSV
              </button>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <label class="btn btn-primary btn-sm" style="cursor: pointer; margin: 0;">
                ${Icons.upload(13)} Choose CSV File
                <input type="file" accept=".csv,.txt" style="display: none;" onchange="Inventory.handleBulkFile(event)" />
              </label>
              <span style="font-size: 11.5px; color: var(--text-muted);">or paste CSV / Excel rows directly below:</span>
            </div>

            <textarea id="bulk-csv-textarea" class="form-textarea" rows="5" style="font-family: var(--font-mono); font-size: 11.5px;" placeholder="name,cat,barcode,mrp,price,cost,stock,unit,minStock,gstRate,expiryDate&#10;Sugar Loose,Grocery,,52,46,40,35.5,kg,10,5,"></textarea>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="Inventory.previewBulkCSV(document.getElementById('bulk-csv-textarea').value)">
                Preview & Validate Rows
              </button>
            </div>

            <div id="bulk-import-preview-area"></div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  handleBulkFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target.result || '');
      const ta = document.getElementById('bulk-csv-textarea');
      if (ta) ta.value = text;
      this.previewBulkCSV(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  parseCSVRaw(text) {
    const clean = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!clean) return [];

    // Auto-detect tab-separated Excel clipboard paste vs CSV
    const firstLine = clean.split(/\r?\n/)[0] || '';
    const delimiter = (firstLine.split('\t').length > firstLine.split(',').length) ? '\t' : ',';

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      const next = clean[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && ch === delimiter) {
        row.push(field.trim());
        field = '';
      } else if (!inQuotes && (ch === '\r' || ch === '\n')) {
        if (ch === '\r' && next === '\n') i++;
        row.push(field.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
    }
    return rows;
  }

  previewBulkCSV(rawText) {
    const previewEl = document.getElementById('bulk-import-preview-area');
    if (!previewEl) return;

    const matrix = this.parseCSVRaw(rawText);
    if (matrix.length < 2) {
      previewEl.innerHTML = `<div style="color: var(--danger); font-size: 12px;">Need a header row and at least 1 product row.</div>`;
      return;
    }

    const headers = matrix[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findCol = (aliases) => headers.findIndex(h => aliases.includes(h));

    const idxName = findCol(['name', 'productname', 'itemname', 'product', 'item']);
    const idxCat = findCol(['cat', 'category']);
    const idxBarcode = findCol(['barcode', 'ean', 'sku', 'code']);
    const idxMrp = findCol(['mrp']);
    const idxPrice = findCol(['price', 'sellingprice', 'rate', 'sp']);
    const idxCost = findCol(['cost', 'costprice', 'wholesale', 'cp']);
    const idxStock = findCol(['stock', 'qty', 'quantity']);
    const idxUnit = findCol(['unit', 'uom']);
    const idxMin = findCol(['minstock', 'min', 'alert']);
    const idxGst = findCol(['gstrate', 'gst', 'tax', 'taxrate']);
    const idxExp = findCol(['expirydate', 'expiry', 'exp']);

    if (idxName === -1 || idxPrice === -1) {
      previewEl.innerHTML = `<div style="color: var(--danger); font-size: 12px;">CSV must include at least <strong>name</strong> and <strong>price</strong> columns.</div>`;
      return;
    }

    const db = DB.getData();
    const existingProds = db.products || [];
    const parsed = [];
    const errors = [];

    for (let r = 1; r < matrix.length; r++) {
      const cells = matrix[r];
      const name = String(cells[idxName] || '').trim();
      const price = DB.round2(parseFloat(cells[idxPrice]));
      if (!name || !Number.isFinite(price) || price <= 0) {
        errors.push(`Row ${r + 1}: Missing valid name or selling price`);
        continue;
      }

      const cat = (idxCat >= 0 && cells[idxCat]) ? cells[idxCat].trim() : 'Grocery';
      const barcode = (idxBarcode >= 0 && cells[idxBarcode]) ? cells[idxBarcode].trim() : '';
      const mrpRaw = idxMrp >= 0 ? parseFloat(cells[idxMrp]) : price;
      const mrp = Number.isFinite(mrpRaw) && mrpRaw > 0 ? DB.round2(mrpRaw) : price;
      const costRaw = idxCost >= 0 ? parseFloat(cells[idxCost]) : price * 0.82;
      const cost = Number.isFinite(costRaw) && costRaw >= 0 ? DB.round2(costRaw) : DB.round2(price * 0.82);
      const stockRaw = idxStock >= 0 ? parseFloat(cells[idxStock]) : 10;
      const stock = Number.isFinite(stockRaw) && stockRaw >= 0 ? DB.roundQty(stockRaw) : 10;
      const unit = (idxUnit >= 0 && cells[idxUnit]) ? cells[idxUnit].trim() : 'pack';
      const minRaw = idxMin >= 0 ? parseFloat(cells[idxMin]) : 5;
      const minStock = Number.isFinite(minRaw) && minRaw >= 0 ? DB.roundQty(minRaw) : 5;
      const gstRaw = idxGst >= 0 ? parseInt(cells[idxGst], 10) : DB.inferDefaultGstRate(cat, name);
      const gstRate = [0, 5, 12, 18].includes(gstRaw) ? gstRaw : DB.inferDefaultGstRate(cat, name);
      const expRaw = (idxExp >= 0 && cells[idxExp]) ? cells[idxExp].trim() : '';
      const expiryDate = /^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw : '';

      const match = existingProds.find(p =>
        (barcode && p.barcode && p.barcode === barcode) ||
        p.name.toLowerCase() === name.toLowerCase()
      );

      parsed.push({
        mode: match ? 'Update' : 'New',
        existingId: match ? match.id : null,
        name, cat, barcode, mrp, price, cost, stock, unit, minStock, gstRate, expiryDate
      });
    }

    this._bulkParsedRows = parsed;

    previewEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
        <div style="font-size: 12.5px; font-weight: 700; color: var(--success);">
          Ready: ${parsed.length} valid product(s) (${parsed.filter(x => x.mode === 'New').length} new, ${parsed.filter(x => x.mode === 'Update').length} updates)
        </div>
        ${errors.length ? `<span class="badge badge-danger">${errors.length} skipped</span>` : ''}
      </div>
      ${parsed.length ? `
        <div class="table-container" style="max-height: 200px; overflow-y: auto; margin-bottom: 10px;">
          <table class="data-table" style="font-size: 11.5px;">
            <thead>
              <tr><th>Action</th><th>Name</th><th>Rate</th><th>Stock</th><th>GST</th></tr>
            </thead>
            <tbody>
              ${parsed.slice(0, 50).map(it => `
                <tr>
                  <td><span class="badge ${it.mode === 'New' ? 'badge-primary' : 'badge-warning'}">${it.mode}</span></td>
                  <td>${DB.escapeHtml(it.name)}</td>
                  <td class="tnum">₹${it.price}</td>
                  <td class="tnum">${it.stock} ${DB.escapeHtml(it.unit)}</td>
                  <td>${it.gstRate}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${parsed.length > 50 ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Showing first 50 rows of ${parsed.length}. All ${parsed.length} will import.</div>` : ''}
        <button type="button" class="btn btn-success w100" onclick="Inventory.commitBulkImport()">
          ${Icons.check(15)} Import All ${parsed.length} Products into Catalog
        </button>
      ` : ''}
    `;
  }

  commitBulkImport() {
    if (!this._bulkParsedRows.length) return;
    const db = DB.getData();
    if (!Array.isArray(db.products)) db.products = [];

    let added = 0;
    let updated = 0;

    this._bulkParsedRows.forEach(row => {
      if (row.existingId) {
        const existing = db.products.find(p => p.id === row.existingId);
        if (existing) {
          existing.name = row.name;
          existing.cat = row.cat;
          existing.barcode = row.barcode || existing.barcode || '';
          existing.mrp = row.mrp;
          existing.price = row.price;
          existing.cost = row.cost;
          existing.stock = row.stock;
          existing.unit = row.unit;
          existing.minStock = row.minStock;
          existing.gstRate = row.gstRate;
          if (row.expiryDate) existing.expiryDate = row.expiryDate;
          updated++;
          return;
        }
      }
      db.products.unshift({
        id: DB.uid('P'),
        name: row.name,
        cat: row.cat,
        barcode: row.barcode,
        mrp: row.mrp,
        price: row.price,
        cost: row.cost,
        stock: row.stock,
        unit: row.unit,
        minStock: row.minStock,
        gstRate: row.gstRate,
        expiryDate: row.expiryDate
      });
      added++;
    });

    DB.saveData(db);
    this.closeBulkImportModal();
    this.render();
    if (window.POS) POS.renderCatalog();
    App.updateNotificationBadge();
    App.toast('success', 'Bulk Import Complete', `Added ${added} new SKUs & updated ${updated} existing SKUs.`);
  }

  closeBulkImportModal() {
    const m = document.getElementById('bulk-import-modal');
    if (m) m.remove();
  }

  // =========================================================================
  // SMART AUTO-RESTOCK & 30-DAY DEMAND PREDICTOR
  // =========================================================================
  computeRestockPredictions() {
    const db = DB.getData();
    const products = db.products || [];
    const invoices = db.invoices || [];
    const cutoff30 = DB.getOffsetDateStr(-30);

    // Count net units sold in last 30 days (deducting returns)
    const soldMap = {};
    invoices.forEach(inv => {
      if ((inv.date || '') < cutoff30) return;
      const returnedQtyMap = {};
      (inv.returnedItems || []).forEach(r => {
        returnedQtyMap[r.id] = (returnedQtyMap[r.id] || 0) + (Number(r.qty) || 0);
      });
      (inv.items || []).forEach(it => {
        const netQty = Math.max(0, DB.roundQty((Number(it.qty) || 0) - (returnedQtyMap[it.id] || 0)));
        soldMap[it.id] = DB.roundQty((soldMap[it.id] || 0) + netQty);
      });
    });

    return products.map(p => {
      const sold30d = soldMap[p.id] || 0;
      const dailyVelocity = DB.roundQty(sold30d / 30);
      const stock = DB.roundQty(p.stock || 0);
      const minStock = DB.roundQty(p.minStock || 5);
      const daysLeft = dailyVelocity > 0 ? Math.round((stock / dailyVelocity) * 10) / 10 : (stock <= minStock ? 0 : 999);

      // Recommended order for 14-day sales runway or 2x minStock buffer
      const targetBuffer = Math.max(minStock * 2, Math.ceil(dailyVelocity * 14));
      const suggestedOrderQty = stock <= minStock || daysLeft <= 7
        ? Math.max(1, Math.ceil(targetBuffer - stock))
        : 0;

      const urgency = stock <= 0 ? 3 : (daysLeft <= 4 || stock <= minStock) ? 2 : (daysLeft <= 10 ? 1 : 0);

      return {
        id: p.id,
        name: p.name,
        cat: p.cat || 'General',
        unit: p.unit || 'pack',
        cost: Number(p.cost) || Math.round((Number(p.price) || 0) * 0.8),
        stock,
        minStock,
        sold30d,
        dailyVelocity,
        daysLeft,
        suggestedOrderQty,
        urgency
      };
    }).sort((a, b) => b.urgency - a.urgency || a.daysLeft - b.daysLeft || b.sold30d - a.sold30d);
  }

  openRestockPredictorModal() {
    if (this.isCashier()) {
      App.requireOwner('access smart restock & cost forecasts');
      return;
    }
    this.closeRestockPredictorModal();
    const list = this.computeRestockPredictions();
    this._restockPredictions = list;
    const urgent = list.filter(x => x.suggestedOrderQty > 0);
    const estCost = urgent.reduce((s, x) => s + (x.suggestedOrderQty * x.cost), 0);
    const isOnline = navigator.onLine !== false;

    const modalHtml = `
      <div class="modal-backdrop" id="restock-predictor-modal" onclick="if(event.target===this) Inventory.closeRestockPredictorModal()">
        <div class="modal-card" style="max-width: 720px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.chart(16)} Smart Auto-Restock & Demand Predictor (30-Day Velocity)</div>
            <button class="topbar-icon-btn" onclick="Inventory.closeRestockPredictorModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: var(--text-primary);">${urgent.length} SKU(s) Need Immediate Reordering</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Est. Wholesale Reorder Budget: <strong class="tnum" style="color: var(--primary);">₹${Math.round(estCost).toLocaleString('en-IN')}</strong></div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="Inventory.runAiDemandAdvisor()">
                  ${Icons.sparkles(13)} ${isOnline ? 'Ask Gemini Demand Forecast' : 'Offline Restock Brief'}
                </button>
                ${urgent.length ? `
                  <button type="button" class="btn btn-primary btn-sm" onclick="Inventory.createPurchaseDraftFromPredictions()">
                    ${Icons.plus(13)} Send ${urgent.length} to Purchase Bill
                  </button>
                ` : ''}
              </div>
            </div>

            <div id="restock-ai-brief"></div>

            <div class="table-container" style="max-height: 310px; overflow-y: auto;">
              <table class="data-table" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>30d Sold</th>
                    <th>Runway</th>
                    <th>Reorder Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.map(it => `
                    <tr>
                      <td>
                        <div style="font-weight: 700;">${DB.escapeHtml(it.name)}</div>
                        <div style="font-size: 10.5px; color: var(--text-muted);">${it.dailyVelocity}/day velocity</div>
                      </td>
                      <td class="tnum">${it.stock} ${DB.escapeHtml(it.unit)}</td>
                      <td class="tnum">${it.sold30d}</td>
                      <td>
                        <span class="badge ${it.urgency >= 2 ? 'badge-danger' : it.urgency === 1 ? 'badge-warning' : 'badge-success'}">
                          ${it.daysLeft >= 900 ? 'Safe' : it.daysLeft === 0 ? 'Stockout!' : `${it.daysLeft}d left`}
                        </span>
                      </td>
                      <td style="font-weight: 700; color: ${it.suggestedOrderQty > 0 ? 'var(--primary)' : 'var(--text-muted)'};" class="tnum">
                        ${it.suggestedOrderQty > 0 ? `+${it.suggestedOrderQty} ${DB.escapeHtml(it.unit)}` : '—'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async runAiDemandAdvisor() {
    const briefEl = document.getElementById('restock-ai-brief');
    if (!briefEl) return;
    const summaryList = this._restockPredictions.slice(0, 12);

    if (navigator.onLine === false) {
      const topUrgent = summaryList.filter(x => x.suggestedOrderQty > 0).slice(0, 3);
      briefEl.innerHTML = `
        <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; color: var(--text-primary); line-height: 1.5;">
          <strong>🟠 Offline Reorder Advisor:</strong> ${topUrgent.length
            ? topUrgent.map(u => `${DB.escapeHtml(u.name)} (~${u.daysLeft}d left → Order ${u.suggestedOrderQty} ${DB.escapeHtml(u.unit)})`).join(' • ')
            : 'Sabhi key SKUs healthy stock mein hain.'}
        </div>
      `;
      return;
    }

    briefEl.innerHTML = `<div style="font-size: 12px; color: var(--primary);">⚡ Analyzing 30-day sales speed via Gemini 3.8 Flash...</div>`;
    const db = DB.getData();
    const res = window.DukaanAI && typeof DukaanAI.predictRestockOnline === 'function'
      ? await DukaanAI.predictRestockOnline(db.shop?.name || 'MyDukkan24 Mart', summaryList)
      : { ok: false, error: 'AI service unavailable' };

    if (res && res.ok) {
      briefEl.innerHTML = `
        <div style="background: var(--primary-light); border: 1px solid var(--border-focus); padding: 12px; border-radius: var(--radius-md); font-size: 12.5px; color: var(--text-primary); line-height: 1.55;">
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">🟢 Gemini 3.8 Demand Forecast</div>
          ${DB.escapeHtml(res.text).replace(/\n/g, '<br>')}
        </div>
      `;
    } else {
      briefEl.innerHTML = `
        <div style="background: var(--danger-light); border: 1px solid var(--danger-border); padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; color: var(--danger);">
          Live Gemini Forecast Error: ${DB.escapeHtml((res && res.error) || 'Failed')}
        </div>
      `;
    }
  }

  createPurchaseDraftFromPredictions() {
    const urgent = this._restockPredictions.filter(x => x.suggestedOrderQty > 0);
    if (!urgent.length) return;
    this.closeRestockPredictorModal();
    if (window.App && window.Purchases) {
      App.navigate('purchases');
      setTimeout(() => {
        Purchases.openInwardBillModal(urgent.map(u => ({
          id: u.id,
          name: u.name,
          cost: u.cost,
          qty: u.suggestedOrderQty,
          gstRate: 5,
          expiryDate: '',
          total: DB.round2(u.cost * u.suggestedOrderQty)
        })));
      }, 60);
    }
  }

  closeRestockPredictorModal() {
    const m = document.getElementById('restock-predictor-modal');
    if (m) m.remove();
  }

  // Strict Online vs. Offline Barcode Resolver
  async fetchBarcodeFromGoogle() {
    const barcode = document.getElementById('prod-form-barcode')?.value?.trim();
    if (!barcode) {
      App.toast('warning', 'Barcode Required', 'Enter or scan a barcode first');
      return;
    }

    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    App.toast(
      'info',
      isOnline ? 'Live Online Lookup...' : 'Offline Lookup...',
      isOnline ? `Querying live APIs for ${barcode}` : `Checking local catalog for ${barcode}`
    );

    let matched = null;
    let sourceLabel = '';
    let apiErrorMsg = '';

    const applyFields = (item, label, modeTag) => {
      const nameEl = document.getElementById('prod-form-name');
      const mrpEl = document.getElementById('prod-form-mrp');
      const priceEl = document.getElementById('prod-form-price');
      const costEl = document.getElementById('prod-form-cost');
      const catEl = document.getElementById('prod-form-cat');
      const gstEl = document.getElementById('prod-form-gst');

      if (nameEl) nameEl.value = item.name || '';
      if (mrpEl) mrpEl.value = item.mrp || '';
      if (priceEl) priceEl.value = item.price || '';
      if (costEl) costEl.value = item.cost || '';
      if (catEl && item.cat) catEl.value = item.cat;
      if (gstEl && [0, 5, 12, 18].includes(Number(item.gstRate))) {
        gstEl.value = String(item.gstRate);
      }

      App.toast('success', `${modeTag} Auto-Filled`, `${item.name} (${label})`);
    };

    if (isOnline) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);
        const offRes = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,quantity`,
          { signal: controller.signal }
        );
        clearTimeout(tid);
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData && offData.status === 1 && offData.product && offData.product.product_name) {
            const p = offData.product;
            const cat = window.BarcodeScanner ? BarcodeScanner.normalizeCategory(p.categories || 'Grocery') : 'Grocery';
            matched = {
              name: `${p.product_name} ${p.quantity || ''}`.trim(),
              brand: p.brands || 'Packaged Brand',
              cat,
              gstRate: DB.inferDefaultGstRate(cat, p.product_name),
              mrp: 35,
              price: 30,
              cost: 25
            };
            sourceLabel = 'Open Food Facts';
          }
        }
      } catch (e) {}

      if (!matched && window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
        const res = await DukaanAI.lookupBarcodeOnline(barcode);
        if (res && res.ok && res.found && res.product && res.product.name) {
          const prodObj = res.product;
          matched = {
            name: prodObj.name,
            brand: prodObj.brand || '',
            cat: prodObj.cat || 'Grocery',
            gstRate: [0, 5, 12, 18].includes(Number(prodObj.gstRate)) ? Number(prodObj.gstRate) : DB.inferDefaultGstRate(prodObj.cat, prodObj.name),
            mrp: Number(prodObj.mrp) || 30,
            price: Number(prodObj.price) || 28,
            cost: Number(prodObj.cost) || 24
          };
          sourceLabel = `Gemini ${res.model || 'API'}`;
        } else if (res && !res.ok && !res.offline) {
          apiErrorMsg = res.error || `HTTP ${res.status || 'Error'}`;
        }
      }

      if (matched) {
        try {
          const cache = JSON.parse(localStorage.getItem('mydukaan24_barcode_cache') || '{}');
          cache[barcode] = { ...matched, barcode };
          localStorage.setItem('mydukaan24_barcode_cache', JSON.stringify(cache));
        } catch (e) {}
        applyFields(matched, sourceLabel, '🟢 Online');
        return;
      }

      const localHint = window.BarcodeScanner && typeof BarcodeScanner.getLocalOfflineHint === 'function'
        ? BarcodeScanner.getLocalOfflineHint(barcode)
        : null;

      if (apiErrorMsg) {
        App.toast('danger', 'Live Barcode API Error', apiErrorMsg);
      } else {
        App.toast('warning', 'Not Found Online', 'Live APIs had no match. Enter product details manually.');
      }

      if (localHint && localHint.item) {
        const useHint = confirm(
          `${apiErrorMsg ? 'Live Gemini API failed: ' + apiErrorMsg : 'Live online databases had no exact match for ' + barcode}.\n\n` +
          `Apply local catalog hint "${localHint.item.name}" instead?`
        );
        if (useHint) {
          applyFields(localHint.item, localHint.sourceLabel, '📦 Local Hint');
        }
      }
      return;
    }

    const offlineHit = window.BarcodeScanner && typeof BarcodeScanner.getLocalOfflineHint === 'function'
      ? BarcodeScanner.getLocalOfflineHint(barcode)
      : null;

    if (offlineHit && offlineHit.item) {
      applyFields(offlineHit.item, offlineHit.sourceLabel, '🟠 Offline');
    } else {
      App.toast('warning', 'Offline: Unknown Barcode', 'Enter product details manually below.');
    }
  }

  closeModal() {
    const modal = document.getElementById('product-form-modal');
    if (modal) modal.remove();
  }
}

window.Inventory = new InventoryEngine();
