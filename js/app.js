/**
 * MyDukaan Pro — Master Application Router & State Controller
 * Created & Deployed by Mayur Singh
 */

class AppController {
  constructor() {
    this.currentView = 'pos'; // Default active view is POS billing
    this.init();
  }

  init() {
    this.applyTheme();
    this.initCommandPaletteListener();
    this.navigate(this.currentView);
    this.updateCreatorBadge();
  }

  // View Navigation Router
  navigate(viewName) {
    this.currentView = viewName;

    // Update sidebar active links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });

    // Update mobile bottom nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Close mobile sidebar if open
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Render corresponding view template
    const mainViewContainer = document.getElementById('main-view-container');
    if (!mainViewContainer) return;

    switch (viewName) {
      case 'pos':
        this.renderPOSView(mainViewContainer);
        if (window.POS) POS.init();
        break;

      case 'dashboard':
        this.renderDashboardView(mainViewContainer);
        break;

      case 'inventory':
        this.renderInventoryView(mainViewContainer);
        if (window.Inventory) Inventory.render();
        break;

      case 'khata':
        this.renderKhataView(mainViewContainer);
        if (window.Khata) Khata.render();
        break;

      case 'analytics':
        this.renderAnalyticsView(mainViewContainer);
        if (window.Analytics) Analytics.render();
        break;

      case 'staff':
        this.renderStaffView(mainViewContainer);
        if (window.Staff) Staff.render();
        break;

      case 'settings':
        this.renderSettingsView(mainViewContainer);
        break;

      default:
        this.renderPOSView(mainViewContainer);
        if (window.POS) POS.init();
    }
  }

