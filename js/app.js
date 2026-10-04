/**
 * MyDukaan24 — Master Application Router, Views & Workflow Controller
 * Created & Deployed by Mayur Singh (Lucknow, India)
 */

class AppController {
  constructor() {
    this.currentView = 'dashboard'; // Standard SaaS starts on Dashboard
    this.init();
  }

  init() {
    this.applyTheme();
    this.initKeyboardShortcuts();
    this.navigate(this.currentView);
    this.updateHeaderStoreName();
  }

  // Master Navigation Router
  navigate(viewName) {
    this.currentView = viewName;

    // Update Desktop Sidebar active states
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });

    // Update Mobile Nav active states
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Close mobile drawer if open
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.classList.remove('open');

    const container = document.getElementById('main-view-container');
    if (!container) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (viewName) {
      case 'dashboard':
        this.renderDashboardView(container);
        break;

      case 'pos':
        this.renderPOSView(container);
        if (window.POS) POS.init();
        break;

      case 'products':
      case 'inventory':
        this.renderInventoryView(container);
        if (window.Inventory) Inventory.render();
        break;

      case 'customers':
      case 'udhaar':
        this.renderKhataView(container);
        if (window.Khata) Khata.render();
        break;

      case 'invoices':
      case 'receipts':
        this.renderInvoicesView(container);
        break;

      case 'employees':
      case 'attendance':
        this.renderStaffView(container);
        if (window.Staff) Staff.render();
        break;

      case 'analytics':
        this.renderAnalyticsView(container);
        if (window.Analytics) Analytics.render();
        break;

      case 'settings':
        this.renderSettingsView(container);
        break;

      case 'help':
        this.renderHelpView(container);
        break;

      default:
        this.renderDashboardView(container);
    }
  }

  // 1. DASHBOARD VIEW — Answers "How is my shop doing today?"
  renderDashboardView(container) {
    const db = DB.getData();
    const shop = db.shop || {};
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];
    const staff = db.staff || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayInvoices = invoices.filter(i => i.date === todayStr);
    const todaySales = todayInvoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalRevenue = invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalUdhaar = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const lowStock = products.filter(p => p.stock <= p.minStock);

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📊 Overview & Executive Dashboard</h1>
          <p>Real-time shop operations • ${shop.name || 'MyDukaan24 Store'} • Managed by ${shop.owner || 'Mayur Singh'}</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="App.navigate('pos')">
            ⚡ Quick Billing
          </button>
          <button class="btn btn-ai" onclick="DukaanAI.openChatModal()">
            ✨ Ask MyDukaan24 AI
          </button>
        </div>
      </div>

      <!-- Smart Contextual Warning Banners -->
      ${lowStock.length ? `
        <div class="card" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3); margin-bottom: 20px; padding: 14px 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">⚠️</span>
              <div>
                <strong style="color: var(--warning); font-size: 13.5px;">Low Stock Warning:</strong>
                <span style="font-size: 13px; color: var(--text-primary); margin-left: 4px;">
                  ${lowStock.length} products have fallen below minimum threshold.
                </span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('inventory'); Inventory.filterStock = 'Low'; Inventory.render();">
              Review Low Stock →
            </button>
          </div>
        </div>
      ` : ''}

      ${totalUdhaar > 0 ? `
        <div class="card" style="background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.25); margin-bottom: 20px; padding: 14px 18px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">⏳</span>
              <div>
                <strong style="color: var(--danger); font-size: 13.5px;">Pending Customer Udhaar:</strong>
                <span style="font-size: 13px; color: var(--text-primary); margin-left: 4px;">
                  ₹${totalUdhaar.toLocaleString('en-IN')} uncollected across customers.
                </span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('udhaar')">
              Review Pending Payments →
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Six Key Metrics Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Today's Sales</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">💵</div>
          </div>
          <div class="kpi-val">₹${todaySales.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">${todayInvoices.length} bills billed today</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Products</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">📦</div>
          </div>
          <div class="kpi-val">${products.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${products.reduce((s, p) => s + p.stock, 0)} total units in store</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Low Stock</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">⚠️</div>
          </div>
          <div class="kpi-val" style="color: ${lowStock.length ? 'var(--warning)' : 'var(--text-primary)'};">${lowStock.length}</div>
          <div class="kpi-trend" style="color: var(--warning);">${lowStock.length ? 'Needs reordering' : 'Stock healthy'}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Pending Udhaar</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">📒</div>
          </div>
          <div class="kpi-val" style="color: ${totalUdhaar > 0 ? 'var(--danger)' : 'var(--success)'};">₹${totalUdhaar.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--danger);">${customers.filter(c => c.balanceDue > 0).length} debtors</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Customers</span>
            <div class="kpi-icon-badge" style="background: var(--purple-light); color: var(--purple);">👥</div>
          </div>
          <div class="kpi-val">${customers.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered khata profiles</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Employees</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">👔</div>
          </div>
          <div class="kpi-val">${staff.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Store team members</div>
        </div>
      </div>

      <!-- Live Sales Overview & Quick Actions -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- Left: Recent Transactions Table -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">🧾 Recent Billing Transactions</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('invoices')">View All Bills</button>
          </div>

          ${invoices.length ? `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.slice(0, 5).map(inv => `
                    <tr>
                      <td style="font-family: var(--font-mono); font-weight: 700;">${inv.id}</td>
                      <td>${inv.date}</td>
                      <td style="font-weight: 600;">${inv.customerName}</td>
                      <td style="font-weight: 800; color: var(--text-primary);">₹${inv.total}</td>
                      <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.paymentMode}</span></td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${inv.id}'))">
                          🖨️ View
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state-card">
              <div class="empty-state-icon">🧾</div>
              <div class="empty-state-title">No transactions recorded yet</div>
              <div class="empty-state-desc">Create your first sale in the Quick POS Terminal to begin tracking sales and receipts.</div>
              <button class="btn btn-primary" onclick="App.navigate('pos')">⚡ Open Quick Billing</button>
            </div>
          `}
        </div>

        <!-- Right: Business Health & AI Consultation Box -->
        <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="card-header">
              <div class="card-title" style="color: var(--purple);">✨ MyDukaan24 AI Health</div>
              <span class="badge badge-primary">Online</span>
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
              Your store has generated <strong>₹${totalRevenue.toLocaleString('en-IN')}</strong> in lifetime revenue.
              ${lowStock.length ? `Restock ${lowStock[0].name} before it runs completely out.` : 'Stock turnover is stable.'}
            </p>
            <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-top: 14px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Top Quick Question:</div>
              <div style="font-size: 12.5px; color: var(--text-primary); margin-top: 4px; font-weight: 600;">
                "Who owes me the most in pending Udhaar?"
              </div>
            </div>
          </div>
          <button class="btn btn-ai w100" style="margin-top: 16px;" onclick="DukaanAI.openChatModal()">
            ✨ Consult Dukaan AI Now
          </button>
        </div>
      </div>
    `;
  }

  // 2. POS BILLING TERMINAL VIEW
  renderPOSView(container) {
    const db = DB.getData();
    const categories = ['All', ...new Set(db.products.map(p => p.cat))];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>⚡ Quick Billing Terminal</h1>
          <p>Scan barcode with camera or tap products to generate instant bills</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="BarcodeScanner.openScannerModal()">
            📷 Camera Barcode Scanner
          </button>
          <button class="btn btn-secondary" onclick="Inventory.openProductModal()">
            ➕ Add Product
          </button>
        </div>
      </div>

      <div class="pos-layout">
        <!-- Left Column: Catalog & Search -->
        <div class="pos-catalog-panel">
          <div class="pos-search-row">
            <div class="pos-search-input-wrap">
              <span class="pos-search-icon">🔍</span>
              <input type="text" id="pos-search-input" class="form-input pos-search-input" placeholder="Search product name, category, or barcode..." oninput="POS.setSearchQuery(this.value)" />
            </div>
            <button class="btn btn-secondary btn-icon" onclick="BarcodeScanner.openScannerModal()" title="Open Barcode Scanner">📷</button>
          </div>

          <!-- Category Filter Chips -->
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

        <!-- Right Column: Live Cart & Bill Summary -->
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

  // 3. INVENTORY & PRODUCTS VIEW
  renderInventoryView(container) {
    const db = DB.getData();
    const products = db.products || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📦 Product & Inventory Management</h1>
          <p>Track wholesale cost, retail MRP, barcode SKUs, and minimum stock alerts</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Inventory.openProductModal()">
            ➕ Add New Product
          </button>
          <button class="btn btn-secondary" onclick="BarcodeScanner.openScannerModal()">
            📷 Scan Barcode
          </button>
        </div>
      </div>

      <div id="inventory-kpi-row" class="kpi-grid"></div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Inventory Master Catalog</div>
          <div style="display: flex; gap: 8px;">
            <input type="text" class="form-input" style="padding: 6px 12px; font-size: 12px; width: 220px;" placeholder="Search inventory..." oninput="Inventory.searchQuery = this.value; Inventory.render();" />
            <select class="form-select" style="padding: 6px 10px; font-size: 12px;" onchange="Inventory.filterStock = this.value; Inventory.render();">
              <option value="All">All Stock Levels</option>
              <option value="Low">Low Stock Only</option>
              <option value="OutOfStock">Out of Stock Only</option>
            </select>
          </div>
        </div>

        ${products.length ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Item & Barcode</th>
                  <th>Category</th>
                  <th>MRP / Price</th>
                  <th>Cost (Margin)</th>
                  <th>Stock Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="inventory-table-tbody"></tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state-card">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">No products yet</div>
            <div class="empty-state-desc">Add your first product to start managing inventory, prices, and stock levels.</div>
            <button class="btn btn-primary" onclick="Inventory.openProductModal()">➕ Add Your First Product</button>
          </div>
        `}
      </div>
    `;
  }

  // 4. CUSTOMERS & UDHAAR KHATA VIEW
  renderKhataView(container) {
    const db = DB.getData();
    const customers = db.customers || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📒 Customer Udhaar Khata (Credit Ledger)</h1>
          <p>Track pending dues, record cash payments, and send 1-click WhatsApp payment reminders</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Khata.openAddCustomerModal()">
            ➕ Add Customer
          </button>
        </div>
      </div>

      <div id="khata-kpi-row" class="kpi-grid"></div>

      <div style="margin-bottom: 16px;">
        <input type="text" class="form-input" placeholder="Search customer by name or mobile number..." oninput="Khata.searchQuery = this.value; Khata.render();" />
      </div>

      ${customers.length ? `
        <div id="khata-customer-list"></div>
      ` : `
        <div class="empty-state-card">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">No customers registered yet</div>
          <div class="empty-state-desc">Add regular customers to record Udhaar (credit sales) and track pending payments.</div>
          <button class="btn btn-primary" onclick="Khata.openAddCustomerModal()">➕ Add Customer Profile</button>
        </div>
      `}
    `;
  }

  // 5. INVOICES & RECEIPTS VIEW
  renderInvoicesView(container) {
    const db = DB.getData();
    const invoices = db.invoices || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>🧾 Invoices & Sales Receipts</h1>
          <p>All recorded bills with thermal print preview and customer records</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="App.navigate('pos')">
            ⚡ Create New Bill
          </button>
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('invoices'), 'MyDukaan24_Invoices.csv')">
            📥 Export CSV
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">All Sales Invoices (${invoices.length})</div>
        </div>

        ${invoices.length ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date & Time</th>
                  <th>Customer Name</th>
                  <th>Items Billed</th>
                  <th>Tax</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${inv.id}</td>
                    <td>${inv.date} ${inv.time || ''}</td>
                    <td style="font-weight: 600;">${inv.customerName}</td>
                    <td>${inv.items.length} items</td>
                    <td>₹${inv.tax || 0}</td>
                    <td style="font-weight: 800; color: var(--text-primary);">₹${inv.total}</td>
                    <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.paymentMode}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${inv.id}'))">
                        🖨️ Thermal Receipt
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state-card">
            <div class="empty-state-icon">🧾</div>
            <div class="empty-state-title">No invoices generated yet</div>
            <div class="empty-state-desc">Start billing in the Quick POS terminal to record sales and generate invoices.</div>
            <button class="btn btn-primary" onclick="App.navigate('pos')">⚡ Open Quick Billing</button>
          </div>
        `}
      </div>
    `;
  }

  // 6. EMPLOYEES & ATTENDANCE VIEW
  renderStaffView(container) {
    const db = DB.getData();
    const staff = db.staff || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>👔 Staff Directory & Daily Attendance</h1>
          <p>Interactive 31-day attendance register, monthly payroll, and team directory</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Staff.openAddStaffModal()">
            ➕ Add Team Member
          </button>
        </div>
      </div>
      <div id="staff-content-view"></div>
    `;
  }

  // 7. ANALYTICS & P&L VIEW
  renderAnalyticsView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>📈 Business Insights & Profit/Loss</h1>
          <p>Real-time visual charts, gross revenue, operating costs, and net margins</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('invoices'), 'MyDukaan24_Invoices.csv')">
            📥 Export CSV
          </button>
        </div>
      </div>
      <div id="analytics-content-view"></div>
    `;
  }

  // 8. STORE SETTINGS & SYSTEM VIEW
  renderSettingsView(container) {
    const db = DB.getData();
    const shop = db.shop || {};

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>⚙️ Store Configuration & Settings</h1>
          <p>Manage shop branding, UPI ID, Gemini 3.8 Flash online API key, and data backups</p>
        </div>
      </div>

      <!-- Shop Profile -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏪 Shop Branding & Details</div>
        </div>
        <form onsubmit="event.preventDefault(); App.saveShopProfile();">
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Shop Name *</label>
              <input type="text" id="set-shop-name" class="form-input" value="${shop.name || 'MyDukaan24 Store'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Owner Name *</label>
              <input type="text" id="set-shop-owner" class="form-input" value="${shop.owner || 'Mayur Singh'}" required />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Contact Mobile</label>
              <input type="text" id="set-shop-phone" class="form-input" value="${shop.phone || '+91 98765 43210'}" />
            </div>
            <div class="form-group">
              <label class="form-label">GSTIN (Optional)</label>
              <input type="text" id="set-shop-gstin" class="form-input" value="${shop.gstin || ''}" />
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Store UPI ID (For Bills & Reminders)</label>
              <input type="text" id="set-shop-upi" class="form-input" value="${shop.upiId || 'mydukaan24@upi'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Default GST Tax Rate (%)</label>
              <input type="number" id="set-shop-tax" class="form-input" value="${shop.taxRate || 5}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Store Address</label>
            <input type="text" id="set-shop-addr" class="form-input" value="${shop.address || 'Lucknow, India'}" />
          </div>
          <button type="submit" class="btn btn-primary">✓ Save Shop Profile</button>
        </form>
      </div>

      <!-- Gemini AI Configuration -->
      <div class="card" style="border-color: rgba(124, 58, 237, 0.35);">
        <div class="card-header">
          <div class="card-title" style="color: var(--purple);">✨ Gemini 3.8 Flash Online AI Key</div>
          <span class="badge badge-primary">Model: gemini-3.8-flash</span>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
          Configure your Google Gemini API key to activate the live AI retail brain. In production, this can also be set via Netlify environment variable <code>GEMINI_API_KEY</code>.
        </p>
        <div style="display: flex; gap: 8px;">
          <input type="password" id="set-gemini-key" class="form-input" placeholder="AIzaSy..." value="${db.geminiKey || ''}" />
          <button class="btn btn-ai" onclick="App.saveGeminiKey()">Save Key</button>
          <button class="btn btn-secondary" onclick="App.testGeminiKey()">🧪 Test Online</button>
        </div>
      </div>

      <!-- Cloud Sync & Data Management -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 Data Backup & Offline Storage</div>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Your data is safely persisted in this browser's database. Export backups regularly or reset catalog.
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('products'), 'MyDukaan24_Products.csv')">
            📥 Export Products (CSV)
          </button>
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('customers'), 'MyDukaan24_Customers.csv')">
            📥 Export Customers (CSV)
          </button>
          <button class="btn btn-secondary" onclick="DB.downloadFile(JSON.stringify(DB.getData(), null, 2), 'MyDukaan24_Backup.json', 'application/json')">
            📦 Download JSON Backup
          </button>
          <button class="btn btn-danger" onclick="App.resetToDemoData()">
            🔄 Reset Demo Data
          </button>
        </div>
      </div>

      <!-- Developer Profile & Deployment Information -->
      <div class="card" style="border-color: var(--border-medium);">
        <div class="card-header">
          <div class="card-title">👨‍💻 Developer & Release Details</div>
          <span class="badge badge-success">✓ Verified Release</span>
        </div>
        <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #059669); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800;">
            M
          </div>
          <div>
            <div style="font-weight: 800; font-size: 16px; color: var(--text-primary);">Mayur Singh</div>
            <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
              📍 Lucknow, India • 📧 <a href="mailto:mayur4singhhh@gmail.com" style="color: var(--primary);">mayur4singhhh@gmail.com</a>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 12.5px;">
              <a href="https://instagram.com/_mayur.x24" target="_blank" style="color: var(--primary); font-weight: 600;">
                Instagram: @_mayur.x24
              </a>
              <span>•</span>
              <a href="https://linkedin.com/in/mayursingh24" target="_blank" style="color: var(--primary); font-weight: 600;">
                LinkedIn: mayursingh24
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 9. HELP & USER WORKFLOW GUIDE VIEW
  renderHelpView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>❓ Help & Store Workflow Guide</h1>
          <p>Step-by-step guidance to master MyDukaan24 for your daily store operations</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📖 Complete Shop Workflow</div>
        <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 14px; font-size: 13.5px;">
          <div>
            <strong>Step 1: Set Up Shop Details</strong><br/>
            Go to <em>Settings</em> and verify your Shop Name, Address, and UPI ID for customer QR code billing.
          </div>
          <div>
            <strong>Step 2: Add Inventory or Scan Barcodes</strong><br/>
            Open <em>Inventory</em> and add products. Use the camera barcode scanner to auto-fill barcodes and detect MRP.
          </div>
          <div>
            <strong>Step 3: Point-of-Sale (POS) Billing</strong><br/>
            Go to <em>Quick Billing</em>. Tap items or scan barcode. Choose Cash, UPI, or Udhaar, and print thermal receipt or share via WhatsApp.
          </div>
          <div>
            <strong>Step 4: Manage Udhaar Khata</strong><br/>
            Check <em>Udhaar</em> to view pending customer dues. Send 1-click polite WhatsApp payment reminders with your store UPI ID.
          </div>
          <div>
            <strong>Step 5: Ask MyDukaan24 AI</strong><br/>
            Use the <em>✨ Dukaan AI</em> button anytime to ask about low stock items, top debtors, or ways to increase margin.
          </div>
        </div>
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
    this.updateHeaderStoreName();
    this.toast('success', 'Profile Updated', 'Shop details saved successfully');
  }

  saveGeminiKey() {
    const key = document.getElementById('set-gemini-key').value.trim();
    const db = DB.getData();
    db.geminiKey = key;
    DB.saveData(db);
    this.toast('success', 'Gemini Key Saved', 'Connected to gemini-3.8-flash online model');
  }

  async testGeminiKey() {
    const key = document.getElementById('set-gemini-key').value.trim();
    if (!key) {
      this.toast('warning', 'Key Required', 'Please enter a Gemini API key first');
      return;
    }

    this.toast('info', 'Testing Online...', 'Connecting to gemini-3.8-flash endpoint');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Say 'MyDukaan24 Online'" }] }] })
      });
      const data = await res.json();
      if (data.candidates) {
        this.toast('success', 'Online Verified! ✨', 'Gemini 3.8 Flash is ready and active');
      } else {
        this.toast('danger', 'API Error', data.error ? data.error.message : 'Invalid Key');
      }
    } catch (e) {
      this.toast('danger', 'Network Error', e.message);
    }
  }

  resetToDemoData() {
    if (confirm("Reset catalog and records to fresh sample store data?")) {
      localStorage.removeItem(STORAGE_KEY);
      DB.initDatabase();
      this.toast('info', 'Demo Data Loaded', 'Sample Kirana catalog restored');
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

  updateHeaderStoreName() {
    const db = DB.getData();
    const shopNameEls = document.querySelectorAll('.shop-chip-name');
    shopNameEls.forEach(el => el.textContent = db.shop.name || 'MyDukaan24');
  }

  initKeyboardShortcuts() {
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

  // Toast Notification System
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
