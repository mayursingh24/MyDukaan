/**
 * MyDukkan24 — Enterprise Master Application Router, Views & Workflow Controller
 * Clean, human-designed SaaS architecture for high-performance retail operations.
 */

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.isNotificationOpen = false;
    this._showFirebaseConfigEditor = false;
    this.init();
  }

  escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  init() {
    this.applyTheme();
    this.setupIcons();
    this.initKeyboardShortcuts();
    this.updateNotificationBadge();
    this.updateHeaderStoreName();
    this.updateI18nLabels();
    this.initNetworkMonitor();
    this.navigate(this.currentView);

    // Listen for PWA native installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
    });

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

    // Toggle Mobile Sticky Bar visibility (Only in POS view; CSS handles <= 900px)
    const mobilePosBar = document.getElementById('mobile-pos-sticky-bar');
    if (mobilePosBar) {
      mobilePosBar.classList.toggle('pos-active', viewName === 'pos');
    }

    // Close mobile drawer if open
    this.closeMobileSidebar();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderViewOnly(viewName);
  }

  renderViewOnly(viewName) {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    container.classList.toggle('is-pos-view', viewName === 'pos');

    switch (viewName) {
      case 'dashboard':
        this.renderDashboardView(container);
        break;

      case 'pos':
        this.renderPOSView(container);
        if (window.POS) {
          POS.init();
          document.querySelectorAll('.cat-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.cat === POS.activeCategory);
          });
        }
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

      case 'purchases':
      case 'suppliers':
        if (window.Purchases) Purchases.render(container);
        break;

      case 'download':
      case 'app-download':
        this.renderDownloadAppView(container);
        break;

      case 'help':
        this.renderHelpView(container);
        break;

      default:
        this.renderDashboardView(container);
    }

    this.updateNotificationBadge();
  }

  refreshActiveViewFromCloud() {
    if (document.querySelector('.modal-backdrop, .scanner-modal-backdrop')) return;
    const container = document.getElementById('main-view-container');
    if (!container) return;
    const activeEl = document.activeElement;
    if (activeEl && container.contains(activeEl) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
      return;
    }
    const scrollY = window.scrollY;
    const prevSearch = document.getElementById('pos-search-input')?.value || '';
    this.renderViewOnly(this.currentView);
    if (this.currentView === 'pos' && prevSearch) {
      const input = document.getElementById('pos-search-input');
      if (input) input.value = prevSearch;
    }
    if (scrollY > 0) window.scrollTo(0, scrollY);
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
    const totalInventoryValue = Math.round(products.reduce((s, p) => s + ((Number(p.cost) || 0) * (Number(p.stock) || 0)), 0));
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
      <div class="responsive-split-grid" style="margin-bottom: 24px;">
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
                    <th class="hide-mobile-col">Date</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th class="hide-mobile-col">Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.slice(0, 6).map(inv => `
                    <tr>
                      <td style="font-family: var(--font-mono); font-weight: 600; font-size: 12.5px;">${inv.id}</td>
                      <td class="hide-mobile-col">${inv.date}</td>
                      <td style="font-weight: 500;">${inv.customerName || 'Walk-in Customer'}</td>
                      <td style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${inv.total.toLocaleString('en-IN')}</td>
                      <td class="hide-mobile-col">
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
        <div style="display: flex; flex-direction: column; gap: 18px; min-width: 0;">
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
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 10px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${p.name}</div>
                    <div style="font-size: 11px; color: var(--danger); font-weight: 500;">
                      Stock: ${p.stock} ${p.unit} (Min: ${p.minStock})
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm" style="flex-shrink: 0;" onclick="Inventory.quickRestock('${p.id}')">
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
            <div class="quick-actions-grid">
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
              <input type="text" id="pos-search-input" class="form-input pos-search-input" placeholder="Search product name, category, or scan barcode..." oninput="POS.setSearchQuery(this.value)" onkeydown="POS.handleSearchKeydown(event)" autofocus />
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
      <div class="card" style="padding: 14px 16px; margin-bottom: 18px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1 1 200px; min-width: 0; width: 100%; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search SKU, name, or barcode..." oninput="Inventory.setSearch(this.value)" />
          </div>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1 1 220px; min-width: 0;">
            <select class="form-select" style="flex: 1 1 125px; min-width: 0;" onchange="Inventory.filterCategory = this.value; Inventory.render();">
              <option value="All">All Categories</option>
              <option value="Grocery">Grocery</option>
              <option value="Dairy">Dairy</option>
              <option value="Oils">Oils</option>
              <option value="Snacks">Snacks</option>
              <option value="Beverages">Beverages</option>
              <option value="Personal Care">Personal Care</option>
              <option value="Household">Household</option>
            </select>

            <select class="form-select" style="flex: 1 1 125px; min-width: 0;" onchange="Inventory.filterStock = this.value; Inventory.render();">
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
                  <th class="hide-mobile-col">Date</th>
                  <th>Customer</th>
                  <th class="hide-mobile-col">Items</th>
                  <th>Grand Total</th>
                  <th class="hide-mobile-col">Payment Mode</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${inv.id}</td>
                    <td class="hide-mobile-col">${inv.date}</td>
                    <td style="font-weight: 600;">${inv.customerName || 'Walk-in'}</td>
                    <td class="hide-mobile-col">${inv.items ? inv.items.length : 0} items</td>
                    <td style="font-weight: 700; color: var(--text-primary);" class="tnum">₹${inv.total.toLocaleString('en-IN')}</td>
                    <td class="hide-mobile-col"><span class="badge badge-muted">${inv.paymentMode}</span></td>
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
                  <th class="hide-mobile-col">Category</th>
                  <th>Amount</th>
                  <th class="hide-mobile-col">Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map(e => `
                  <tr>
                    <td>${e.date}</td>
                    <td style="font-weight: 600;">${e.desc}</td>
                    <td class="hide-mobile-col"><span class="badge badge-muted">${e.cat}</span></td>
                    <td style="font-weight: 700; color: var(--danger);" class="tnum">₹${e.amount.toLocaleString('en-IN')}</td>
                    <td class="hide-mobile-col"><span class="badge ${e.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${e.status}</span></td>
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

  // 9. SYSTEM SETTINGS VIEW (Zero manual Gemini keys in cloud - Dual Offline + Firebase Sync)
  renderSettingsView(container) {
    const db = DB.getData();
    const shop = db.shop || {};
    const theme = db.theme || 'dark';
    const accent = db.accent || 'blue';
    const isSound = db.soundEnabled !== false;
    const dbBytes = (JSON.stringify(db).length / 1024).toFixed(1);
    const cloudStatus = window.CloudSync
      ? CloudSync.getStatusSummary()
      : {
          configured: false,
          signedIn: false,
          online: navigator.onLine !== false,
          pending: 0,
          badgeClass: 'badge-muted',
          label: 'Local Only'
        };
    const cloudKpiLabel = cloudStatus.signedIn
      ? (cloudStatus.pending > 0 ? `${cloudStatus.pending} queued for cloud` : 'Cloud Synced ✓')
      : (cloudStatus.configured ? 'Sign In to Sync' : 'Offline Ready');

    const accents = [
      { id: 'blue', name: 'Electric Blue', color: '#2563EB' },
      { id: 'emerald', name: 'Emerald Green', color: '#10B981' },
      { id: 'purple', name: 'Royal Violet', color: '#8B5CF6' },
      { id: 'amber', name: 'Sunset Amber', color: '#F59E0B' },
      { id: 'rose', name: 'Crimson Rose', color: '#F43F5E' }
    ];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Store Settings & Configurations</h1>
          <p>Manage business identity, Firebase Cloud + Offline dual storage, receipts & themes</p>
        </div>
      </div>

      <!-- Settings Quick Metric Bar -->
      <div class="kpi-grid" style="margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Store Identity</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.store(16)}
            </div>
          </div>
          <div class="kpi-val" style="font-size: 16px; font-weight: 800; word-break: break-word;">${this.escapeHtml(shop.name || 'MyDukkan24 Mart')}</div>
          <div class="kpi-trend" style="color: var(--text-muted); font-size: 11px; overflow-wrap: anywhere;">UPI: ${this.escapeHtml(shop.upiId || '6306437348@upi')}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">UI Theme</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${theme === 'dark' ? Icons.moon(16) : Icons.sun(16)}
            </div>
          </div>
          <div class="kpi-val" style="font-size: 16px; font-weight: 800; text-transform: capitalize;">${theme} Mode</div>
          <div class="kpi-trend">
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px; margin-top: 2px;" onclick="App.toggleTheme(); App.renderSettingsView(document.getElementById('main-view-container'));">
              Switch to ${theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Active Accent</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></span>
            </div>
          </div>
          <div class="kpi-val" style="font-size: 16px; font-weight: 800; text-transform: capitalize;">${accent}</div>
          <div class="kpi-trend" style="color: var(--primary); font-weight: 600; font-size: 11px;">Dynamic Palette</div>
        </div>

        <div class="kpi-card" style="cursor: pointer;" onclick="document.getElementById('firebase-cloud-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });" title="Jump to Firebase Cloud Sync">
          <div class="kpi-top">
            <span class="kpi-title">Offline + Cloud DB</span>
            <div class="kpi-icon-badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
              ${Icons.database(16)}
            </div>
          </div>
          <div class="kpi-val" style="font-size: 16px; font-weight: 800; color: #10B981;">${dbBytes} KB</div>
          <div id="settings-cloud-kpi-trend" class="kpi-trend" style="color: var(--text-muted); font-size: 11px;">${db.products.length} SKUs • ${cloudKpiLabel}</div>
        </div>
      </div>

      <!-- Dual Offline + Online Firebase Cloud Sync Card -->
      <div class="card" id="firebase-cloud-card" style="margin-bottom: 20px;">
        <div class="card-header" style="flex-wrap: wrap; gap: 8px;">
          <div class="card-title">${Icons.cloud(17)} Firebase Cloud Sync (Online + Offline Storage)</div>
          <span id="firebase-cloud-card-badge" class="badge ${cloudStatus.badgeClass}">${this.escapeHtml(cloudStatus.label)}</span>
        </div>
        <div id="firebase-cloud-card-body">
          ${this.renderFirebaseCloudBody()}
        </div>
      </div>

      <div class="responsive-equal-grid">
        <!-- Column 1: Store Profile & Receipt Settings -->
        <div style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">
          <!-- Store Profile Card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.store(16)} Shop Business Profile</div>
              <span class="badge badge-primary">Live Identity</span>
            </div>
            <form onsubmit="event.preventDefault(); App.saveShopSettings();">
              <div class="form-group">
                <label class="form-label">Shop Name *</label>
                <input type="text" id="set-shop-name" class="form-input" value="${shop.name || 'MyDukkan24 Mart'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Owner / Cashier Name</label>
                <input type="text" id="set-shop-owner" class="form-input" value="${shop.owner || 'Mayur Singh'}" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Phone Number *</label>
                  <input type="text" id="set-shop-phone" class="form-input" value="${shop.phone || '+91 6306437348'}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">GSTIN Tax ID</label>
                  <input type="text" id="set-shop-gstin" class="form-input" value="${shop.gstin || '09AAAAA0000A1Z5'}" placeholder="09AAAAA0000A1Z5" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">UPI ID for Dynamic Payments *</label>
                  <input type="text" id="set-shop-upi" class="form-input" value="${shop.upiId || '6306437348@upi'}" required placeholder="yourname@upi" />
                </div>
                <div class="form-group">
                  <label class="form-label">Default GST Tax Rate (%)</label>
                  <select id="set-shop-tax" class="form-select">
                    <option value="0" ${shop.taxRate === 0 ? 'selected' : ''}>0% (Exempted)</option>
                    <option value="5" ${shop.taxRate === 5 || !shop.taxRate ? 'selected' : ''}>5% Standard GST</option>
                    <option value="12" ${shop.taxRate === 12 ? 'selected' : ''}>12% FMCG / Processed</option>
                    <option value="18" ${shop.taxRate === 18 ? 'selected' : ''}>18% Goods / Services</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Store Address</label>
                <textarea id="set-shop-address" class="form-textarea" rows="2">${shop.address || 'Hazratganj Market, Lucknow, Uttar Pradesh, India'}</textarea>
              </div>

              <!-- Live Store UPI QR Preview -->
              <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 14px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${encodeURIComponent(shop.upiId || '6306437348@upi')}&pn=${encodeURIComponent(shop.name || 'MyDukkan24')}" alt="Store UPI QR" style="width: 72px; height: 72px; border-radius: 8px; background: #fff; padding: 4px; display: block; flex-shrink: 0;" />
                <div style="flex: 1; min-width: 170px;">
                  <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Active Dynamic UPI QR</div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px; overflow-wrap: anywhere;">VPA: <code style="color: var(--primary);">${shop.upiId || '6306437348@upi'}</code></div>
                  <div style="font-size: 11px; color: var(--success); font-weight: 600; margin-top: 3px;">Accepts PhonePe, GPay, Paytm, BHIM</div>
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
                ${Icons.check(14)} Save Store Profile
              </button>
            </form>
          </div>

          <!-- Thermal Receipt Format Card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.receipt(16)} Thermal Receipt Slip Setup</div>
              <button class="btn btn-secondary btn-sm" onclick="App.testPrintSampleSlip()">
                ${Icons.print(14)} Preview Slip
              </button>
            </div>
            <form onsubmit="event.preventDefault(); App.saveReceiptSettings();">
              <div class="form-group">
                <label class="form-label">Receipt Header Tagline</label>
                <input type="text" id="set-rcpt-header" class="form-input" value="${shop.rcptHeader || 'HAZRATGANJ, LUCKNOW • TAX INVOICE'}" placeholder="e.g. HAZRATGANJ MARKET • TAX INVOICE" />
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Footer Thank You Note</label>
                <input type="text" id="set-rcpt-footer" class="form-input" value="${shop.rcptFooter || 'THANK YOU FOR SHOPPING! VISIT AGAIN'}" placeholder="e.g. THANK YOU FOR SHOPPING!" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Paper Slip Width</label>
                  <select id="set-rcpt-width" class="form-select">
                    <option value="80mm" ${shop.rcptWidth === '80mm' || !shop.rcptWidth ? 'selected' : ''}>80mm (Standard POS Printer)</option>
                    <option value="58mm" ${shop.rcptWidth === '58mm' ? 'selected' : ''}>58mm (Compact Mobile Printer)</option>
                  </select>
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                  <button type="submit" class="btn btn-secondary" style="width: 100%; justify-content: center;">
                    ${Icons.check(14)} Save Receipt Format
                  </button>
                </div>
              </div>
            </form>
          </div>

          <!-- Daily Cash Counter & Closing Register Card -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.wallet(16)} Daily Cash Counter & Closing Register</div>
              <span class="badge badge-success">Counter #1 Live</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">
              Monitor real-time cash drawer tally, digital UPI collections, and print day-end reconciliation reports.
            </p>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px;">
              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Today's Cash In Drawer</div>
                <div style="font-size: 18px; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${(db.invoices || []).filter(i => i.paymentMode === 'Cash').reduce((sum, i) => sum + (Number(i.paid) || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Today's UPI Collection</div>
                <div style="font-size: 18px; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${(db.invoices || []).filter(i => i.paymentMode === 'UPI').reduce((sum, i) => sum + (Number(i.paid) || 0), 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="App.openCashDrawerModal()">
                ${Icons.receipt(14)} View Closing Sheet & Print
              </button>
            </div>
          </div>
        </div>

        <!-- Column 2: Theme Studio, Audio & Database Backups -->
        <div style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">
          <!-- Dynamic Accent Theme Palette Studio -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.sparkles(16)} Dynamic Accent Color Studio</div>
              <span class="badge badge-primary">${accent.toUpperCase()}</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
              Personalize your shop terminal with vibrant accent themes. Updates all buttons, badges, tabs, and focus rings across the platform.
            </p>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
              ${accents.map(acc => `
                <button class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-color: ${accent === acc.id ? 'var(--primary)' : 'var(--border-subtle)'}; background: ${accent === acc.id ? 'var(--primary-light)' : 'var(--bg-card)'};" onclick="App.setAccentTheme('${acc.id}')">
                  <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${acc.color}; box-shadow: 0 0 6px ${acc.color};"></span>
                  <span style="font-weight: ${accent === acc.id ? '700' : '500'}; color: ${accent === acc.id ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-size: 12px;">${acc.name}</span>
                  ${accent === acc.id ? `<span style="color: var(--primary); font-size: 11px;">✓</span>` : ''}
                </button>
              `).join('')}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="flex: 1; min-width: 140px;">
                <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Base Display Mode</div>
                <div style="font-size: 11px; color: var(--text-muted);">Current: ${theme === 'dark' ? 'Pro Dark SaaS' : 'Clean Light Minimal'}</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="App.toggleTheme(); App.renderSettingsView(document.getElementById('main-view-container'));">
                ${theme === 'dark' ? Icons.sun(14) : Icons.moon(14)} Switch to ${theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            <!-- Language Switcher Studio -->
            <div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div style="flex: 1; min-width: 150px;">
                <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">🌐 Display Language / भाषा</div>
                <div style="font-size: 11px; color: var(--text-muted);">Dynamic localization across menus, bills & reports</div>
              </div>
              <select class="form-select" style="width: auto; min-width: 130px; font-size: 12px; padding: 6px 10px;" onchange="I18n.setLanguage(this.value); App.renderSettingsView(document.getElementById('main-view-container'));">
                <option value="en" ${I18n.getLanguage() === 'en' ? 'selected' : ''}>English</option>
                <option value="hi" ${I18n.getLanguage() === 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option>
                <option value="hinglish" ${I18n.getLanguage() === 'hinglish' ? 'selected' : ''}>Hinglish</option>
              </select>
            </div>
          </div>

          <!-- Sound Effects & POS Hardware Audio -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.volume(16)} POS Audio Synthesizer</div>
              <span class="badge ${isSound ? 'badge-success' : 'badge-danger'}">${isSound ? 'Active' : 'Muted'}</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
              Hardware barcode scanner frequency beeps and cash settlement chimes via Web Audio API.
            </p>
            <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="App.toggleSound()">
                ${isSound ? Icons.volumeX(14) : Icons.volume(14)} ${isSound ? 'Mute Sounds' : 'Turn Sounds ON'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.testAudioBeep()">
                🔊 Test Scan Beep
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.testCashChime()">
                🔔 Test Cash Chime
              </button>
            </div>
          </div>

          <!-- Complete Database Backups & Portability -->
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div class="card-title">${Icons.download(16)} Data Backups & Migration</div>
              <span class="badge badge-primary">Offline First</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
              Export full store database (products, bills, customers, khata balances, expenses) into an encrypted portable file.
            </p>
            <div class="quick-actions-grid" style="margin-top: 14px;">
              <button class="btn btn-secondary btn-sm" onclick="App.exportFullBackup()">
                ${Icons.download(14)} Export Backup (.json)
              </button>
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0; justify-content: center;">
                ${Icons.upload(14)} Restore Backup (.json)
                <input type="file" accept=".json" style="display: none;" onchange="App.importFullBackup(event)" />
              </label>
              <button class="btn btn-secondary btn-sm" onclick="DB.downloadFile(DB.exportCSV('products'), 'products.csv')">
                ${Icons.package(14)} Export Products CSV
              </button>
              <button class="btn btn-secondary btn-sm" onclick="DB.downloadFile(DB.exportCSV('customers'), 'customers_khata.csv')">
                ${Icons.users(14)} Export Khata CSV
              </button>
            </div>

            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="font-size: 11.5px; color: var(--text-muted);">Reset entire local DB to fresh demo data:</span>
              <button class="btn btn-danger btn-sm" onclick="App.resetToFactoryDefaults()">
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderFirebaseCloudBody() {
    const cloud = window.CloudSync;
    if (!cloud) {
      return `<div style="font-size: 12.5px; color: var(--text-muted);">Cloud Sync module unavailable — running on offline local storage.</div>`;
    }

    const cfg = cloud.getSavedConfig();
    const status = cloud.getStatusSummary();
    const pending = cloud.getPendingCount();
    const host = this.escapeHtml(window.location.hostname || 'mydukaan-eta.vercel.app');
    const escErr = cloud.lastError ? this.escapeHtml(cloud.lastError) : '';
    const hasLocalOverride = typeof cloud.hasLocalOverrideConfig === 'function' ? cloud.hasLocalOverrideConfig() : Boolean(cfg);

    // 1. Config Setup / Editor View
    if (!cfg || this._showFirebaseConfigEditor) {
      const prefill = cfg && hasLocalOverride ? this.escapeHtml(JSON.stringify(cfg, null, 2)) : '';
      return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; align-items: start;">
          <div style="min-width: 0;">
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 10px;">
              Store every product, bill, Khata balance, supplier & expense <strong>both offline on this device</strong> (0ms LocalStorage + IndexedDB) and <strong>online in your private Firebase Firestore</strong> across multiple devices.
            </p>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11.5px; color: var(--text-muted); background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 10px;">
              <div>✓ <strong>Offline First:</strong> Works with zero internet; queues all bills & auto-syncs online.</div>
              <div>✓ <strong>Google + Email Login:</strong> Private per-owner cloud isolation under <code>/users/{uid}/</code>.</div>
              <div>✓ <strong>Privacy Safe:</strong> Gemini API keys stay local on device & are never uploaded.</div>
            </div>
            <details style="font-size: 11.5px; color: var(--text-secondary); background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <summary style="cursor: pointer; font-weight: 700; color: var(--text-primary);">📋 Firebase Console Setup Steps (Spark Free Plan)</summary>
              <ol style="margin: 8px 0 0; padding-left: 18px; line-height: 1.65;">
                <li>Open <strong>Firebase Console</strong> ➔ <strong>Authentication</strong> ➔ enable <strong>Google</strong> &amp; <strong>Email/Password</strong>.</li>
                <li>In <strong>Authentication ➔ Settings ➔ Authorized domains</strong>, add <code style="overflow-wrap: anywhere;">${host}</code>.</li>
                <li>Create <strong>Firestore Database (Standard Edition)</strong> and paste rules from repo <code>firestore.rules</code>.</li>
                <li>Copy your Web App <code>firebaseConfig</code> from <strong>Project Settings</strong> &amp; paste on the right.</li>
              </ol>
            </details>
          </div>

          <div style="min-width: 0;">
            ${escErr ? `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); margin-bottom: 10px; overflow-wrap: anywhere;">${escErr}</div>` : ''}
            <label class="form-label">Paste Firebase Web Config (JSON or JS Snippet) *</label>
            <textarea id="fb-config-input" class="form-textarea" rows="6" style="font-family: var(--font-mono); font-size: 11.5px; line-height: 1.45; margin-bottom: 10px;" placeholder='const firebaseConfig = {\n  apiKey: "YOUR_API_KEY",\n  authDomain: "your-shop.firebaseapp.com",\n  projectId: "your-shop-id",\n  appId: "1:123456789:web:abcdef"\n};'>${prefill}</textarea>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="fb-save-cfg-btn" class="btn btn-primary btn-sm" style="flex: 1 1 160px; justify-content: center;" onclick="App.saveFirebaseConfig()">
                ${Icons.check(14)} Save & Connect Firebase
              </button>
              ${cfg ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="App.toggleFirebaseConfigEdit(false)">
                  Cancel
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 2. Configured, waiting for User Sign-In
    if (!status.signedIn) {
      const activeTab = cloud.authTab === 'signup' ? 'signup' : 'signin';
      return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 16px; align-items: start;">
          <div style="min-width: 0;">
            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 12px;">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Linked Firebase Project</div>
              <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); font-family: var(--font-mono); margin-top: 2px; overflow-wrap: anywhere;">${this.escapeHtml(cfg.projectId)}</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">IndexedDB Persistence: <strong>${this.escapeHtml(cloud.persistenceMode || 'ready')}</strong></div>
            </div>

            ${escErr ? `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); margin-bottom: 10px; overflow-wrap: anywhere;">${escErr}</div>` : ''}
            ${!status.online ? `<div style="background: var(--warning-light); border: 1px solid var(--warning-border); color: var(--warning); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); margin-bottom: 10px;">System is currently offline. Local billing keeps working; connect to the internet once to sign in &amp; sync.</div>` : ''}

            <button type="button" class="btn btn-primary" style="width: 100%; justify-content: center; margin-bottom: 10px;" onclick="CloudSync.signInWithGoogle()">
              <span style="font-weight: 900; font-size: 14px;">G</span> Continue with Google
            </button>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm" style="flex: 1 1 110px; justify-content: center;" onclick="App.toggleFirebaseConfigEdit(true)">
                ${Icons.edit(13)} Edit Config
              </button>
              ${hasLocalOverride ? `
                <button type="button" class="btn btn-danger btn-sm" style="flex: 1 1 110px; justify-content: center;" onclick="App.disconnectFirebase()">
                  Disconnect
                </button>
              ` : ''}
            </div>
          </div>

          <div style="min-width: 0; background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
              <button type="button" class="btn btn-sm ${activeTab === 'signin' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; justify-content: center;" onclick="App.setFirebaseAuthTab('signin')">Sign In</button>
              <button type="button" class="btn btn-sm ${activeTab === 'signup' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; justify-content: center;" onclick="App.setFirebaseAuthTab('signup')">Create Account</button>
            </div>
            <form onsubmit="event.preventDefault(); App.submitFirebaseAuth();">
              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label">Store Owner Email *</label>
                <input type="email" id="fb-auth-email" class="form-input" required placeholder="owner@mydukkan24.com" />
              </div>
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Password (min 6 chars) *</label>
                <input type="password" id="fb-auth-password" class="form-input" required minlength="6" placeholder="••••••" />
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <button type="submit" class="btn btn-success btn-sm" style="flex: 1 1 150px; justify-content: center;">
                  ${Icons.lock(13)} ${activeTab === 'signup' ? 'Create Account & Sync' : 'Sign In & Sync Store'}
                </button>
                ${activeTab === 'signin' ? `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="App.sendFirebaseReset()">
                    Forgot Password?
                  </button>
                ` : ''}
              </div>
            </form>
          </div>
        </div>
      `;
    }

    // 3. Connected & Signed In (Dual Online + Offline Sync Active)
    const syncMeta = window.DB ? DB.getSyncMeta() : {};
    const syncedTs = cloud.lastSyncedAt || syncMeta.lastSyncedAt || 0;
    const syncedStr = syncedTs
      ? new Date(syncedTs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Initial sync in progress';
    const uidShort = this.escapeHtml((cloud.user && cloud.user.uid ? cloud.user.uid : '').slice(0, 10));
    const userEmail = this.escapeHtml((cloud.user && (cloud.user.email || cloud.user.displayName)) || 'Connected Owner');

    return `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="min-width: 0; flex: 1 1 200px;">
            <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); overflow-wrap: anywhere;">${userEmail}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px; overflow-wrap: anywhere;">
              Project: ${this.escapeHtml(cfg.projectId)} • UID: ${uidShort}...
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="CloudSync.flushPending(true)">
              ${Icons.refresh(13)} Sync Now
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="CloudSync.forceUploadAll()">
              ${Icons.upload(13)} Push Full Backup
            </button>
          </div>
        </div>

        ${escErr ? `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); overflow-wrap: anywhere;"><strong>Sync Notice:</strong> ${escErr}</div>` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr)); gap: 10px;">
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Device Offline Cache</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #10B981; margin-top: 3px;">LocalStorage + IndexedDB</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Offline Sync Queue</div>
            <div style="font-size: 12.5px; font-weight: 700; color: ${pending > 0 ? 'var(--warning)' : 'var(--text-primary)'}; margin-top: 3px;">${pending} Pending Change(s)</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Last Cloud Sync</div>
            <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary); margin-top: 3px;">${this.escapeHtml(syncedStr)}</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Security Isolation</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #60A5FA; margin-top: 3px;">Owner Only (Keys Excluded)</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; padding-top: 4px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.toggleFirebaseConfigEdit(true)">
            ${Icons.edit(13)} Change Config
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="CloudSync.signOutUser()">
            ${Icons.logOut(13)} Sign Out
          </button>
          ${hasLocalOverride ? `
            <button type="button" class="btn btn-danger btn-sm" onclick="App.disconnectFirebase()">
              Disconnect Project
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  async saveFirebaseConfig() {
    if (!window.CloudSync) return;
    const input = document.getElementById('fb-config-input');
    const raw = input ? input.value : '';
    const btn = document.getElementById('fb-save-cfg-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Connecting...';
    }
    const res = await CloudSync.saveConfig(raw);
    if (!res.ok) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${Icons.check(14)} Save & Connect Firebase`;
      }
      this.toast('danger', 'Invalid Firebase Config', res.error);
      return;
    }
    this._showFirebaseConfigEditor = false;
    this.toast('success', 'Firebase Configured', `Linked project: ${res.config.projectId}`);
    CloudSync.notifyUI();
  }

  toggleFirebaseConfigEdit(show) {
    this._showFirebaseConfigEditor = Boolean(show);
    if (window.CloudSync) CloudSync.notifyUI();
  }

  async disconnectFirebase() {
    if (confirm('Disconnect this browser\'s Firebase override? Your local offline store data will NOT be deleted.')) {
      this._showFirebaseConfigEditor = false;
      if (window.CloudSync) await CloudSync.clearConfig();
      const usingDefault = window.CloudSync && typeof CloudSync.isUsingDefaultConfig === 'function' && CloudSync.isUsingDefaultConfig();
      this.toast('info', 'Firebase Updated', usingDefault ? 'Reverted to default Firebase project config.' : 'Switched back to local-only mode.');
    }
  }

  openCloudAuthSection() {
    if (typeof this.closeMobileSidebar === 'function') this.closeMobileSidebar();
    this.navigate('settings');
    setTimeout(() => {
      const card = document.getElementById('firebase-cloud-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  updateAuthChip(status) {
    const labelEl = document.getElementById('sidebar-auth-label');
    const tagEl = document.getElementById('sidebar-auth-tag');
    if (!labelEl || !tagEl || !status) return;
    if (status.signedIn) {
      labelEl.textContent = 'Cloud Account';
      tagEl.className = status.pending > 0 ? 'nav-tag nav-tag-amber' : 'nav-tag nav-tag-green';
      tagEl.textContent = status.pending > 0 ? `${status.pending} Queue` : 'Synced';
    } else if (status.configured) {
      labelEl.textContent = 'Sign In to Sync';
      tagEl.className = 'nav-tag nav-tag-amber';
      tagEl.textContent = 'Sign In';
    } else {
      labelEl.textContent = 'Login / Cloud Sync';
      tagEl.className = 'nav-tag nav-tag-amber';
      tagEl.textContent = 'Local';
    }
  }

  setFirebaseAuthTab(tab) {
    if (!window.CloudSync) return;
    CloudSync.authTab = tab === 'signup' ? 'signup' : 'signin';
    const mount = document.getElementById('firebase-cloud-card-body');
    if (mount && this.currentView === 'settings') {
      mount.innerHTML = this.renderFirebaseCloudBody();
    }
  }

  async submitFirebaseAuth() {
    if (!window.CloudSync) return;
    const email = (document.getElementById('fb-auth-email')?.value || '').trim();
    const password = document.getElementById('fb-auth-password')?.value || '';
    if (!email || password.length < 6) {
      this.toast('warning', 'Check Details', 'Enter a valid email and password (minimum 6 characters).');
      return;
    }
    if (CloudSync.authTab === 'signup') {
      await CloudSync.signUpEmail(email, password);
    } else {
      await CloudSync.signInEmail(email, password);
    }
  }

  async sendFirebaseReset() {
    if (!window.CloudSync) return;
    const email = (document.getElementById('fb-auth-email')?.value || '').trim();
    await CloudSync.resetPassword(email);
  }

  // Save Thermal Receipt Settings
  saveReceiptSettings() {
    const db = DB.getData();
    if (!db.shop) db.shop = {};
    db.shop.rcptHeader = (document.getElementById('set-rcpt-header').value || '').trim();
    db.shop.rcptFooter = (document.getElementById('set-rcpt-footer').value || '').trim();
    db.shop.rcptWidth = document.getElementById('set-rcpt-width').value || '80mm';
    DB.saveData(db);
    this.toast('success', 'Saved', 'Thermal receipt layout updated');
  }

  // Toggle Sound Feedback
  toggleSound() {
    const db = DB.getData();
    db.soundEnabled = db.soundEnabled === false ? true : false;
    DB.saveData(db);
    this.toast('info', 'Sound FX', `Audio sound feedback is now ${db.soundEnabled ? 'Enabled' : 'Muted'}`);
    if (this.currentView === 'settings') {
      const container = document.getElementById('main-view-container');
      if (container) this.renderSettingsView(container);
    }
  }

  testAudioBeep() {
    DB.playScanBeep();
    this.toast('info', 'Audio Test', 'Barcode scanner beep tone played');
  }

  testCashChime() {
    DB.playCashChime();
    this.toast('success', 'Audio Test', 'Cash register payment chime played');
  }

  testPrintSampleSlip() {
    const sampleInv = {
      id: "INV-DEMO",
      date: new Date().toISOString().split('T')[0],
      time: "12:00 PM",
      customerName: "Ramesh Sharma",
      customerPhone: "9876543210",
      items: [
        { id: "P101", name: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1, price: 235, mrp: 260, total: 235 },
        { id: "P103", name: "Amul Butter 100g", qty: 2, price: 55, mrp: 58, total: 110 }
      ],
      subtotal: 345,
      tax: 17,
      discount: 0,
      total: 362,
      paid: 362,
      due: 0,
      paymentMode: "UPI",
      status: "Paid"
    };
    if (window.POS) POS.openReceiptModal(sampleInv);
  }

  // Save Shop Settings Form
  saveShopSettings() {
    const db = DB.getData();
    if (!db.shop) db.shop = {};
    db.shop = {
      ...db.shop,
      name: document.getElementById('set-shop-name').value.trim() || 'MyDukkan24 Mart',
      owner: document.getElementById('set-shop-owner').value.trim(),
      phone: document.getElementById('set-shop-phone').value.trim(),
      gstin: document.getElementById('set-shop-gstin').value.trim(),
      upiId: document.getElementById('set-shop-upi').value.trim() || '6306437348@upi',
      taxRate: parseFloat(document.getElementById('set-shop-tax').value) || 0,
      address: document.getElementById('set-shop-address').value.trim(),
      currency: "₹"
    };
    DB.saveData(db);
    this.updateHeaderStoreName();
    this.toast('success', 'Saved', 'Store profile updated successfully');
  }

  initNetworkMonitor() {
    const syncUI = () => {
      const online = navigator.onLine !== false;
      if (window.CloudSync && typeof CloudSync.notifyUI === 'function') {
        CloudSync.notifyUI();
      } else {
        const statusEl = document.getElementById('system-online-status');
        const dotEl = document.getElementById('system-status-dot');
        if (statusEl) {
          statusEl.textContent = online ? 'Online • Live API' : 'Offline • Local Mode';
        }
        if (dotEl) {
          dotEl.style.backgroundColor = online ? 'var(--success)' : 'var(--warning)';
          dotEl.style.boxShadow = online
            ? '0 0 8px rgba(16, 185, 129, 0.7)'
            : '0 0 8px rgba(245, 158, 11, 0.7)';
        }
      }
      if (window.DukaanAI && typeof DukaanAI.updateConnectionBadge === 'function') {
        DukaanAI.updateConnectionBadge();
      }
    };

    syncUI();
    window.addEventListener('online', () => {
      syncUI();
      const cloudNote = window.CloudSync && CloudSync.user ? ', Barcode & Cloud Sync' : ' & Barcode lookups';
      this.toast('success', 'Online Mode Restored', `Internet connected — Live AI${cloudNote} active.`);
    });
    window.addEventListener('offline', () => {
      syncUI();
      const cloudNote = window.CloudSync && CloudSync.user ? ' & Offline Sync Queue' : '';
      this.toast('warning', 'Offline Mode Active', `No internet — running on Local DB & Advisor${cloudNote}.`);
    });
  }

  // Test Serverless AI Backend Probe (Vercel / Netlify)
  async testNetlifyBackend() {
    this.toast('info', 'Connecting...', 'Testing serverless /api/gemini endpoint...');
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Ping test. Reply with OK.' })
      });
      const data = await res.json();
      if (res.ok && data.text) {
        this.toast('success', 'Online!', 'Serverless AI Backend is connected and active.');
      } else {
        this.toast('warning', 'Notice', data.error || 'Server responded with status ' + res.status);
      }
    } catch (e) {
      this.toast('warning', 'Check Environment', 'Serverless /api/gemini reachable on Vercel/Netlify production or local vercel dev.');
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
    const isSignedInCloud = Boolean(window.CloudSync && CloudSync.user);
    const msg = isSignedInCloud
      ? `Reset local offline database on this device?\n\nNote: You are signed in to Firebase (${CloudSync.user.email || 'Cloud Account'}). Cloud data stays safe in Firebase and will re-sync unless you Sign Out or Disconnect Firebase first.`
      : 'Reset entire application data to default Kirana demo dataset? All current custom items will be replaced.';
    if (confirm(msg)) {
      localStorage.removeItem('mydukaan24_prod_db');
      localStorage.removeItem('mydukaan24_sync_meta');
      localStorage.removeItem('mydukaan24_p113_seeded');
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
      } else if (e.key === 'F4') {
        e.preventDefault();
        this.openCashDrawerModal();
      }
    });
  }

  // Mobile Drawer Toggle
  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      const isOpen = sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('active', isOpen);
    }
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
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
    const accent = db.accent || 'blue';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
  }

  setAccentTheme(accent) {
    const db = DB.getData();
    db.accent = accent;
    DB.saveData(db);
    document.documentElement.setAttribute('data-accent', accent);
    this.toast('success', 'Theme Updated', `Accent color updated to ${accent.toUpperCase()}`);
    if (this.currentView === 'settings') {
      const container = document.getElementById('main-view-container');
      if (container) this.renderSettingsView(container);
    }
  }

  updateHeaderStoreName() {
    const db = DB.getData();
    const nameEl = document.getElementById('topbar-shop-name');
    if (nameEl) nameEl.textContent = (db.shop && db.shop.name) || 'MyDukkan24 Store';
  }

  // Download Application View
  renderDownloadAppView(container) {
    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Download MyDukkan24 Application</h1>
          <p>Install on Android smartphones, tablets, or desktop PCs for high-speed offline retail billing</p>
        </div>
      </div>

      <!-- App Highlights Bento -->
      <div class="responsive-split-grid" style="margin-bottom: 24px;">
        <!-- Left: Official App Download Card -->
        <div class="card" style="margin-bottom: 0; background: linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(16,185,129,0.08) 100%); border-color: rgba(37,99,235,0.3);">
          <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;">
            <img src="assets/LOGO.jpeg" onerror="this.src='assets/logo.svg'" style="width: 72px; height: 72px; border-radius: 16px; object-fit: contain; box-shadow: 0 8px 24px rgba(0,0,0,0.3); background: #141B2D; padding: 4px; flex-shrink: 0;" alt="MyDukkan24 App Icon" />
            <div style="flex: 1; min-width: 180px;">
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0;">MyDukkan24 Retail OS</h2>
                <span class="badge badge-success">Production Release</span>
              </div>
              <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                Official POS Billing, Barcode Scanner & Digital Khata Platform
              </div>
              <div style="font-size: 12px; font-family: var(--font-mono); color: var(--text-muted); margin-top: 6px;">
                Version 4.2.0 • Size: 4.8 MB • Android 8.0+ / PWA Universal
              </div>
            </div>
          </div>

          <div style="background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 20px;">
            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 10px;">
              🚀 Choose Your Preferred Installation Method:
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <!-- Option 1: PWA Web APK -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 8px;">
                <div style="flex: 1; min-width: 180px;">
                  <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">
                    ⚡ Option 1: 1-Click Native App Install (PWA Web-APK)
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                    Installs directly to your Android/iOS home screen. Auto-updates with zero storage lag.
                  </div>
                </div>
                <button class="btn btn-primary" onclick="App.triggerPWAInstall()">
                  ${Icons.download(14)} Install on Device
                </button>
              </div>

              <!-- Option 2: Direct APK Download -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 8px;">
                <div style="flex: 1; min-width: 180px;">
                  <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">
                    🤖 Option 2: Download Android APK Package (.apk)
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                    Stand-alone Android package for sideloading on POS terminals and barcode devices.
                  </div>
                </div>
                <a href="assets/MyDukkan24-v4.apk" download="MyDukkan24-v4.2.0.apk" class="btn btn-secondary">
                  ${Icons.package(14)} Download APK (4.8MB)
                </a>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 14px; color: var(--text-muted); font-size: 12px; flex-wrap: wrap;">
            <span>✓ 100% Offline Database</span>
            <span>✓ Thermal Printer Ready</span>
            <span>✓ Hardware Barcode Gun Compatible</span>
            <span>✓ Verified by Mayur Singh</span>
          </div>
        </div>

        <!-- Right: Mobile Installation Instructions -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.info(16)} Mobile Installation Steps</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Android Guide -->
            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-weight: 700; font-size: 13px; color: #10B981; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>🤖 For Android Devices (Chrome, Samsung Internet):</span>
              </div>
              <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.7;">
                <li>Tap <strong>"Install on Device"</strong> above or tap Chrome's three-dots menu (⋮).</li>
                <li>Select <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Tap <strong>Install</strong>. The MyDukkan24 app icon will appear on your phone screen.</li>
                <li>Open the app — it runs full-screen with zero browser address bars and works offline.</li>
              </ol>
            </div>

            <!-- iOS Guide -->
            <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-weight: 700; font-size: 13px; color: #60A5FA; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>🍎 For iPhones & iPads (Safari):</span>
              </div>
              <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.7;">
                <li>Open <strong>Safari</strong> and navigate to <code style="overflow-wrap: anywhere;">${this.escapeHtml(window.location.host || 'mydukaan24.vercel.app')}</code>.</li>
                <li>Tap the <strong>Share</strong> button (square icon with upward arrow).</li>
                <li>Scroll down and select <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>"Add"</strong> in top right. Enjoy a fast standalone iOS POS experience.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  triggerPWAInstall() {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.toast('success', 'Installation Started', 'MyDukkan24 is being installed on your device!');
        }
        window.deferredPrompt = null;
      });
    } else {
      alert('To install MyDukkan24 on this device:\n\n1. In Chrome/Brave: Tap the three dots (⋮) in the top-right corner.\n2. Tap "Install App" or "Add to Home screen".\n\nYour app will be added to your home screen with offline database support!');
    }
  }

  // Day-End Cash Register & Closing Z-Report Modal
  openCashDrawerModal() {
    const db = DB.getData();
    const today = new Date().toISOString().split('T')[0];
    const invoices = (db.invoices || []).filter(i => i.date === today);
    const expenses = (db.expenses || []).filter(e => e.date === today);

    let cashSales = 0, upiSales = 0, cardSales = 0, udhaarSales = 0, totalSales = 0;
    invoices.forEach(inv => {
      const amt = Number(inv.total) || 0;
      totalSales += amt;
      if (inv.paymentMode === 'Cash') cashSales += (Number(inv.paid) || amt);
      else if (inv.paymentMode === 'UPI') upiSales += (Number(inv.paid) || amt);
      else if (inv.paymentMode === 'Card') cardSales += (Number(inv.paid) || amt);
      else if (inv.paymentMode === 'Udhaar') udhaarSales += (Number(inv.due) || amt);
    });

    const totalExp = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netCashInDrawer = Math.max(0, cashSales - totalExp);

    const modalHtml = `
      <div class="modal-backdrop" id="cash-drawer-modal" onclick="if(event.target===this) App.closeCashDrawerModal()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-title">💰 Day-End Cash Register (Counter #1)</div>
            <button class="topbar-icon-btn" onclick="App.closeCashDrawerModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 14px; font-family: var(--font-mono);">
              Date: ${today} • Store: ${db.shop?.name || 'MyDukkan24 Mart'}
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px;">
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Cash Sales</div>
                <div style="font-size: 17px; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${cashSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">UPI Digital</div>
                <div style="font-size: 17px; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${upiSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Card POS</div>
                <div style="font-size: 17px; font-weight: 800; color: #A78BFA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${cardSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Udhaar Issued</div>
                <div style="font-size: 17px; font-weight: 800; color: #F43F5E; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${udhaarSales.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
                <span>Total Bills Issued:</span>
                <span style="font-weight: 700; font-family: var(--font-mono);">${invoices.length} Bills</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
                <span>Total Gross Sales:</span>
                <span style="font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">₹${totalSales.toLocaleString('en-IN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #F87171; margin-bottom: 4px;">
                <span>Today's Cash Expenses:</span>
                <span style="font-weight: 700; font-family: var(--font-mono);">-₹${totalExp.toLocaleString('en-IN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; border-top: 1px dashed var(--border-medium); padding-top: 8px; margin-top: 6px;">
                <span style="color: #fff;">Net Cash in Counter Drawer:</span>
                <span style="color: #10B981; font-family: var(--font-mono); font-size: 17px;">₹${netCashInDrawer.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary" style="flex: 1 1 170px; justify-content: center;" onclick="window.print()">
                ${Icons.print(14)} Print Day-End Z-Report
              </button>
              <button class="btn btn-secondary" onclick="App.closeCashDrawerModal()">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('cash-drawer-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  closeCashDrawerModal() {
    const modal = document.getElementById('cash-drawer-modal');
    if (modal) modal.remove();
  }

  updateI18nLabels() {
    if (!window.I18n) return;
    const langSelect = document.getElementById('lang-selector-select');
    if (langSelect) langSelect.value = I18n.getLanguage();
    const sidebarLangSelect = document.getElementById('sidebar-lang-select');
    if (sidebarLangSelect) sidebarLangSelect.value = I18n.getLanguage();

    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const view = link.dataset.view;
      if (view) {
        const textSpan = link.querySelector('span:not(.nav-icon):not(.nav-tag)');
        if (textSpan) {
          const trans = I18n.t(`nav_${view}`);
          if (trans && trans !== `nav_${view}`) {
            textSpan.textContent = trans;
          }
        }
      }
    });
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