  // View Renderers
  renderPOSView(container) {
    const db = DB.getData();
    const categories = ['All', ...new Set(db.products.map(p => p.cat))];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>⚡ Quick Billing Terminal</h1>
          <p>Tap products or scan barcode to add items to live bill</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="BarcodeScanner.openScannerModal()">
            📷 Camera Scanner
          </button>
          <button class="btn btn-secondary" onclick="Inventory.openProductModal()">
            ➕ Add Product
          </button>
        </div>
      </div>

      <div class="pos-layout">
        <!-- Left: Product Catalog -->
        <div class="pos-catalog-panel">
          <div class="pos-search-row">
            <div class="pos-search-input-wrap">
              <span class="pos-search-icon">🔍</span>
              <input type="text" id="pos-search-input" class="form-input pos-search-input" placeholder="Search product name, category, or barcode..." oninput="POS.setSearchQuery(this.value)" />
            </div>
            <button class="btn btn-secondary btn-icon" onclick="BarcodeScanner.openScannerModal()" title="Open Scanner">📷</button>
          </div>

          <!-- Category Chips -->
          <div class="category-chips">
            ${categories.map(cat => `
              <button class="cat-chip ${cat === 'All' ? 'active' : ''}" data-cat="${cat}" onclick="POS.setCategoryFilter('${cat}')">
                ${cat}
              </button>
            `).join('')}
          </div>

          <!-- Products Grid -->
          <div class="pos-products-grid" id="pos-products-grid"></div>
        </div>

        <!-- Right: Cart & Checkout Panel -->
        <div class="pos-cart-panel">
          <div class="pos-cart-header">
            <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;">
              <span>🛒 Bill Cart</span>
              <span class="badge badge-primary" id="pos-cart-count">0</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="POS.clearCart()">Clear</button>
          </div>

          <div class="pos-cart-items-list" id="pos-cart-items-list"></div>
          <div id="pos-cart-summary-area"></div>
        </div>
      </div>
    `;
  }

  renderDashboardView(container) {
    const db = DB.getData();
    const totalRev = db.invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalUdhaar = db.customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const lowStock = db.products.filter(p => p.stock <= p.minStock);

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📊 Store Executive Dashboard</h1>
          <p>Real-time metrics for ${db.shop.name} • Owner: ${db.shop.owner}</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="App.navigate('pos')">⚡ New Bill</button>
          <button class="btn btn-ai" onclick="DukaanAI.openChatModal()">✨ Ask Dukaan AI</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Revenue</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">💰</div>
          </div>
          <div class="kpi-val">₹${totalRev.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">All settled payments</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Outstanding Udhaar</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">⏳</div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">₹${totalUdhaar.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--warning);">Pending recovery</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Active Inventory</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">📦</div>
          </div>
          <div class="kpi-val">${db.products.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${lowStock.length} items low stock</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Customer Base</span>
            <div class="kpi-icon-badge" style="background: var(--purple-light); color: var(--purple);">👥</div>
          </div>
          <div class="kpi-val">${db.customers.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered accounts</div>
        </div>
      </div>

      <!-- Quick AI Insight Banner -->
      <div class="card" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(59, 130, 246, 0.05)); border-color: rgba(124, 58, 237, 0.2);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 28px;">✨</div>
            <div>
              <div style="font-weight: 700; font-size: 14.5px; color: var(--text-primary);">Dukaan AI Store Health Check</div>
              <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
                ${lowStock.length ? `You have ${lowStock.length} items needing restock. Click to generate instant wholesale reorder plan.` : 'Inventory is well-stocked. Review your customer Udhaar reminders.'}
              </div>
            </div>
          </div>
          <button class="btn btn-ai btn-sm" onclick="DukaanAI.openChatModal()">Ask AI Advisor</button>
        </div>
      </div>

      <!-- Recent Invoices Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🧾 Recent Bills & Invoices</div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('pos')">Create New Bill</button>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${db.invoices.slice(0, 5).map(inv => `
                <tr>
                  <td style="font-family: var(--font-mono); font-weight: 700;">${inv.id}</td>
                  <td>${inv.date} ${inv.time || ''}</td>
                  <td style="font-weight: 600;">${inv.customerName}</td>
                  <td>${inv.items.length} items</td>
                  <td style="font-weight: 800; color: var(--text-primary);">₹${inv.total}</td>
                  <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.paymentMode}</span></td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${inv.id}'))">
                      Receipt
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderInventoryView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📦 Product & Inventory Catalog</h1>
          <p>Manage barcode SKUs, wholesale cost, MRP, and stock thresholds</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Inventory.openProductModal()">
            ➕ Add Product
          </button>
          <button class="btn btn-secondary" onclick="BarcodeScanner.openScannerModal()">
            📷 Scan Barcode
          </button>
        </div>
      </div>

      <div id="inventory-kpi-row" class="kpi-grid"></div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Product Catalog List</div>
          <div style="display: flex; gap: 8px;">
            <input type="text" class="form-input" style="padding: 6px 12px; font-size: 12px; width: 220px;" placeholder="Search inventory..." oninput="Inventory.searchQuery = this.value; Inventory.render();" />
            <select class="form-select" style="padding: 6px 10px; font-size: 12px;" onchange="Inventory.filterStock = this.value; Inventory.render();">
              <option value="All">All Stock Levels</option>
              <option value="Low">Low Stock Only</option>
              <option value="OutOfStock">Out of Stock Only</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Icon</th>
                <th>Item & Barcode</th>
                <th>Category</th>
                <th>MRP / Price</th>
                <th>Cost (Margin)</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="inventory-table-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderKhataView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📒 Customer Udhaar Khata</h1>
          <p>Track pending dues, customer loyalty points, and send WhatsApp reminders</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Khata.openAddCustomerModal()">
            ➕ New Customer
          </button>
        </div>
      </div>

      <div id="khata-kpi-row" class="kpi-grid"></div>

      <div style="margin-bottom: 16px;">
        <input type="text" class="form-input" placeholder="Search customers by name or mobile number..." oninput="Khata.searchQuery = this.value; Khata.render();" />
      </div>

