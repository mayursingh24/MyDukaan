/**
 * MyDukkan24 — Inventory Catalog, Stock Valuation & Product Management Engine
 * Clean, accurate, high-utility retail stock operations.
 */

class InventoryEngine {
  constructor() {
    this.searchQuery = "";
    this.filterCategory = "All";
    this.filterStock = "All"; // 'All', 'Low', 'OutOfStock'
  }

  setSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.render();
  }

  render() {
    const container = document.getElementById('inventory-table-tbody');
    const statsContainer = document.getElementById('inventory-kpi-row');
    if (!container) return;

    const db = DB.getData();
    let products = db.products || [];

    // KPI Counters
    const totalItems = products.length;
    const totalStockQty = products.reduce((s, p) => s + p.stock, 0);
    const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    const outOfStockItems = products.filter(p => p.stock <= 0);
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

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Low Stock Alerts</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">
              ${Icons.alert(16)}
            </div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">${lowStockItems.length}</div>
          <div class="kpi-trend" style="color: var(--warning);">Items below threshold</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Out of Stock</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.close(16)}
            </div>
          </div>
          <div class="kpi-val" style="color: var(--danger);">${outOfStockItems.length}</div>
          <div class="kpi-trend" style="color: var(--danger);">0 units available</div>
        </div>
      `;
    }

    // Filter Logic
    if (this.filterCategory !== 'All') {
      products = products.filter(p => p.cat === this.filterCategory);
    }
    if (this.filterStock === 'Low') {
      products = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    } else if (this.filterStock === 'OutOfStock') {
      products = products.filter(p => p.stock <= 0);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.includes(q)) ||
        (p.cat && p.cat.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
      );
    }

    if (!products.length) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
            <div>${Icons.search(32)}</div>
            <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">No matching inventory items found</div>
            <p style="font-size: 12px; margin-top: 4px;">Adjust your search keyword or active category filter.</p>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = products.map(p => {
      const isOut = p.stock <= 0;
      const isLow = p.stock > 0 && p.stock <= p.minStock;
      const margin = p.price > p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
      const profitUnit = Math.max(0, p.price - p.cost);

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${p.name}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
              SKU: ${p.id} • ${p.unit || 'unit'}
            </div>
          </td>
          <td><span class="badge badge-muted">${p.cat || 'General'}</span></td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${p.price}</div>
            ${p.mrp > p.price ? `<div style="font-size: 11px; color: var(--text-muted); text-decoration: line-through;" class="tnum">MRP ₹${p.mrp}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 12.5px; color: var(--text-secondary);" class="tnum">₹${p.cost}</div>
            <div style="font-size: 10.5px; color: var(--success); font-weight: 600;">
              ${margin}% (₹${profitUnit}/u)
            </div>
          </td>
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
              ${isOut ? 'Out of Stock' : `${p.stock} in stock`}
            </span>
            ${isLow ? `<div style="font-size: 10px; color: var(--warning); margin-top: 3px;">Min alert: ${p.minStock}</div>` : ''}
          </td>
          <td>
            <code style="font-family: var(--font-mono); font-size: 11px; background: var(--bg-input); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle);">
              ${p.barcode || 'N/A'}
            </code>
          </td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="Inventory.quickRestock('${p.id}')" title="Add Stock">
                + Stock
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Inventory.openEditProductModal('${p.id}')" title="Edit Product">
                ${Icons.edit(14)}
              </button>
              <button class="btn btn-danger btn-sm" onclick="Inventory.deleteProduct('${p.id}')" title="Delete Product">
                ${Icons.trash(14)}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Quick Restock Function
  quickRestock(id) {
    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (!prod) return;

    const qtyStr = prompt(`Enter quantity to add to "${prod.name}" (Current: ${prod.stock} ${prod.unit}):`, "10");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;

    prod.stock += qty;
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
    const isEdit = !!product;

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
            <form onsubmit="event.preventDefault(); Inventory.saveProductForm('${isEdit ? product.id : ''}');">
              <div class="form-group">
                <label class="form-label">Product Name *</label>
                <input type="text" id="prod-form-name" class="form-input" required placeholder="e.g. Fortune Sunflower Oil 1L" value="${isEdit ? product.name : ''}" />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="prod-form-cat" class="form-select">
                    ${['Grocery', 'Dairy', 'Snacks', 'Beverages', 'Oils', 'Household', 'Personal Care', 'Healthcare', 'General'].map(c => `
                      <option value="${c}" ${isEdit && product.cat === c ? 'selected' : ''}>${c}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit Type</label>
                  <select id="prod-form-unit" class="form-select">
                    ${['pack', 'kg', 'gram', 'litre', 'bottle', 'box', 'piece', 'bag', 'tube', 'pouch'].map(u => `
                      <option value="${u}" ${isEdit && product.unit === u ? 'selected' : ''}>${u}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Barcode / EAN-13 / SKU</label>
                <div class="barcode-input-group">
                  <input type="text" id="prod-form-barcode" class="form-input" style="font-family: var(--font-mono);" placeholder="8901234567890" value="${isEdit ? product.barcode : (prefilledBarcode || '')}" />
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
                  <input type="number" step="0.01" id="prod-form-mrp" class="form-input" placeholder="100" value="${isEdit ? product.mrp : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" id="prod-form-price" class="form-input" required placeholder="90" value="${isEdit ? product.price : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Cost Price (₹)</label>
                  <input type="number" step="0.01" id="prod-form-cost" class="form-input" placeholder="75" value="${isEdit ? product.cost : ''}" />
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Stock Quantity *</label>
                  <input type="number" id="prod-form-stock" class="form-input" required placeholder="50" value="${isEdit ? product.stock : '20'}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Min Stock Alert Level</label>
                  <input type="number" id="prod-form-minstock" class="form-input" placeholder="5" value="${isEdit ? product.minStock : '5'}" />
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
    const name = document.getElementById('prod-form-name').value.trim();
    const cat = document.getElementById('prod-form-cat').value;
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const unit = document.getElementById('prod-form-unit').value;
    const mrp = parseFloat(document.getElementById('prod-form-mrp').value) || 0;
    const price = parseFloat(document.getElementById('prod-form-price').value) || 0;
    const cost = parseFloat(document.getElementById('prod-form-cost').value) || (price * 0.8);
    const stock = parseInt(document.getElementById('prod-form-stock').value, 10) || 0;
    const minStock = parseInt(document.getElementById('prod-form-minstock').value, 10) || 5;

    if (!name || price <= 0) {
      App.toast('danger', 'Validation Error', 'Product name and valid selling price are required');
      return;
    }

    const db = DB.getData();

    if (editId) {
      const prod = db.products.find(p => p.id === editId);
      if (prod) {
        prod.name = name;
        prod.cat = cat;
        prod.barcode = barcode;
        prod.unit = unit;
        prod.mrp = mrp || price;
        prod.price = price;
        prod.cost = cost;
        prod.stock = stock;
        prod.minStock = minStock;
        DB.saveData(db);
        App.toast('success', 'Updated', `${name} updated successfully`);
      }
    } else {
      const newId = `P${(db.products.length + 101).toString()}`;
      const newProd = {
        id: newId,
        name,
        cat,
        barcode,
        unit,
        mrp: mrp || price,
        price,
        cost,
        stock,
        minStock
      };
      db.products.push(newProd);
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

      if (nameEl) nameEl.value = item.name || '';
      if (mrpEl) mrpEl.value = item.mrp || '';
      if (priceEl) priceEl.value = item.price || '';
      if (costEl) costEl.value = item.cost || '';
      if (catEl && item.cat) catEl.value = item.cat;

      App.toast('success', `${modeTag} Auto-Filled`, `${item.name} (${label})`);
    };

    if (isOnline) {
      // STRICT ONLINE PATH: Query Open Food Facts & Live Gemini Interactions API
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
            matched = {
              name: `${p.product_name} ${p.quantity || ''}`.trim(),
              brand: p.brands || 'Packaged Brand',
              cat: window.BarcodeScanner ? BarcodeScanner.normalizeCategory(p.categories || 'Grocery') : 'Grocery',
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

      // Online lookup missed or failed — check if user wants optional local hint without silent mixing
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

    // STRICT OFFLINE PATH: Query Local Master DB / Cache / GS1 Prefix
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
