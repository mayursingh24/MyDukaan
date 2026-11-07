/**
 * MyDukkan24 — Enterprise Master Application Router, Views & Workflow Controller
 * Clean, human-designed SaaS architecture for high-performance retail operations.
 */

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.isNotificationOpen = false;
    this.init();
  }

  init() {
    this.applyTheme();
    this.setupIcons();
    this.initKeyboardShortcuts();
    this.updateNotificationBadge();
    this.updateHeaderStoreName();
    this.navigate(this.currentView);

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      const notifBtn = document.getElementById('notification-bell-btn');
      const notifContainer = document.getElementById('notification-popover-container');
      if (this.isNotificationOpen && notifBtn && notifContainer && !notifBtn.contains(e.target) && !notifContainer.contains(e.target)) {
        this.closeNotificationPopover();
      }
    });
  }

  // Inject crisp SVG icons dynamically
  setupIcons() {
    if (!window.Icons) return;

    // Sidebar & mobile navigation icons
    document.querySelectorAll('[data-icon]').forEach(el => {
      const iconKey = el.dataset.icon;
      if (Icons[iconKey]) {
        el.innerHTML = Icons[iconKey](18);
      }
    });

    // Topbar icons
    const searchSpan = document.querySelector('.search-icon-span');
    if (searchSpan) searchSpan.innerHTML = Icons.search(15);

    const scanIcon = document.getElementById('topbar-scan-icon');
    if (scanIcon) scanIcon.innerHTML = Icons.camera(15);

    const bellIcon = document.getElementById('topbar-bell-icon');
    if (bellIcon) bellIcon.innerHTML = Icons.alert(16);

    const sparklesIcon = document.getElementById('topbar-sparkles-icon');
    if (sparklesIcon) sparklesIcon.innerHTML = Icons.sparkles(16);

    const shopIcon = document.getElementById('shop-chip-icon');
    if (shopIcon) shopIcon.innerHTML = Icons.store(15);

    const mobileCartIcon = document.getElementById('mobile-cart-icon');
    if (mobileCartIcon) mobileCartIcon.innerHTML = Icons.pos(18);

    this.updateThemeIcons();
  }

  updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const topbarIcon = document.getElementById('theme-toggle-icon');
    if (topbarIcon) topbarIcon.innerHTML = isDark ? Icons.sun(16) : Icons.moon(16);

    const sidebarIcon = document.getElementById('sidebar-theme-icon');
    if (sidebarIcon) sidebarIcon.innerHTML = isDark ? Icons.sun(14) : Icons.moon(14);
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

    // Toggle Mobile Sticky Bar visibility (Only in POS view)
    const mobilePosBar = document.getElementById('mobile-pos-sticky-bar');
    if (mobilePosBar) {
      mobilePosBar.style.display = (viewName === 'pos' && window.innerWidth <= 900) ? 'flex' : 'none';
    }

    // Close mobile drawer if open
    const sidebar = document.getElementById('app-sidebar');
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

      case 'expenses':
        this.renderExpensesView(container);
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

    this.updateNotificationBadge();
  }

  // 1. ADVANCED EXECUTIVE DASHBOARD
  renderDashboardView(container) {
    const db = DB.getData();
    const shop = db.shop || {};
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayInvoices = invoices.filter(i => i.date === todayStr);
    const todaySales = todayInvoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalRevenue = invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalUdhaar = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const lowStock = products.filter(p => p.stock <= p.minStock);
    const totalInventoryValue = products.reduce((s, p) => s + (p.cost * p.stock), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Format current date nicely
    const dateFormatted = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Executive Dashboard</h1>
          <p>${dateFormatted} • ${shop.name || 'MyDukkan24 Store'} • Active Terminal</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="BarcodeScanner.openScannerModal()">
            ${Icons.scan(15)} Scan Barcode
          </button>
          <button class="btn btn-primary" onclick="App.navigate('pos')">
            ${Icons.pos(15)} Quick Billing (F2)
          </button>
        </div>
      </div>

      <!-- Critical Stock Warning Banner -->
      ${lowStock.length ? `
        <div class="card" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3); margin-bottom: 18px; padding: 12px 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: var(--warning); display: flex;">${Icons.alert(18)}</span>
              <div>
                <strong style="color: var(--warning); font-size: 13px;">Low Stock Attention Needed:</strong>
                <span style="font-size: 12.5px; color: var(--text-primary); margin-left: 4px;">
                  ${lowStock.length} items are below minimum safe stock limit.
                </span>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('inventory'); Inventory.filterStock = 'Low'; Inventory.render();">
              Review Items →
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Four Core Metric Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Today's Sales</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${todaySales}" data-kpi-prefix="₹">₹0</div>
          <div class="kpi-trend" style="color: var(--success);">
            ${todayInvoices.length} orders billed today
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Pending Udhaar</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.book(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${totalUdhaar}" data-kpi-prefix="₹" style="color: ${totalUdhaar > 0 ? 'var(--danger)' : 'var(--success)'};">₹0</div>
          <div class="kpi-trend" style="color: var(--text-muted);">
            ${customers.filter(c => c.balanceDue > 0).length} customer balances due
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Stock Status</span>
            <div class="kpi-icon-badge" style="background: ${lowStock.length ? 'var(--warning-light)' : 'var(--success-light)'}; color: ${lowStock.length ? 'var(--warning)' : 'var(--success)'};">
              ${Icons.inventory(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${lowStock.length}" style="color: ${lowStock.length ? 'var(--warning)' : 'var(--text-primary)'};">0</div>
          <div class="kpi-trend" style="color: ${lowStock.length ? 'var(--warning)' : 'var(--text-muted)'};">
            ${lowStock.length ? 'Items need reordering' : 'All items well-stocked'}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Inventory Asset Value</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.package(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${totalInventoryValue}" data-kpi-prefix="₹">₹0</div>
          <div class="kpi-trend" style="color: var(--text-muted);">
            ${products.length} SKUs (${products.reduce((s, p) => s + p.stock, 0)} units)
          </div>
        </div>
      </div>

      <!-- Main Operational Split -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- Left: Recent Transactions Ledger -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">
              ${Icons.receipt(16)} Recent Sales Transactions
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('invoices')">
              View All Bills
            </button>
          </div>

          ${invoices.length ? `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.slice(0, 6).map(inv => `
                    <tr>
                      <td style="font-family: var(--font-mono); font-weight: 600; font-size: 12.5px;">${inv.id}</td>
                      <td>${inv.date}</td>
                      <td style="font-weight: 500;">${inv.customerName || 'Walk-in Customer'}</td>
                      <td style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${inv.total.toLocaleString('en-IN')}</td>
                      <td>
                        <span class="badge ${inv.paymentMode === 'Cash' ? 'badge-success' : inv.paymentMode === 'UPI' ? 'badge-primary' : 'badge-warning'}">
                          ${inv.paymentMode}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${inv.id}'))" title="View Thermal Receipt">
                          ${Icons.print(14)} Receipt
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
              <div style="margin-bottom: 8px;">${Icons.receipt(32)}</div>
              <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No billing transactions recorded yet</div>
              <p style="font-size: 12.5px; margin-top: 4px;">Start by generating your first sale on the POS terminal.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="App.navigate('pos')">
                ${Icons.pos(14)} Open Quick POS
              </button>
            </div>
          `}
        </div>

        <!-- Right: Urgent Stock Attention & Fast Action Center -->
        <div style="display: flex; flex-direction: column; gap: 18px;">
          <!-- Low Stock Action Card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">
                ${Icons.inventory(16)} Low Stock Reorder List
              </div>
              <span class="badge ${lowStock.length ? 'badge-warning' : 'badge-success'}">${lowStock.length} items</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${lowStock.length ? lowStock.slice(0, 4).map(p => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div>
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">${p.name}</div>
                    <div style="font-size: 11px; color: var(--danger); font-weight: 500;">
                      Stock: ${p.stock} ${p.unit} (Min: ${p.minStock})
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm" onclick="Inventory.quickRestock('${p.id}')">
                    + Restock
                  </button>
                </div>
              `).join('') : `
                <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
                  ✓ All products meet safe stock limits.
                </div>
              `}
            </div>
          </div>

          <!-- Quick Action Shortcuts -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.settings(15)} Quick Operations</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button class="btn btn-secondary" onclick="Inventory.openProductModal()">
                ${Icons.plus(14)} New Product
              </button>
              <button class="btn btn-secondary" onclick="Khata.openCustomerModal()">
                ${Icons.users(14)} Add Customer
              </button>
              <button class="btn btn-secondary" onclick="App.openExpenseModal()">
                ${Icons.wallet(14)} Add Expense
              </button>
              <button class="btn btn-secondary" onclick="DukaanAI.openChatModal()">
                ${Icons.sparkles(14)} Ask Copilot
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.animateKpiNumbers();
  }

  // Animate Dashboard KPI Counters
  animateKpiNumbers() {
    const kpiEls = document.querySelectorAll('[data-kpi-target]');
    kpiEls.forEach(el => {
      const target = parseFloat(el.dataset.kpiTarget) || 0;
      const prefix = el.dataset.kpiPrefix || '';
      const suffix = el.dataset.kpiSuffix || '';
      const duration = 600;
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeOut * target);
        el.textContent = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = `${prefix}${target.toLocaleString('en-IN')}${suffix}`;
        }
      }
      requestAnimationFrame(step);
    });
  }

  // 2. POS BILLING VIEW WRAPPER
  renderPOSView(container) {
    container.innerHTML = `
      <div class="pos-layout">
        <!-- Left: Product Search, Category Filter & Products Grid -->
        <div class="pos-catalog-panel">
          <div class="pos-search-row">
            <div class="pos-search-input-wrap">
              <span class="pos-search-icon">${Icons.search(16)}</span>
              <input type="text" id="pos-search-input" class="form-input pos-search-input" placeholder="Search product name, category, or scan barcode..." oninput="POS.setSearchQuery(this.value)" autofocus />
            </div>
            <button class="btn btn-secondary" onclick="BarcodeScanner.openScannerModal()" title="Open Camera Scanner">
              ${Icons.camera(16)} Scan
            </button>
          </div>

          <!-- Category Filter Pills -->
          <div class="category-chips">
            <button class="cat-chip active" data-cat="All" onclick="POS.setCategoryFilter('All')">All Items</button>
            <button class="cat-chip" data-cat="Grocery" onclick="POS.setCategoryFilter('Grocery')">Grocery</button>
            <button class="cat-chip" data-cat="Dairy" onclick="POS.setCategoryFilter('Dairy')">Dairy</button>
            <button class="cat-chip" data-cat="Oils" onclick="POS.setCategoryFilter('Oils')">Oils</button>
            <button class="cat-chip" data-cat="Snacks" onclick="POS.setCategoryFilter('Snacks')">Snacks</button>
            <button class="cat-chip" data-cat="Beverages" onclick="POS.setCategoryFilter('Beverages')">Beverages</button>
            <button class="cat-chip" data-cat="Personal Care" onclick="POS.setCategoryFilter('Personal Care')">Personal Care</button>
            <button class="cat-chip" data-cat="Household" onclick="POS.setCategoryFilter('Household')">Household</button>
          </div>

          <!-- Product Catalog Grid -->
          <div class="pos-products-grid" id="pos-products-grid"></div>
        </div>

        <!-- Right: Register Bill Cart -->
        <div class="pos-cart-panel" id="pos-cart-panel">
          <div class="pos-cart-header">
            <div class="pos-cart-title">
              ${Icons.pos(16)} Current Bill
              <span class="badge badge-primary" id="pos-cart-count">0</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="POS.clearCart()">Clear</button>
              <button class="topbar-icon-btn mobile-only" style="width: 28px; height: 28px;" onclick="POS.toggleMobileCartDrawer()">✕</button>
            </div>
          </div>

          <div class="pos-cart-items-list" id="pos-cart-items-list"></div>

          <div id="pos-cart-summary-area"></div>
        </div>
      </div>
    `;
  }

  // 3. INVENTORY & STOCK VIEW WRAPPER
  renderInventoryView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Inventory & Stock Management</h1>
          <p>Monitor SKUs, safety thresholds, cost valuation and profit margins</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('products'), 'products.csv')">
            ${Icons.download(14)} Export CSV
          </button>
          <button class="btn btn-primary" onclick="Inventory.openProductModal()">
            ${Icons.plus(15)} Add Product
          </button>
        </div>
      </div>

      <!-- Inventory KPI Counters -->
      <div class="kpi-grid" id="inventory-kpi-row"></div>

      <!-- Filters & Search Toolbar -->
      <div class="card" style="padding: 14px 18px; margin-bottom: 18px;">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 220px; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search SKU, name, or barcode..." oninput="Inventory.setSearch(this.value)" />
          </div>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <select class="form-select" style="width: 140px;" onchange="Inventory.filterCategory = this.value; Inventory.render();">
              <option value="All">All Categories</option>
              <option value="Grocery">Grocery</option>
              <option value="Dairy">Dairy</option>
              <option value="Oils">Oils</option>
              <option value="Snacks">Snacks</option>
              <option value="Beverages">Beverages</option>
              <option value="Personal Care">Personal Care</option>
              <option value="Household">Household</option>
            </select>

            <select class="form-select" style="width: 140px;" onchange="Inventory.filterStock = this.value; Inventory.render();">
              <option value="All">All Stock Status</option>
              <option value="Low">Low Stock Alerts</option>
              <option value="OutOfStock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Products Data Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU / Product</th>
              <th>Category</th>
              <th>Selling Price</th>
              <th>Cost & Margin</th>
              <th>Stock Level</th>
              <th>Barcode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="inventory-table-tbody"></tbody>
        </table>
      </div>
    `;
  }

  // 4. UDHAAR KHATA VIEW WRAPPER
  renderKhataView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Customer Udhaar Khata (Credit Ledger)</h1>
          <p>Track customer credit dues, settlements, and send WhatsApp payment reminders</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('customers'), 'customers.csv')">
            ${Icons.download(14)} Export Khata
          </button>
          <button class="btn btn-primary" onclick="Khata.openCustomerModal()">
            ${Icons.plus(15)} Add Customer
          </button>
        </div>
      </div>

      <!-- Khata Summary KPIs -->
      <div class="kpi-grid" id="khata-kpi-row"></div>

      <!-- Search & Filters -->
      <div class="card" style="padding: 14px 18px; margin-bottom: 18px;">
        <div style="position: relative;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
          <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search customer name or phone number..." oninput="Khata.setSearch(this.value)" />
        </div>
      </div>

      <!-- Customer Ledger Cards / List -->
      <div id="khata-customer-list"></div>
    `;
  }

  // 5. INVOICES & BILLING HISTORY VIEW
  renderInvoicesView(container) {
    const db = DB.getData();
    const invoices = db.invoices || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Billing History & Invoices</h1>
          <p>Review past sales transactions, reprint thermal receipts, and share WhatsApp invoices</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('invoices'), 'invoices.csv')">
            ${Icons.download(14)} Export Invoices CSV
          </button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 0;">
        ${invoices.length ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Grand Total</th>
                  <th>Payment Mode</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${inv.id}</td>
                    <td>${inv.date}</td>
                    <td style="font-weight: 600;">${inv.customerName || 'Walk-in'}</td>
                    <td>${inv.items ? inv.items.length : 0} items</td>
                    <td style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${inv.total.toLocaleString('en-IN')}</td>
                    <td><span class="badge badge-muted">${inv.paymentMode}</span></td>
                    <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${inv.id}'))">
                        ${Icons.print(14)} Receipt
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align: center; padding: 48px; color: var(--text-muted);">
            <div>${Icons.receipt(36)}</div>
            <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">No sales invoices recorded yet</div>
            <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="App.navigate('pos')">Open POS Billing</button>
          </div>
        `}
      </div>
    `;
  }

  // 6. EXPENSE MANAGEMENT VIEW (Requirement 5.E)
  renderExpensesView(container) {
    const db = DB.getData();
    const expenses = db.expenses || [];
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const categories = ['Rent', 'Utilities', 'Logistics', 'Salary', 'Maintenance', 'Snacks', 'Other'];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Daily Expense Management</h1>
          <p>Track store operational expenses, supplier freight, utility bills, and salary advances</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="App.openExpenseModal()">
            ${Icons.plus(15)} Record Expense
          </button>
        </div>
      </div>

      <!-- Expense KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Expenses Recorded</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${totalExpenses}" data-kpi-prefix="₹">₹0</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${expenses.length} entries tracked</div>
        </div>
      </div>

      <!-- Expense Table -->
      <div class="card" style="margin-bottom: 0;">
        <div class="card-header">
          <div class="card-title">${Icons.receipt(16)} Expense Ledger</div>
        </div>

        ${expenses.length ? `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map(e => `
                  <tr>
                    <td>${e.date}</td>
                    <td style="font-weight: 600;">${e.desc}</td>
                    <td><span class="badge badge-muted">${e.cat}</span></td>
                    <td style="font-weight: 700; color: var(--danger);" class="tnum">₹${e.amount.toLocaleString('en-IN')}</td>
                    <td><span class="badge ${e.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${e.status}</span></td>
                    <td>
                      <button class="btn btn-danger btn-sm" onclick="App.deleteExpense('${e.id}')" title="Delete">
                        ${Icons.trash(14)}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div>${Icons.wallet(32)}</div>
            <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">No expenses recorded yet</div>
            <button class="btn btn-primary btn-sm" style="margin-top: 12px;" onclick="App.openExpenseModal()">+ Add Expense</button>
          </div>
        `}
      </div>
    `;

    this.animateKpiNumbers();
  }

  // Open Record Expense Modal
  openExpenseModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="expense-modal" onclick="if(event.target === this) document.getElementById('expense-modal').remove()">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">${Icons.wallet(16)} Record Store Expense</div>
            <button class="topbar-icon-btn" onclick="document.getElementById('expense-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); App.saveExpense();">
              <div class="form-group">
                <label class="form-label">Expense Description *</label>
                <input type="text" id="exp-desc" class="form-input" required placeholder="e.g. Shop Electricity Bill" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="exp-cat" class="form-select">
                    <option value="Rent">Shop Rent</option>
                    <option value="Utilities">Electricity & Utilities</option>
                    <option value="Logistics">Freight & Logistics</option>
                    <option value="Salary">Staff Advance / Salary</option>
                    <option value="Maintenance">Store Maintenance</option>
                    <option value="Snacks">Tea & Refreshments</option>
                    <option value="Other">Other Miscellaneous</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (₹) *</label>
                  <input type="number" id="exp-amount" class="form-input" required min="1" placeholder="e.g. 1500" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Date *</label>
                  <input type="date" id="exp-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Payment Status</label>
                  <select id="exp-status" class="form-select">
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer" style="padding: 12px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('expense-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">${Icons.check(14)} Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveExpense() {
    const desc = document.getElementById('exp-desc').value.trim();
    const cat = document.getElementById('exp-cat').value;
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
    const date = document.getElementById('exp-date').value;
    const status = document.getElementById('exp-status').value;

    if (!desc || amount <= 0) {
      this.toast('warning', 'Missing Details', 'Please fill valid description and amount');
      return;
    }

    const newExp = {
      id: `E${Date.now().toString().slice(-5)}`,
      desc,
      cat,
      amount,
      date,
      status
    };

    DB.updateItem('expenses', newExp);
    document.getElementById('expense-modal').remove();
    this.toast('success', 'Saved', `Recorded ₹${amount} for ${desc}`);
    if (this.currentView === 'expenses') this.renderExpensesView(document.getElementById('main-view-container'));
  }

  deleteExpense(id) {
    if (confirm('Delete this expense entry?')) {
      DB.deleteItem('expenses', id);
      this.toast('info', 'Deleted', 'Expense entry removed');
      if (this.currentView === 'expenses') this.renderExpensesView(document.getElementById('main-view-container'));
    }
  }

  // 7. STAFF VIEW WRAPPER
  renderStaffView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Employees & Attendance Management</h1>
          <p>Staff records, 31-day attendance calendar and automatic monthly payroll calculation</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-primary" onclick="Staff.openAddStaffModal()">
            ${Icons.plus(15)} Add Employee
          </button>
        </div>
      </div>

      <div id="staff-content-view"></div>
    `;
  }

  // 8. ANALYTICS & P&L REPORTS VIEW WRAPPER
  renderAnalyticsView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Financial Reports & Profit/Loss (P&L)</h1>
          <p>Real-time revenue, Cost of Goods Sold (COGS), operating expenses, and net profit margins</p>
        </div>
        <div class="page-actions-row">
          <button class="btn btn-secondary" onclick="window.print()">
            ${Icons.print(14)} Print Report
          </button>
        </div>
      </div>

      <div id="analytics-content-view"></div>
    `;
  }

  // 9. SYSTEM SETTINGS VIEW (Zero manual API keys - Strict Netlify Environment Configuration)
  renderSettingsView(container) {
    const db = DB.getData();
    const shop = db.shop || {};

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Store Settings & Configurations</h1>
          <p>Manage store profile, GSTIN, UPI ID, system audio, and local database backups</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Store Information -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.store(16)} Shop Business Profile</div>
          </div>
          <form onsubmit="event.preventDefault(); App.saveShopSettings();">
            <div class="form-group">
              <label class="form-label">Shop Name *</label>
              <input type="text" id="set-shop-name" class="form-input" value="${shop.name || 'MyDukkan24 Mart'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Owner Name</label>
              <input type="text" id="set-shop-owner" class="form-input" value="${shop.owner || 'Mayur Singh'}" />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" id="set-shop-phone" class="form-input" value="${shop.phone || '+91 98765 43210'}" />
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN Tax Number</label>
                <input type="text" id="set-shop-gstin" class="form-input" value="${shop.gstin || '09AAAAA0000A1Z5'}" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">UPI ID for Payment QR *</label>
                <input type="text" id="set-shop-upi" class="form-input" value="${shop.upiId || 'mydukaan24@upi'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Default GST Tax Rate (%)</label>
                <input type="number" id="set-shop-tax" class="form-input" value="${shop.taxRate !== undefined ? shop.taxRate : 5}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Store Address</label>
              <textarea id="set-shop-address" class="form-textarea" rows="2">${shop.address || 'Hazratganj Market, Lucknow, Uttar Pradesh, India'}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">
              ${Icons.check(14)} Save Store Profile
            </button>
          </form>
        </div>

        <!-- System, AI Serverless & Backup Section -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Netlify AI Serverless Status (NO Manual Key Entry!) -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">
                ${Icons.sparkles(16)} Google Gemini AI Engine
              </div>
              <span class="badge badge-success">Netlify Serverless</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6;">
              MyDukkan24 AI Copilot is securely connected to the Netlify Serverless Backend (<code>/api/gemini</code>).
            </p>
            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin: 12px 0;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Security & Credentials:</div>
              <div style="font-size: 12.5px; color: var(--text-primary); margin-top: 4px; font-weight: 500;">
                ✓ API Key configured via Netlify Environment Variables (<code>GEMINI_API_KEY</code>).
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                Zero exposure in frontend browser storage or network payloads.
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="App.testNetlifyBackend()">
              ${Icons.refresh(14)} Test Backend Connection
            </button>
          </div>

          <!-- Database Backup & Portability -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.download(16)} Database Backup & Restore</div>
              <span class="badge badge-primary">Offline First</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6;">
              Your data is stored securely in this browser's zero-latency engine. Download regular backups to safeguard your business.
            </p>
            <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
              <button class="btn btn-secondary" onclick="App.exportFullBackup()">
                ${Icons.download(14)} Export Backup (.json)
              </button>
              <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
                ${Icons.upload(14)} Restore Backup
                <input type="file" accept=".json" style="display: none;" onchange="App.importFullBackup(event)" />
              </label>
              <button class="btn btn-danger btn-sm" onclick="App.resetToFactoryDefaults()">
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Save Shop Settings Form
  saveShopSettings() {
    const db = DB.getData();
    db.shop = {
      name: document.getElementById('set-shop-name').value.trim() || 'MyDukkan24 Mart',
      owner: document.getElementById('set-shop-owner').value.trim(),
      phone: document.getElementById('set-shop-phone').value.trim(),
      gstin: document.getElementById('set-shop-gstin').value.trim(),
      upiId: document.getElementById('set-shop-upi').value.trim() || 'mydukaan24@upi',
      taxRate: parseFloat(document.getElementById('set-shop-tax').value) || 0,
      address: document.getElementById('set-shop-address').value.trim(),
      currency: "₹"
    };
    DB.saveData(db);
    this.updateHeaderStoreName();
    this.toast('success', 'Saved', 'Store profile updated successfully');
  }

  // Test Netlify Backend Probe
  async testNetlifyBackend() {
    this.toast('info', 'Connecting...', 'Testing Netlify serverless endpoint...');
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Ping test. Reply with OK.' })
      });
      const data = await res.json();
      if (res.ok && data.text) {
        this.toast('success', 'Online!', 'Netlify AI Backend is connected and active.');
      } else {
        this.toast('warning', 'Notice', data.error || 'Server responded with status ' + res.status);
      }
    } catch (e) {
      this.toast('warning', 'Check Environment', 'Netlify function reachable in production or local netlify dev.');
    }
  }

  // 10. HELP & SHORTCUTS VIEW
  renderHelpView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Help & Keyboard Shortcuts</h1>
          <p>High-efficiency keyboard commands engineered for rapid checkout at retail counters</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">${Icons.pos(16)} POS Billing Shortcuts</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Shortcut Key</th>
                <th>Action</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700; background: var(--bg-input); padding: 3px 8px; border-radius: 4px;">Ctrl + K</code></td>
                <td>Open Universal Barcode Scanner & Search</td>
                <td>Anywhere in the application</td>
              </tr>
              <tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700; background: var(--bg-input); padding: 3px 8px; border-radius: 4px;">F2</code></td>
                <td>Instantly jump to Quick Billing POS Terminal</td>
                <td>Anywhere</td>
              </tr>
              <tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700; background: var(--bg-input); padding: 3px 8px; border-radius: 4px;">F8</code></td>
                <td>Select Cash Payment Tender Mode</td>
                <td>POS Terminal</td>
              </tr>
              <tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700; background: var(--bg-input); padding: 3px 8px; border-radius: 4px;">F9</code></td>
                <td>Select Dynamic UPI QR Payment</td>
                <td>POS Terminal</td>
              </tr>
              <tr>
                <td><code style="font-family: var(--font-mono); font-weight: 700; background: var(--bg-input); padding: 3px 8px; border-radius: 4px;">F10</code></td>
                <td>Assign Bill to Customer Udhaar Khata</td>
                <td>POS Terminal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Smart Notification Popover (Requirement 5.G)
  toggleNotificationPopover() {
    if (this.isNotificationOpen) {
      this.closeNotificationPopover();
    } else {
      this.openNotificationPopover();
    }
  }

  openNotificationPopover() {
    const container = document.getElementById('notification-popover-container');
    if (!container) return;

    const db = DB.getData();
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];

    const lowStock = products.filter(p => p.stock <= p.minStock);
    const debtors = customers.filter(c => (c.balanceDue || 0) > 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayInvoices = invoices.filter(i => i.date === todayStr);
    const todaySales = todayInvoices.reduce((s, i) => s + (i.paid || 0), 0);

    const notifications = [];

    if (lowStock.length) {
      notifications.push({
        type: 'warning',
        title: `${lowStock.length} Products Low in Stock`,
        desc: `${lowStock.map(p => p.name).slice(0, 2).join(', ')}${lowStock.length > 2 ? '...' : ''} need reordering.`,
        action: () => { App.navigate('inventory'); Inventory.filterStock = 'Low'; Inventory.render(); }
      });
    }

    if (debtors.length) {
      const totalDue = debtors.reduce((s, c) => s + c.balanceDue, 0);
      notifications.push({
        type: 'danger',
        title: `₹${totalDue.toLocaleString('en-IN')} Udhaar Pending`,
        desc: `${debtors.length} customer debts waiting for collection.`,
        action: () => App.navigate('udhaar')
      });
    }

    notifications.push({
      type: 'info',
      title: "Today's Register Status",
      desc: `₹${todaySales.toLocaleString('en-IN')} billed across ${todayInvoices.length} sales receipts.`,
      action: () => App.navigate('dashboard')
    });

    container.innerHTML = `
      <div class="notification-popover">
        <div class="notification-header">
          <span>Notifications & Alerts</span>
          <span class="badge badge-muted">${notifications.length}</span>
        </div>
        <div class="notification-list">
          ${notifications.map((n, idx) => `
            <div class="notification-item" onclick="App.handleNotifClick(${idx})">
              <span style="color: ${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--primary)'};">
                ${Icons.alert(16)}
              </span>
              <div>
                <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">${n.title}</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${n.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this._activeNotifs = notifications;
    this.isNotificationOpen = true;
  }

  handleNotifClick(idx) {
    if (this._activeNotifs && this._activeNotifs[idx] && this._activeNotifs[idx].action) {
      this._activeNotifs[idx].action();
    }
    this.closeNotificationPopover();
  }

  closeNotificationPopover() {
    const container = document.getElementById('notification-popover-container');
    if (container) container.innerHTML = '';
    this.isNotificationOpen = false;
  }

  updateNotificationBadge() {
    const db = DB.getData();
    const products = db.products || [];
    const lowStock = products.filter(p => p.stock <= p.minStock);
    const badge = document.getElementById('notification-badge-count');
    if (badge) {
      if (lowStock.length > 0) {
        badge.textContent = lowStock.length;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // Backup Utilities
  exportFullBackup() {
    const db = DB.getData();
    const jsonStr = JSON.stringify(db, null, 2);
    DB.downloadFile(jsonStr, `mydukkan24_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    this.toast('success', 'Backup Exported', 'Full database downloaded securely');
  }

  importFullBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.products && parsed.customers) {
          DB.saveData(parsed);
          this.toast('success', 'Restored', 'Database restored successfully');
          setTimeout(() => location.reload(), 1000);
        } else {
          throw new Error('Invalid schema');
        }
      } catch (err) {
        this.toast('danger', 'Error', 'Invalid backup file format');
      }
    };
    reader.readAsText(file);
  }

  resetToFactoryDefaults() {
    if (confirm('Reset entire application data to default Kirana demo dataset? All current custom items will be replaced.')) {
      localStorage.removeItem('mydukaan24_prod_db');
      location.reload();
    }
  }

  // Keyboard Shortcuts Listener
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        BarcodeScanner.openScannerModal();
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.navigate('pos');
      }
    });
  }

  // Mobile Drawer Toggle
  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  // Theme Toggle (Dark <-> Light)
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    const db = DB.getData();
    db.theme = next;
    DB.saveData(db);
    this.updateThemeIcons();
  }

  applyTheme() {
    const db = DB.getData();
    const theme = db.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  updateHeaderStoreName() {
    const db = DB.getData();
    const nameEl = document.getElementById('topbar-shop-name');
    if (nameEl) nameEl.textContent = (db.shop && db.shop.name) || 'MyDukkan24 Store';
  }

  // Toast Notification System
  toast(type, title, desc = "") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.style.borderLeft = `3px solid ${type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)'}`;

    toastEl.innerHTML = `
      <div style="color: ${type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)'};">
        ${Icons.check(16)}
      </div>
      <div>
        <div class="toast-title">${title}</div>
        ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
      </div>
    `;

    container.appendChild(toastEl);
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(10px)';
      toastEl.style.transition = 'all 0.2s';
      setTimeout(() => toastEl.remove(), 200);
    }, 2800);
  }
}

window.App = new AppController();