      <div id="khata-customer-list"></div>
    `;
  }

  renderAnalyticsView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📈 Analytics, P&L & Expenses</h1>
          <p>Track monthly gross revenue, profit margins, and operational costs</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('invoices'), 'MyDukaan_Invoices.csv')">
            📥 Export CSV
          </button>
        </div>
      </div>
      <div id="analytics-content-view"></div>
    `;
  }

  renderStaffView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>👔 Staff Directory & Attendance</h1>
          <p>Interactive attendance register, monthly payroll, and employee records</p>
        </div>
      </div>
      <div id="staff-content-view"></div>
    `;
  }

  renderSettingsView(container) {
    const db = DB.getData();
    const shop = db.shop;

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>⚙️ Store Settings & Developer Profile</h1>
          <p>Configure shop profile, UPI ID, Gemini 3.8 Flash API key, and data backups</p>
        </div>
      </div>

      <!-- Store Profile Settings -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏪 Store Branding & Billing Info</div>
        </div>
        <form onsubmit="event.preventDefault(); App.saveShopProfile();">
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Shop Name</label>
              <input type="text" id="set-shop-name" class="form-input" value="${shop.name}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Owner Name</label>
              <input type="text" id="set-shop-owner" class="form-input" value="${shop.owner}" required />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Contact Mobile</label>
              <input type="text" id="set-shop-phone" class="form-input" value="${shop.phone}" />
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN (GST Number)</label>
              <input type="text" id="set-shop-gstin" class="form-input" value="${shop.gstin}" />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Store UPI ID (For QR Code & Receipts)</label>
              <input type="text" id="set-shop-upi" class="form-input" value="${shop.upiId}" />
            </div>
            <div class="form-group">
              <label class="form-label">Default GST Tax Rate (%)</label>
              <input type="number" id="set-shop-tax" class="form-input" value="${shop.taxRate}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Store Address</label>
            <input type="text" id="set-shop-addr" class="form-input" value="${shop.address}" />
          </div>
          <button type="submit" class="btn btn-primary">✓ Save Store Info</button>
        </form>
      </div>

      <!-- Gemini AI Settings -->
      <div class="card" style="border-color: rgba(124, 58, 237, 0.3);">
        <div class="card-header">
          <div class="card-title" style="color: var(--purple);">✨ Gemini 3.8 Flash AI Key</div>
          <span class="badge badge-primary">Model: gemini-3.8-flash</span>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
          Get your free API key at <strong>aistudio.google.com</strong> to power smart voice billing and conversational business insights. If left empty, offline intelligence mode will answer your questions.
        </p>
        <div style="display: flex; gap: 8px;">
          <input type="password" id="set-gemini-key" class="form-input" placeholder="AIzaSy..." value="${db.geminiKey || ''}" />
          <button class="btn btn-ai" onclick="App.saveGeminiKey()">Save Key</button>
          <button class="btn btn-secondary" onclick="App.testGeminiKey()">🧪 Test Key</button>
        </div>
      </div>

      <!-- Data Backup & CSV Export -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 Data Backup & Offline Storage</div>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          All your inventory, customer records, and billing data are securely stored locally on this device.
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('products'), 'Products_Catalog.csv')">
            📥 Export Products (CSV)
          </button>
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('customers'), 'Customers_Khata.csv')">
            📥 Export Khata (CSV)
          </button>
          <button class="btn btn-secondary" onclick="DB.downloadFile(JSON.stringify(DB.getData(), null, 2), 'MyDukaan_Full_Backup.json', 'application/json')">
            📦 Download JSON Backup
          </button>
          <button class="btn btn-danger" onclick="App.resetToDemoData()">
            🔄 Reset Sample Data
          </button>
        </div>
      </div>

      <!-- Developer & Creator Spotlight Banner -->
      <div class="creator-banner" style="margin: 20px 0 0;">
        <div class="creator-left">
          <div class="creator-big-avatar">M</div>
          <div class="creator-meta">
            <h3>Mayur Singh <span class="badge badge-success">✓ Verified Creator & Deployer</span></h3>
            <p>Designed, developed, and deployed for Indian Retailers with pride 🇮🇳</p>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              Frontend Architecture • Barcode Vision Engine • LocalStorage DB • Gemini 3.8 Flash
            </div>
          </div>
        </div>
        <a href="https://github.com/mayursingh24" target="_blank" class="btn btn-primary">
          ⭐ Visit GitHub @mayursingh24
        </a>
      </div>
    `;
  }

  saveShopProfile() {
    const db = DB.getData();
    db.shop = {
      name: document.getElementById('set-shop-name').value.trim(),
      owner: document.getElementById('set-shop-owner').value.trim(),
      phone: document.getElementById('set-shop-phone').value.trim(),
      gstin: document.getElementById('set-shop-gstin').value.trim(),
      upiId: document.getElementById('set-shop-upi').value.trim(),
      taxRate: parseFloat(document.getElementById('set-shop-tax').value) || 0,
      address: document.getElementById('set-shop-addr').value.trim(),
      currency: "₹"
    };

    DB.saveData(db);
    this.updateCreatorBadge();
    this.toast('success', 'Profile Updated', 'Store information saved');
  }

  saveGeminiKey() {
    const key = document.getElementById('set-gemini-key').value.trim();
    const db = DB.getData();
    db.geminiKey = key;
    DB.saveData(db);
    this.toast('success', 'Gemini Key Saved', 'Connected to gemini-3.8-flash');
  }

  async testGeminiKey() {
    const key = document.getElementById('set-gemini-key').value.trim();
    if (!key) {
      this.toast('warning', 'Key Required', 'Please enter a Gemini API key first');
      return;
    }

    this.toast('info', 'Testing...', 'Connecting to gemini-3.8-flash endpoint');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Say 'Ready'" }] }] })
      });
      const data = await res.json();
      if (data.candidates) {
        this.toast('success', 'Gemini 3.8 Flash Ready! ✨', 'API connection verified successfully');
      } else {
        this.toast('danger', 'API Error', data.error ? data.error.message : 'Invalid Key');
      }
    } catch (e) {
      this.toast('danger', 'Network Error', e.message);
    }
  }

  resetToDemoData() {
    if (confirm("Reset database to fresh sample products & customers?")) {
      localStorage.removeItem(STORAGE_KEY);
      DB.initDatabase();
      this.toast('info', 'Reset Complete', 'Loaded fresh demo catalog');
      this.navigate(this.currentView);
    }
  }

  toggleTheme() {
    const db = DB.getData();
    db.theme = db.theme === 'light' ? 'dark' : 'light';
    DB.saveData(db);
    this.applyTheme();
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = db.theme === 'light' ? '🌙' : '☀️';
  }

  applyTheme() {
    const db = DB.getData();
    document.documentElement.setAttribute('data-theme', db.theme || 'dark');
  }

  updateCreatorBadge() {
    const db = DB.getData();
    const shopNameEls = document.querySelectorAll('.shop-chip-name');
    shopNameEls.forEach(el => el.textContent = db.shop.name);
  }

  initCommandPaletteListener() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        BarcodeScanner.openScannerModal();
      }
    });
  }

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  // Toast Notification Stack
  toast(type, title, message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      success: '✓',
      warning: '⚠️',
      danger: '✕',
      info: 'ℹ️'
    };

    const colors = {
      success: 'var(--success)',
      warning: 'var(--warning)',
      danger: 'var(--danger)',
      info: 'var(--primary)'
    };

    const toastEl = document.createElement('div');
    toastEl.className = 'toast-msg';
    toastEl.innerHTML = `
      <div style="font-size: 16px; color: ${colors[type] || colors.info}; font-weight: bold;">
        ${icons[type] || '•'}
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: var(--text-primary); font-size: 13px;">${title}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">${message}</div>
      </div>
      <button style="color: var(--text-muted); cursor: pointer; font-size: 14px;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toastEl);
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(-10px)';
      toastEl.style.transition = 'all 0.2s';
      setTimeout(() => toastEl.remove(), 200);
    }, 3500);
  }
}

window.App = new AppController();
