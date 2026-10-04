/**
 * MyDukaan Pro — Inventory Catalog & Stock Engine
 * Created & Deployed by Mayur Singh
 */

class InventoryEngine {
  constructor() {
    this.searchQuery = "";
    this.filterCategory = "All";
    this.filterStock = "All"; // 'All', 'Low', 'OutOfStock'
  }

  render() {
    const container = document.getElementById('inventory-table-tbody');
    const statsContainer = document.getElementById('inventory-kpi-row');
    if (!container) return;

    const db = DB.getData();
    let products = db.products;

    // KPI Counters
    const totalItems = products.length;
    const totalStockQty = products.reduce((s, p) => s + p.stock, 0);
    const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    const outOfStockItems = products.filter(p => p.stock <= 0);
    const stockValuation = products.reduce((s, p) => s + (p.cost * p.stock), 0);

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Products</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">📦</div>
          </div>
          <div class="kpi-val">${totalItems}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${totalStockQty} total units</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Stock Value</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">💰</div>
          </div>
          <div class="kpi-val">₹${stockValuation.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">Cost Valuation</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Low Stock Alert</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">⚠️</div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">${lowStockItems.length}</div>
          <div class="kpi-trend" style="color: var(--warning);">Needs restock</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Out of Stock</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">❌</div>
          </div>
          <div class="kpi-val" style="color: var(--danger);">${outOfStockItems.length}</div>
          <div class="kpi-trend" style="color: var(--danger);">0 Available</div>
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
      const q = this.searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.includes(q)) ||
        (p.cat && p.cat.toLowerCase().includes(q))
      );
    }

    if (!products.length) {
      container.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No matching inventory items found
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = products.map((p, idx) => {
      const isOut = p.stock <= 0;
      const isLow = p.stock > 0 && p.stock <= p.minStock;
      const margin = p.price > p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;

      return `
        <tr>
          <td><span style="font-size: 20px;">${p.emoji || '📦'}</span></td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${p.name}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">Barcode: ${p.barcode || 'N/A'}</div>
          </td>
          <td><span class="badge badge-muted">${p.cat || 'General'}</span></td>
          <td>
            <div style="font-size: 12px; color: var(--text-muted); text-decoration: line-through;">MRP ₹${p.mrp}</div>
            <div style="font-weight: 700; color: var(--text-primary);">₹${p.price}</div>
          </td>
          <td>
            <div style="color: var(--text-secondary); font-size: 12.5px;">₹${p.cost}</div>
            <div style="font-size: 10px; color: var(--success); font-weight: 600;">${margin}% margin</div>
          </td>
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
              ${isOut ? 'Out of Stock' : `${p.stock} ${p.unit}`}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="Inventory.quickRestock('${p.id}')" title="Quick Restock">
                ➕ Stock
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Inventory.openEditProductModal('${p.id}')" title="Edit">
                ✏️
              </button>
              <button class="btn btn-danger btn-sm" onclick="Inventory.deleteProduct('${p.id}')" title="Delete">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Quick Restock
  quickRestock(id) {
    const qtyStr = prompt("Enter quantity to add to stock (e.g. 10):", "10");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return;

    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (prod) {
      prod.stock += qty;
      DB.saveData(db);
      App.toast('success', 'Stock Updated', `Added ${qty} ${prod.unit} to ${prod.name}`);
      this.render();
      if (window.POS) POS.renderCatalog();
    }
  }

  deleteProduct(id) {
    const db = DB.getData();
    const prod = db.products.find(p => p.id === id);
    if (!prod) return;

    if (confirm(`Are you sure you want to delete "${prod.name}" from your catalog?`)) {
      DB.deleteItem('products', id);
      App.toast('info', 'Deleted', `${prod.name} removed`);
      this.render();
      if (window.POS) POS.renderCatalog();
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

  openProductModal(product = null, prefilledBarcode = "") {
    const isEdit = !!product;
    const emojis = ["🌾", "🫙", "🧈", "☕", "🍜", "🪥", "🍪", "🧼", "🧴", "🍫", "🍚", "🫘", "🍞", "🥛", "🧃", "🍎", "🥔", "📦"];

    const modalHtml = `
      <div class="modal-backdrop" id="product-form-modal" onclick="if(event.target === this) Inventory.closeModal()">
        <div class="modal-card">
          <div class="modal-header">
            <div style="font-weight: 700; font-size: 16px;">
              ${isEdit ? '✏️ Edit Product' : '➕ Add New Product to Catalog'}
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
                  <label class="form-label">Emoji Icon</label>
                  <select id="prod-form-emoji" class="form-select">
                    ${emojis.map(em => `
                      <option value="${em}" ${isEdit && product.emoji === em ? 'selected' : ''}>${em}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Barcode / EAN-13</label>
                  <div style="display: flex; gap: 6px;">
                    <input type="text" id="prod-form-barcode" class="form-input" style="font-family: var(--font-mono);" placeholder="8901234567890" value="${isEdit ? product.barcode : (prefilledBarcode || '')}" />
                    <button type="button" class="btn btn-secondary btn-sm" onclick="BarcodeScanner.openScannerModal(code => { document.getElementById('prod-form-barcode').value = code; Inventory.fetchBarcodeFromGoogle(); })" title="Scan with camera">📷</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background:linear-gradient(135deg, #4285F4, #34A853);white-space:nowrap;padding:4px 8px;font-size:11px;" onclick="Inventory.fetchBarcodeFromGoogle()" title="Auto-fill details from Google">🌐 Auto-Fill</button>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Unit Type</label>
                  <select id="prod-form-unit" class="form-select">
                    ${['pack', 'kg', 'gram', 'litre', 'bottle', 'box', 'piece', 'bag', 'tube'].map(u => `
                      <option value="${u}" ${isEdit && product.unit === u ? 'selected' : ''}>${u}</option>
                    `).join('')}
                  </select>
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
                  <label class="form-label">Low Stock Alert Level</label>
                  <input type="number" id="prod-form-minstock" class="form-input" placeholder="5" value="${isEdit ? product.minStock : '5'}" />
                </div>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">
                  ${isEdit ? '✓ Update Product' : '➕ Save to Inventory'}
                </button>
                <button type="button" class="btn btn-secondary" onclick="Inventory.closeModal()">
                  Cancel
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
    const emoji = document.getElementById('prod-form-emoji').value;
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const unit = document.getElementById('prod-form-unit').value;
    const mrp = parseFloat(document.getElementById('prod-form-mrp').value) || 0;
    const price = parseFloat(document.getElementById('prod-form-price').value) || 0;
    const cost = parseFloat(document.getElementById('prod-form-cost').value) || (price * 0.8);
    const stock = parseInt(document.getElementById('prod-form-stock').value, 10) || 0;
    const minStock = parseInt(document.getElementById('prod-form-minstock').value, 10) || 5;

    if (!name || price <= 0) {
      App.toast('danger', 'Validation Error', 'Product name and valid price are required');
      return;
    }

    const item = {
      id: editId || `P${Date.now().toString().slice(-5)}`,
      name,
      cat,
      emoji,
      barcode,
      unit,
      mrp: mrp || price,
      price,
      cost,
      stock,
      minStock
    };

    DB.updateItem('products', item);
    this.closeModal();
    App.toast('success', 'Catalog Updated', `${name} successfully saved`);
    this.render();
    if (window.POS) POS.renderCatalog();
  }

  async fetchBarcodeFromGoogle() {
    const barcodeInput = document.getElementById('prod-form-barcode');
    const barcode = barcodeInput ? barcodeInput.value.trim() : '';
    if (!barcode) {
      App.toast('warning', 'Barcode Missing', 'Please enter or scan a barcode first');
      return;
    }

    App.toast('info', 'Searching Google...', `Looking up details for ${barcode}`);

    try {
      let prod = null;
      if (window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
        prod = await DukaanAI.lookupBarcodeOnline(barcode);
      }

      if (!prod) {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`).then(r => r.json());
        if (res && res.status === 1 && res.product) {
          const p = res.product;
          const name = p.product_name || p.product_name_en || p.generic_name || '';
          const brand = p.brands || '';
          const qty = p.quantity || '';
          if (name) {
            prod = {
              name: [brand, name, qty].filter(Boolean).join(' '),
              cat: 'Grocery',
              mrp: 30,
              price: 30,
              cost: 25,
              emoji: '📦',
              unit: 'pack'
            };
          }
        }
      }

      if (prod && prod.name) {
        const nameEl = document.getElementById('prod-form-name');
        const priceEl = document.getElementById('prod-form-price');
        const mrpEl = document.getElementById('prod-form-mrp');
        const costEl = document.getElementById('prod-form-cost');
        const catEl = document.getElementById('prod-form-cat');
        const emojiEl = document.getElementById('prod-form-emoji');

        if (nameEl) nameEl.value = prod.name;
        if (priceEl && prod.price) priceEl.value = prod.price;
        if (mrpEl && prod.mrp) mrpEl.value = prod.mrp;
        if (costEl && prod.cost) costEl.value = prod.cost;
        if (catEl && prod.cat) {
          const matchOpt = Array.from(catEl.options).find(o => o.value.toLowerCase() === prod.cat.toLowerCase());
          if (matchOpt) catEl.value = matchOpt.value;
        }
        if (emojiEl && prod.emoji) {
          const matchEmoji = Array.from(emojiEl.options).find(o => o.value === prod.emoji);
          if (matchEmoji) emojiEl.value = matchEmoji.value;
        }

        App.toast('success', 'Google Details Found! 🎉', `Auto-filled: ${prod.name}`);
      } else {
        App.toast('warning', 'Not Found on Google', 'Please enter product details manually');
      }
    } catch (err) {
      console.warn('[Inventory Google Fetch Error]', err);
      App.toast('error', 'Lookup Failed', 'Could not fetch details. Please fill manually.');
    }
  }

  closeModal() {
    const modal = document.getElementById('product-form-modal');
    if (modal) modal.remove();
  }
}

window.Inventory = new InventoryEngine();
