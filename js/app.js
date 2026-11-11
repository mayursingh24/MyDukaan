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
    if (this.isCashierMode()) {
      this.currentView = 'pos';
    }
    this.applyRoleUI();
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

  // =========================================================================
  // ROLE-BASED ACCESS CONTROL (OWNER vs CASHIER)
  // =========================================================================
  isCashierMode() {
    return Boolean(window.DB && typeof DB.getDeviceRole === 'function' && DB.getDeviceRole() === 'cashier');
  }

  getActiveCashierName() {
    return window.DB && typeof DB.getDeviceCashierName === 'function' ? DB.getDeviceCashierName() : '';
  }

  applyRoleUI() {
    const cashier = this.isCashierMode();
    const cashierName = this.getActiveCashierName() || 'Counter';
    if (document.body) {
      document.body.setAttribute('data-role', cashier ? 'cashier' : 'owner');
    }

    const chip = document.getElementById('topbar-role-chip');
    if (chip) {
      chip.classList.toggle('cashier-active', cashier);
      chip.innerHTML = cashier
        ? `🔒 Cashier (${this.escapeHtml(cashierName)}) • Unlock`
        : `👑 Owner Mode`;
      chip.title = cashier
        ? 'Counter locked in Cashier Mode — click to unlock Owner PIN'
        : 'Switch counter terminal to Cashier-only mode';
    }

    const roleLabel = document.getElementById('sidebar-role-label');
    const roleTag = document.getElementById('sidebar-role-tag');
    if (roleLabel && roleTag) {
      if (cashier) {
        roleLabel.textContent = 'Unlock Owner Mode (PIN)';
        roleTag.className = 'nav-tag nav-tag-amber';
        roleTag.textContent = 'Cashier';
      } else {
        roleLabel.textContent = 'Switch to Cashier Mode';
        roleTag.className = 'nav-tag nav-tag-green';
        roleTag.textContent = 'Owner';
      }
    }

    const mobileRoleBtn = document.getElementById('mobile-sidebar-role-btn');
    if (mobileRoleBtn) {
      mobileRoleBtn.textContent = cashier
        ? '🔓 Unlock Owner Mode (PIN)'
        : '🔒 Switch to Cashier Mode';
    }
  }

  requireOwner(actionDesc = 'access this feature') {
    this.toast('warning', 'Owner Access Required', `Enter Owner PIN to ${actionDesc}.`);
    this.openUnlockOwnerModal();
  }

  toggleRoleMode() {
    if (this.isCashierMode()) {
      this.openUnlockOwnerModal();
    } else {
      this.openSwitchToCashierModal();
    }
  }

  openSwitchToCashierModal() {
    const existing = document.getElementById('role-switch-modal');
    if (existing) existing.remove();

    const db = DB.getData();
    const hasPin = Boolean(db.ownerPinHash);
    const staffNames = (db.staff || []).map(s => s.name).filter(Boolean);
    const currentCashier = this.getActiveCashierName() || (staffNames[0] || 'Counter Cashier');

    const modalHtml = `
      <div class="modal-backdrop" id="role-switch-modal" onclick="if(event.target === this) document.getElementById('role-switch-modal').remove()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.lock(16)} Switch Counter to Cashier Mode</div>
            <button class="topbar-icon-btn" onclick="document.getElementById('role-switch-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; color: var(--text-primary); margin-bottom: 14px; line-height: 1.5;">
              <strong>Cashier Restrictions:</strong> Cashier can only use <strong>POS Billing</strong>, <strong>Barcode Scanner</strong> &amp; <strong>Read-Only Stock Lookup</strong>. Analytics, P&amp;L, Cost Margins, Deletes, Udhaar Settlement &amp; Settings will stay locked behind your Owner PIN.
            </div>
            <form onsubmit="event.preventDefault(); App.confirmSwitchToCashier();">
              <div class="form-group">
                <label class="form-label">Active Cashier / Counter Staff Name *</label>
                <input type="text" id="cashier-name-input" class="form-input" required maxlength="40" value="${this.escapeHtml(currentCashier)}" placeholder="e.g. Suresh Counter 1" />
                ${staffNames.length ? `
                  <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                    ${staffNames.slice(0, 4).map(nm => `
                      <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="document.getElementById('cashier-name-input').value='${this.escapeHtml(nm)}'">${this.escapeHtml(nm)}</button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              ${!hasPin ? `
                <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.3); padding: 12px; border-radius: var(--radius-md); margin-bottom: 14px;">
                  <div style="font-size: 12px; font-weight: 700; color: #60A5FA; margin-bottom: 8px;">Set Your 4–6 Digit Owner Unlock PIN First</div>
                  <div class="form-row-2">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">New Owner PIN *</label>
                      <input type="password" id="switch-set-pin" class="form-input" required minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="4-6 digits" />
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Confirm PIN *</label>
                      <input type="password" id="switch-confirm-pin" class="form-input" required minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="Repeat PIN" />
                    </div>
                  </div>
                </div>
              ` : `
                <div style="font-size: 12px; color: var(--success); margin-bottom: 14px; font-weight: 600;">
                  ✓ Your encrypted Owner PIN is active and required to unlock later.
                </div>
              `}

              <div class="modal-footer" style="padding: 8px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('role-switch-modal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">${Icons.lock(14)} Lock to Cashier Mode</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async confirmSwitchToCashier() {
    const db = DB.getData();
    const cashierName = (document.getElementById('cashier-name-input')?.value || '').trim() || 'Counter Cashier';

    if (!db.ownerPinHash) {
      const p1 = (document.getElementById('switch-set-pin')?.value || '').trim();
      const p2 = (document.getElementById('switch-confirm-pin')?.value || '').trim();
      if (!/^\d{4,6}$/.test(p1)) {
        this.toast('warning', 'Invalid PIN', 'Enter a 4 to 6 digit numeric Owner PIN.');
        return;
      }
      if (p1 !== p2) {
        this.toast('danger', 'PIN Mismatch', 'Owner PIN and Confirm PIN must match.');
        return;
      }
      db.ownerPinHash = await DB.hashPin(p1);
      DB.saveData(db);
    }

    DB.setDeviceRole('cashier', cashierName);
    document.getElementById('role-switch-modal')?.remove();
    this.applyRoleUI();
    this.navigate('pos');
    this.toast('success', 'Cashier Mode Enabled', `Terminal locked for ${cashierName} (POS + View-Only Stock).`);
  }

  openUnlockOwnerModal() {
    const existing = document.getElementById('unlock-owner-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-backdrop" id="unlock-owner-modal" onclick="if(event.target === this) document.getElementById('unlock-owner-modal').remove()">
        <div class="modal-card" style="max-width: 400px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.lock(16)} Owner PIN Unlock</div>
            <button class="topbar-icon-btn" onclick="document.getElementById('unlock-owner-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); App.submitOwnerPinUnlock();">
              <div class="form-group">
                <label class="form-label">Enter 4–6 Digit Owner PIN *</label>
                <input type="password" id="unlock-owner-pin-input" class="form-input" required minlength="4" maxlength="8" inputmode="numeric" autofocus placeholder="••••" style="font-family: var(--font-mono); font-size: 18px; letter-spacing: 4px; text-align: center;" />
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px;">
                Forgot PIN? Sign in on the Shop Owner's own phone/laptop in <strong>Settings → Counter Security</strong> to update the Owner PIN via Cloud Sync.
              </div>
              <div class="modal-footer" style="padding: 8px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('unlock-owner-modal').remove()">Stay Cashier</button>
                <button type="submit" class="btn btn-primary">${Icons.check(14)} Unlock Owner Access</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('unlock-owner-pin-input')?.focus(), 50);
  }

  async submitOwnerPinUnlock() {
    const pin = (document.getElementById('unlock-owner-pin-input')?.value || '').trim();
    if (!pin) return;
    const db = DB.getData();
    const enteredHash = await DB.hashPin(pin);
    const valid = db.ownerPinHash ? (enteredHash === db.ownerPinHash) : (pin === '1234');

    if (!valid) {
      this.toast('danger', 'Wrong PIN', 'Incorrect Owner PIN. Counter remains in Cashier Mode.');
      const inp = document.getElementById('unlock-owner-pin-input');
      if (inp) { inp.value = ''; inp.focus(); }
      return;
    }

    DB.setDeviceRole('owner');
    document.getElementById('unlock-owner-modal')?.remove();
    this.applyRoleUI();
    this.navigate('dashboard');
    this.toast('success', 'Owner Mode Unlocked', 'Full store access restored.');
  }

  async saveOwnerPinSettings() {
    if (this.isCashierMode()) {
      this.requireOwner('change Owner PIN');
      return;
    }
    const pin1 = (document.getElementById('set-owner-pin-new')?.value || '').trim();
    const pin2 = (document.getElementById('set-owner-pin-confirm')?.value || '').trim();
    if (!/^\d{4,6}$/.test(pin1)) {
      this.toast('warning', 'Invalid PIN', 'Enter a 4 to 6 digit numeric PIN.');
      return;
    }
    if (pin1 !== pin2) {
      this.toast('danger', 'PIN Mismatch', 'New PIN and confirmation must match.');
      return;
    }
    const db = DB.getData();
    db.ownerPinHash = await DB.hashPin(pin1);
    DB.saveData(db);
    this.toast('success', 'Owner PIN Updated', 'Encrypted Owner PIN saved & synced across devices.');
    if (this.currentView === 'settings') {
      const container = document.getElementById('main-view-container');
      if (container) this.renderSettingsView(container);
    }
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
    if (this.isCashierMode()) {
      const allowedCashierViews = ['pos', 'inventory', 'products', 'help'];
      if (!allowedCashierViews.includes(viewName)) {
        this.requireOwner(`open ${viewName}`);
        return;
      }
    }

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

    if (this.isCashierMode() && !['pos', 'inventory', 'products', 'help'].includes(viewName)) {
      viewName = 'pos';
      this.currentView = 'pos';
    }

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

      case 'inventory':
        this.renderInventoryView(container);
        if (window.Inventory) Inventory.render();
        break;

      case 'products':
        this.renderProductsCatalogView(container);
        if (window.Inventory) Inventory.renderCatalogView();
        break;

      case 'udhaar':
        this.renderKhataView(container);
        if (window.Khata) Khata.render();
        break;

      case 'customers':
        this.renderCustomersView(container);
        if (window.Khata) Khata.renderCustomersView();
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
    this.applyRoleUI();
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

  getExpiringProducts(products = []) {
    return (products || []).filter(p => {
      if (!window.Inventory || typeof Inventory.getExpiryMeta !== 'function') return false;
      const ex = Inventory.getExpiryMeta(p.expiryDate);
      return Boolean(ex && (ex.status === 'expiring7' || ex.status === 'expired'));
    });
  }

  // 1. ADVANCED EXECUTIVE DASHBOARD
  renderDashboardView(container) {
    if (this.isCashierMode()) {
      this.navigate('pos');
      return;
    }

    const db = DB.getData();
    const shop = db.shop || {};
    const products = db.products || [];
    const customers = db.customers || [];
    const invoices = db.invoices || [];

    const todayStr = DB.getLocalDateStr();
    const todayInvoices = invoices.filter(i => i.date === todayStr);
    const todaySales = DB.round2(todayInvoices.reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.refundAmount) || 0)), 0));
    const totalUdhaar = DB.round2(customers.reduce((s, c) => s + (Number(c.balanceDue) || 0), 0));
    const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0));
    const expiringSoon = this.getExpiringProducts(products);
    const totalInventoryValue = Math.round(products.reduce((s, p) => s + ((Number(p.cost) || 0) * (Number(p.stock) || 0)), 0));
    const totalUnits = DB.roundQty(products.reduce((s, p) => s + (Number(p.stock) || 0), 0));
    const restockAlerts = window.Inventory && typeof Inventory.computeRestockPredictions === 'function'
      ? Inventory.computeRestockPredictions().filter(r => r.urgency !== 'ok').slice(0, 4)
      : [];

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
          <p>${dateFormatted} • ${this.escapeHtml(shop.name || 'MyDukkan24 Store')} • Owner Terminal</p>
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

      <!-- Expiry Warning Banner -->
      ${expiringSoon.length ? `
        <div class="card" style="background: rgba(244, 63, 94, 0.08); border-color: rgba(244, 63, 94, 0.35); margin-bottom: 14px; padding: 12px 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: var(--danger); display: flex;">${Icons.calendar(18)}</span>
              <div>
                <strong style="color: var(--danger); font-size: 13px;">Expiry Alert (≤7 Days):</strong>
                <span style="font-size: 12.5px; color: var(--text-primary); margin-left: 4px;">
                  ${expiringSoon.length} item(s) expiring within 7 days or already expired (${expiringSoon.slice(0, 2).map(p => this.escapeHtml(p.name)).join(', ')}${expiringSoon.length > 2 ? '...' : ''}).
                </span>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="App.navigate('inventory'); Inventory.setStockFilter('Expiring7');">
              Review Expiring →
            </button>
          </div>
        </div>
      ` : ''}

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
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('inventory'); Inventory.setStockFilter('Low');">
              Review Items →
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Four Core Metric Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Today's Sales (Net)</span>
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
            ${customers.filter(c => (Number(c.balanceDue) || 0) > 0).length} customer balances due
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Stock & Expiry Alerts</span>
            <div class="kpi-icon-badge" style="background: ${lowStock.length + expiringSoon.length ? 'var(--warning-light)' : 'var(--success-light)'}; color: ${lowStock.length + expiringSoon.length ? 'var(--warning)' : 'var(--success)'};">
              ${Icons.inventory(16)}
            </div>
          </div>
          <div class="kpi-val" data-kpi-target="${lowStock.length}" style="color: ${lowStock.length ? 'var(--warning)' : 'var(--text-primary)'};">0</div>
          <div class="kpi-trend" style="color: ${expiringSoon.length ? 'var(--danger)' : lowStock.length ? 'var(--warning)' : 'var(--text-muted)'};">
            ${expiringSoon.length ? `${expiringSoon.length} expiring soon` : (lowStock.length ? 'Items need reordering' : 'All items well-stocked')}
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
            ${products.length} SKUs (${totalUnits} units)
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
                  ${invoices.slice(0, 6).map(inv => {
                    const netAmt = Math.max(0, DB.round2((Number(inv.total) || 0) - (Number(inv.refundAmount) || 0)));
                    return `
                    <tr>
                      <td style="font-family: var(--font-mono); font-weight: 600; font-size: 12.5px;">${this.escapeHtml(inv.id)}</td>
                      <td class="hide-mobile-col">${this.escapeHtml(inv.date || '')}</td>
                      <td style="font-weight: 500;">${this.escapeHtml(inv.customerName || 'Walk-in Customer')}</td>
                      <td style="font-weight: 700; color: var(--text-primary);" class="tnum">
                        ₹${netAmt.toLocaleString('en-IN')}
                        ${Number(inv.refundAmount) > 0 ? `<div style="font-size: 10px; color: var(--danger);">Ret: -₹${DB.round2(inv.refundAmount)}</div>` : ''}
                      </td>
                      <td class="hide-mobile-col">
                        <span class="badge ${inv.paymentMode === 'Cash' ? 'badge-success' : inv.paymentMode === 'UPI' ? 'badge-primary' : 'badge-warning'}">
                          ${this.escapeHtml(inv.paymentMode || '')}
                        </span>
                      </td>
                      <td>
                        <div style="display: flex; gap: 6px;">
                          <button class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${this.escapeHtml(inv.id)}'))" title="View Thermal Receipt">
                            ${Icons.print(14)} Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                    `;
                  }).join('')}
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

        <!-- Right: Smart Demand Predictor, Low Stock & Fast Action Center -->
        <div style="display: flex; flex-direction: column; gap: 18px; min-width: 0;">
          <!-- Smart Auto-Restock Demand Card -->
          <div class="card" style="margin-bottom: 0; border-color: rgba(59, 130, 246, 0.25);">
            <div class="card-header">
              <div class="card-title" style="color: #60A5FA;">
                ${Icons.sparkles(16)} Smart Auto-Restock AI
              </div>
              <button class="btn btn-secondary btn-sm" onclick="if(window.Inventory) Inventory.openRestockPredictorModal()">
                Advisor →
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${restockAlerts.length ? restockAlerts.map(r => `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 10px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${this.escapeHtml(r.name)}</div>
                    <div style="font-size: 11px; color: ${r.urgency === 'critical' ? 'var(--danger)' : 'var(--warning)'}; font-weight: 600;">
                      ${r.daysLeft < 99 ? `Runs out in ~${r.daysLeft}d` : 'Below min stock'} • Order ${r.suggestedOrderQty} ${this.escapeHtml(r.unit)}
                    </div>
                  </div>
                  <button class="btn btn-primary btn-sm" style="flex-shrink: 0;" onclick="Inventory.openRestockPredictorModal()">
                    Plan Order
                  </button>
                </div>
              `).join('') : `
                <div style="padding: 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
                  ✓ 30-day velocity healthy. Open Advisor for AI forecast.
                </div>
              `}
            </div>
          </div>

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
                    <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); word-break: break-word;">${this.escapeHtml(p.name)}</div>
                    <div style="font-size: 11px; color: var(--danger); font-weight: 500;">
                      Stock: ${DB.roundQty(p.stock)} ${this.escapeHtml(p.unit || '')} (Min: ${DB.roundQty(p.minStock)})
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm" style="flex-shrink: 0;" onclick="Inventory.quickRestock('${this.escapeHtml(p.id)}')">
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
      const target = DB.round2(parseFloat(el.dataset.kpiTarget) || 0);
      const prefix = el.dataset.kpiPrefix || '';
      const suffix = el.dataset.kpiSuffix || '';
      const duration = 500;
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
    const cashier = this.isCashierMode();
    const cashierName = this.getActiveCashierName() || 'Counter Cashier';

    container.innerHTML = `
      ${cashier ? `
        <div class="card" style="margin-bottom: 14px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.35); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px;">
            <span class="badge badge-warning">Cashier Mode</span>
            <span style="color: var(--text-primary);">Logged counter staff: <strong>${this.escapeHtml(cashierName)}</strong> • Billing &amp; View-Only Stock Active</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.openUnlockOwnerModal()">
            ${Icons.lock(12)} Unlock Owner (PIN)
          </button>
        </div>
      ` : ''}

      <div class="pos-layout">
        <!-- Left: Product Search, Category Filter & Products Grid -->
        <div class="pos-catalog-panel">
          <div class="pos-search-row">
            <div class="pos-search-input-wrap">
              <span class="pos-search-icon">${Icons.search(16)}</span>
              <input type="text" id="pos-search-input" class="form-input pos-search-input" placeholder="Search product name, category, or scan barcode..." oninput="POS.setSearchQuery(this.value)" onkeydown="POS.handleSearchKeydown(event)" autofocus />
            </div>
            <button type="button" class="btn btn-secondary" onclick="POS.openVoiceBillingModal()" title="All-Language Voice Billing (Hindi, Hinglish, Marathi, Tamil, Telugu, Bengali, English...)">
              ${Icons.mic(16)} Voice
            </button>
            <button type="button" class="btn btn-secondary" onclick="BarcodeScanner.openScannerModal()" title="Open Camera Scanner">
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
            <div class="pos-cart-header-actions">
              <button type="button" class="btn btn-secondary btn-sm" onclick="POS.openParkedCartsModal()" title="View Held / Parked Customer Bills">
                Queue <span class="badge badge-warning" id="pos-parked-count" style="display: none; margin-left: 3px;">0</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="POS.parkActiveCart()" title="Hold current bill and serve next customer">
                ${Icons.pause(12)} Hold
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="POS.printCartEstimate()" title="Print Bill Estimate or Last Receipt">
                ${Icons.print(12)} Print
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="POS.clearCart()">Clear</button>
              <button type="button" class="topbar-icon-btn mobile-only" style="width: 28px; height: 28px;" onclick="POS.toggleMobileCartDrawer()">✕</button>
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
    const cashier = this.isCashierMode();
    const activeCat = window.Inventory ? Inventory.filterCategory : 'All';
    const activeStock = window.Inventory ? Inventory.filterStock : 'All';
    const cats = ['All', 'Grocery', 'Dairy', 'Oils', 'Snacks', 'Beverages', 'Personal Care', 'Household', 'Chocolates', 'Healthcare', 'General'];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>${cashier ? 'Stock Lookup (Cashier View-Only)' : 'Inventory & Stock Management'}</h1>
          <p>${cashier ? 'Check real-time prices, expiry dates, and stock counts for checkout billing' : 'Monitor SKUs, expiry dates, bulk CSV imports, smart AI restock & margins'}</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="Inventory.printStockSheet()" title="Print Inventory Stock Register">
            ${Icons.print(14)} Print Stock
          </button>
          ${cashier ? `
            <span class="badge badge-warning" style="padding: 7px 12px; font-size: 12px;">🔒 Read-Only Stock</span>
            <button type="button" class="btn btn-secondary" onclick="App.openUnlockOwnerModal()">
              ${Icons.lock(14)} Unlock Owner
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="Inventory.openRestockPredictorModal()" title="Smart 30-Day Demand & Restock AI">
              ${Icons.sparkles(14)} Smart Restock AI
            </button>
            <button type="button" class="btn btn-secondary" onclick="Inventory.openBulkImportModal()" title="Bulk Import 500+ Products from CSV / Excel">
              ${Icons.upload(14)} Import CSV
            </button>
            <button type="button" class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('products'), 'products.csv')">
              ${Icons.download(14)} Export CSV
            </button>
            <button type="button" class="btn btn-primary" onclick="Inventory.openProductModal()">
              ${Icons.plus(15)} Add Product
            </button>
          `}
        </div>
      </div>

      <!-- Inventory KPI Counters -->
      <div class="kpi-grid" id="inventory-kpi-row"></div>

      <!-- Filters & Search Toolbar -->
      <div class="card" style="padding: 14px 16px; margin-bottom: 18px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1 1 200px; min-width: 0; width: 100%; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search SKU, name, or barcode..." value="${this.escapeHtml(window.Inventory ? Inventory.searchQuery : '')}" oninput="Inventory.setSearch(this.value)" />
          </div>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1 1 240px; min-width: 0;">
            <select id="inv-filter-category-select" class="form-select" style="flex: 1 1 130px; min-width: 0;" onchange="Inventory.filterCategory = this.value; Inventory.render();">
              ${cats.map(c => `<option value="${c}" ${activeCat === c ? 'selected' : ''}>${c === 'All' ? 'All Categories' : c}</option>`).join('')}
            </select>

            <select id="inv-filter-stock-select" class="form-select" style="flex: 1 1 140px; min-width: 0;" onchange="Inventory.setStockFilter(this.value);">
              <option value="All" ${activeStock === 'All' ? 'selected' : ''}>All Stock Status</option>
              <option value="Low" ${activeStock === 'Low' ? 'selected' : ''}>Low Stock Alerts</option>
              <option value="OutOfStock" ${activeStock === 'OutOfStock' ? 'selected' : ''}>Out of Stock</option>
              <option value="Expiring7" ${activeStock === 'Expiring7' ? 'selected' : ''}>Expiring ≤7 Days / Expired</option>
              <option value="Expired" ${activeStock === 'Expired' ? 'selected' : ''}>Expired Only</option>
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
              ${!cashier ? '<th>Cost &amp; Margin</th>' : ''}
              <th>Stock Level</th>
              <th>Barcode</th>
              <th>${cashier ? 'Billing' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody id="inventory-table-tbody"></tbody>
        </table>
      </div>
    `;
  }

  // 3B. DEDICATED PRODUCT CATALOG & BARCODE PRICE BOOK VIEW
  renderProductsCatalogView(container) {
    const cashier = this.isCashierMode();
    const activeCat = window.Inventory ? Inventory.catalogCategory : 'All';
    const activeSort = window.Inventory ? Inventory.catalogSort : 'name';
    const searchVal = window.Inventory ? Inventory.catalogSearch : '';
    const cats = ['All', 'Grocery', 'Dairy', 'Oils', 'Snacks', 'Beverages', 'Personal Care', 'Household', 'Chocolates', 'Healthcare', 'General'];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Product Catalog &amp; Barcode Price Book</h1>
          <p>Browse visual retail price cards, print EAN barcode shelf stickers &amp; push SKUs straight to POS billing</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="Inventory.printBarcodeSheet()" title="Print All Shelf Barcode Stickers">
            ${Icons.scan(14)} Print All Barcodes
          </button>
          <button type="button" class="btn btn-secondary" onclick="Inventory.printPriceList()" title="Print Formatted Store Price List">
            ${Icons.print(14)} Print Price List
          </button>
          ${!cashier ? `
            <button type="button" class="btn btn-primary" onclick="Inventory.openProductModal()">
              ${Icons.plus(15)} Add Product
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="App.openUnlockOwnerModal()">
              ${Icons.lock(14)} Unlock Owner
            </button>
          `}
        </div>
      </div>

      <!-- Catalog KPI Summary -->
      <div class="kpi-grid" id="products-catalog-summary"></div>

      <!-- Search, Category & Sort Toolbar -->
      <div class="card" style="padding: 14px 16px; margin-bottom: 18px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1 1 220px; min-width: 0; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search product title, category, or barcode..." value="${this.escapeHtml(searchVal)}" oninput="Inventory.catalogSearch = (this.value || '').toLowerCase().trim(); Inventory.renderCatalogView();" />
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1 1 240px; min-width: 0;">
            <select class="form-select" style="flex: 1 1 130px; min-width: 0;" onchange="Inventory.catalogCategory = this.value; Inventory.renderCatalogView();">
              ${cats.map(c => `<option value="${c}" ${activeCat === c ? 'selected' : ''}>${c === 'All' ? 'All Categories' : c}</option>`).join('')}
            </select>
            <select class="form-select" style="flex: 1 1 140px; min-width: 0;" onchange="Inventory.catalogSort = this.value; Inventory.renderCatalogView();">
              <option value="name" ${activeSort === 'name' ? 'selected' : ''}>Sort: Name (A–Z)</option>
              <option value="top-selling" ${activeSort === 'top-selling' ? 'selected' : ''}>Top Selling (Units Sold)</option>
              <option value="price-asc" ${activeSort === 'price-asc' ? 'selected' : ''}>Price: Low → High</option>
              <option value="price-desc" ${activeSort === 'price-desc' ? 'selected' : ''}>Price: High → Low</option>
              <option value="discount-desc" ${activeSort === 'discount-desc' ? 'selected' : ''}>Highest MRP Savings</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Visual SKU & Barcode Cards Grid -->
      <div class="catalog-cards-grid" id="products-catalog-grid"></div>
    `;
  }

  // 4. UDHAAR KHATA VIEW WRAPPER
  renderKhataView(container) {
    const activeFilter = window.Khata ? Khata.udhaarFilter : 'pending';
    const searchVal = window.Khata ? Khata.searchQuery : '';

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Customer Udhaar Khata (Credit Ledger)</h1>
          <p>Collect pending credit dues, track settlements, print statements &amp; send WhatsApp payment reminders</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="Khata.printKhataSummary()" title="Print Udhaar Dues Statement">
            ${Icons.print(14)} Print Statement
          </button>
          <button type="button" class="btn btn-secondary" onclick="App.exportCustomersCSV('udhaar')">
            ${Icons.download(14)} Export Khata
          </button>
          <button type="button" class="btn btn-primary" onclick="Khata.openCustomerModal()">
            ${Icons.plus(15)} Add Customer
          </button>
        </div>
      </div>

      <!-- Khata Summary KPIs -->
      <div class="kpi-grid" id="khata-kpi-row"></div>

      <!-- Search & Recovery Filter Pills -->
      <div class="card" style="padding: 14px 18px; margin-bottom: 18px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1 1 220px; min-width: 0; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search debtor name or phone number..." value="${this.escapeHtml(searchVal)}" oninput="Khata.setSearch(this.value)" />
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" data-udhaar-filter="pending" class="btn btn-sm ${activeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}" onclick="Khata.setUdhaarFilter('pending')">Pending Dues</button>
            <button type="button" data-udhaar-filter="all" class="btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="Khata.setUdhaarFilter('all')">All Accounts</button>
            <button type="button" data-udhaar-filter="clear" class="btn btn-sm ${activeFilter === 'clear' ? 'btn-primary' : 'btn-secondary'}" onclick="Khata.setUdhaarFilter('clear')">Cleared (₹0)</button>
          </div>
        </div>
      </div>

      <!-- Customer Ledger Cards / List -->
      <div id="khata-customer-list"></div>
    `;
  }

  // 4B. DEDICATED CUSTOMERS DIRECTORY & LOYALTY CRM VIEW
  renderCustomersView(container) {
    const activeTier = window.Khata ? Khata.crmTier : 'All';
    const activeSort = window.Khata ? Khata.crmSort : 'spent';
    const searchVal = window.Khata ? Khata.crmSearch : '';

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Customers Directory &amp; Loyalty CRM</h1>
          <p>Manage regular shopper profiles, VIP Gold/Silver/Bronze tiers, reward points &amp; repeat order velocity</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="Khata.printCustomersDirectory()" title="Print Customer Directory">
            ${Icons.print(14)} Print Directory
          </button>
          <button type="button" class="btn btn-secondary" onclick="App.exportCustomersCSV('crm')">
            ${Icons.download(14)} Export CRM CSV
          </button>
          <button type="button" class="btn btn-primary" onclick="Khata.openCustomerModal()">
            ${Icons.plus(15)} Add Customer
          </button>
        </div>
      </div>

      <!-- Customer CRM KPIs -->
      <div class="kpi-grid" id="customers-crm-kpi-row"></div>

      <!-- Search, Loyalty Tier & Sort Toolbar -->
      <div class="card" style="padding: 14px 18px; margin-bottom: 18px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1 1 220px; min-width: 0; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
            <input type="text" class="form-input" style="padding-left: 36px;" placeholder="Search customer name, phone, email, or notes..." value="${this.escapeHtml(searchVal)}" oninput="Khata.setCrmSearch(this.value)" />
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; flex: 1 1 230px; min-width: 0;">
            <select class="form-select" style="flex: 1 1 120px; min-width: 0;" onchange="Khata.setCrmTier(this.value)">
              <option value="All" ${activeTier === 'All' ? 'selected' : ''}>All Loyalty Tiers</option>
              <option value="Gold" ${activeTier === 'Gold' ? 'selected' : ''}>Gold Tier</option>
              <option value="Silver" ${activeTier === 'Silver' ? 'selected' : ''}>Silver Tier</option>
              <option value="Bronze" ${activeTier === 'Bronze' ? 'selected' : ''}>Bronze Tier</option>
            </select>
            <select class="form-select" style="flex: 1 1 135px; min-width: 0;" onchange="Khata.setCrmSort(this.value)">
              <option value="spent" ${activeSort === 'spent' ? 'selected' : ''}>Sort: Highest Spend</option>
              <option value="orders" ${activeSort === 'orders' ? 'selected' : ''}>Sort: Most Orders</option>
              <option value="points" ${activeSort === 'points' ? 'selected' : ''}>Sort: Reward Points</option>
              <option value="name" ${activeSort === 'name' ? 'selected' : ''}>Sort: Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- CRM Customer Cards Grid -->
      <div class="catalog-cards-grid" id="customers-crm-grid"></div>
    `;
  }

  exportCustomersCSV(source = 'crm') {
    const csv = DB.exportCSV('customers');
    if (!csv) {
      this.toast('warning', 'No Customers', 'Add customer profiles first before exporting.');
      return;
    }
    const file = source === 'udhaar'
      ? `udhaar_khata_${DB.getLocalDateStr()}.csv`
      : `customers_crm_${DB.getLocalDateStr()}.csv`;
    DB.downloadFile(csv, file);
    this.toast('success', 'CSV Exported', `Downloaded ${file}`);
  }

  // 5. INVOICES, SALES LEDGER & RETURNS VIEW
  renderInvoicesView(container) {
    const db = DB.getData();
    const invoices = db.invoices || [];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-title-block">
          <h1>Billing History, Sales Returns &amp; Invoices</h1>
          <p>Review sales transactions, process item returns/refunds, reprint receipts &amp; WhatsApp bills</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="App.printInvoicesRegister()" title="Print Sales Invoice Register">
            ${Icons.print(14)} Print Register
          </button>
          <button type="button" class="btn btn-secondary" onclick="DB.downloadFile(DB.exportCSV('invoices'), 'invoices.csv')">
            ${Icons.download(14)} Export Invoices CSV
          </button>
        </div>
      </div>

      <div class="card" style="padding: 12px 16px; margin-bottom: 16px;">
        <div style="position: relative;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">${Icons.search(15)}</span>
          <input type="text" id="invoices-search-input" class="form-input" style="padding-left: 36px;" placeholder="Search by Invoice # or Customer name..." oninput="App.filterInvoicesTable(this.value)" />
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
                  <th>Net Total</th>
                  <th class="hide-mobile-col">Payment Mode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invoices-ledger-tbody">
                ${invoices.map(inv => {
                  const refundAmt = Number(inv.refundAmount) || 0;
                  const netTotal = Math.max(0, DB.round2((Number(inv.total) || 0) - refundAmt));
                  const status = inv.status || 'Paid';
                  const isFullRefund = status === 'Refunded' || netTotal <= 0;
                  const statusClass = status === 'Refunded'
                    ? 'badge-danger'
                    : (status === 'Partial Return' || status === 'Udhaar Due' || status === 'Partial' ? 'badge-warning' : 'badge-success');
                  return `
                  <tr data-search="${this.escapeHtml(`${inv.id || ''} ${inv.customerName || ''} ${inv.date || ''}`.toLowerCase())}">
                    <td style="font-family: var(--font-mono); font-weight: 700;">
                      ${this.escapeHtml(inv.id)}
                      ${inv.cashierName ? `<div style="font-size: 10px; font-weight: 500; color: var(--text-muted);">By: ${this.escapeHtml(inv.cashierName)}</div>` : ''}
                    </td>
                    <td class="hide-mobile-col">${this.escapeHtml(inv.date || '')}</td>
                    <td style="font-weight: 600;">${this.escapeHtml(inv.customerName || 'Walk-in')}</td>
                    <td class="hide-mobile-col">${inv.items ? inv.items.length : 0} items</td>
                    <td style="font-weight: 700; color: var(--text-primary);" class="tnum">
                      ₹${netTotal.toLocaleString('en-IN')}
                      ${refundAmt > 0 ? `<div style="font-size: 10.5px; color: var(--danger); font-weight: 600;">Refunded: -₹${DB.round2(refundAmt).toLocaleString('en-IN')}</div>` : ''}
                    </td>
                    <td class="hide-mobile-col"><span class="badge badge-muted">${this.escapeHtml(inv.paymentMode || '')}</span></td>
                    <td><span class="badge ${statusClass}">${this.escapeHtml(status)}</span></td>
                    <td>
                      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="POS.openReceiptModal(DB.getData().invoices.find(x => x.id === '${this.escapeHtml(inv.id)}'))">
                          ${Icons.print(14)} Receipt
                        </button>
                        ${!isFullRefund ? `
                          <button type="button" class="btn btn-secondary btn-sm" style="color: var(--warning);" onclick="App.openReturnInvoiceModal('${this.escapeHtml(inv.id)}')" title="Process Sales Return / Refund">
                            ${Icons.rotateCcw(13)} Return
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                  `;
                }).join('')}
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

  filterInvoicesTable(q) {
    const query = String(q || '').toLowerCase().trim();
    document.querySelectorAll('#invoices-ledger-tbody tr').forEach(row => {
      const hay = row.dataset.search || '';
      row.style.display = !query || hay.includes(query) ? '' : 'none';
    });
  }

  printInvoicesRegister() {
    const db = DB.getData();
    const shop = db.shop || {};
    const invoices = db.invoices || [];
    if (!invoices.length) {
      this.toast('warning', 'No Invoices', 'Generate at least one sale invoice first.');
      return;
    }
    const netSum = DB.round2(invoices.reduce((s, inv) => s + Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0)), 0));

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${this.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Sales Invoices Register</h2>
            <div style="font-size:12px; color:#4B5563;">Printed: ${DB.getLocalDateStr()} • ${invoices.length} Total Bills</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Net Sales Total:</strong> ₹${netSum.toLocaleString('en-IN')}</div>
            <div><strong>GSTIN:</strong> ${this.escapeHtml(shop.gstin || 'N/A')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Invoice #</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Date</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Customer</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Mode</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Status</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Net Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => {
              const netTotal = Math.max(0, DB.round2((Number(inv.total) || 0) - (Number(inv.refundAmount) || 0)));
              return `
                <tr>
                  <td style="padding:6px; border:1px solid #D1D5DB; font-family:monospace; font-weight:700;">${this.escapeHtml(inv.id)}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB;">${this.escapeHtml(inv.date || '')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB;">${this.escapeHtml(inv.customerName || 'Walk-in')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB;">${this.escapeHtml(inv.paymentMode || '')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${this.escapeHtml(inv.status || 'Paid')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${netTotal.toLocaleString('en-IN')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    this.printHtmlDocument(html, 'wide');
  }

  _getReturnedMapForInvoice(inv) {
    const map = {};
    (inv.returnedItems || []).forEach(r => {
      if (!r || !r.id) return;
      map[r.id] = DB.roundQty((map[r.id] || 0) + (Number(r.qty) || 0));
    });
    return map;
  }

  _calculateReturnTotals(inv) {
    const db = DB.getData();
    const products = db.products || [];
    const returnedMap = this._getReturnedMapForInvoice(inv);
    const invSubtotal = Number(inv.subtotal) || 0;
    const invDiscount = Number(inv.discount) || 0;
    const netFactor = invSubtotal > 0 ? Math.max(0, (invSubtotal - invDiscount) / invSubtotal) : 1;
    const defaultRate = Number(db.shop?.taxRate ?? 5);

    const lines = [];
    let refundSubtotalNet = 0;
    let refundTax = 0;

    (inv.items || []).forEach(it => {
      const inputEl = document.querySelector(`[data-return-item="${it.id}"]`);
      const origQty = Number(it.qty) || 0;
      const alreadyRet = returnedMap[it.id] || 0;
      const remQty = Math.max(0, DB.roundQty(origQty - alreadyRet));
      const reqQty = Math.min(remQty, Math.max(0, DB.roundQty(parseFloat(inputEl?.value) || 0)));
      if (reqQty <= 0) return;

      const prod = products.find(p => p.id === it.id);
      const gstRate = [0, 5, 12, 18].includes(Number(it.gstRate))
        ? Number(it.gstRate)
        : ([0, 5, 12, 18].includes(Number(prod?.gstRate)) ? Number(prod.gstRate) : defaultRate);

      const unitPrice = Number(it.price) || (origQty > 0 ? (Number(it.total) || 0) / origQty : 0);
      const lineTaxable = DB.round2(unitPrice * reqQty * netFactor);
      const lineTax = DB.round2((lineTaxable * gstRate) / 100);
      const lineValue = DB.round2(lineTaxable + lineTax);

      refundSubtotalNet = DB.round2(refundSubtotalNet + lineTaxable);
      refundTax = DB.round2(refundTax + lineTax);
      lines.push({
        id: it.id,
        name: it.name,
        qty: reqQty,
        remQty,
        netSubtotal: lineTaxable,
        refundValue: lineValue
      });
    });

    const maxRefundRemaining = Math.max(0, DB.round2((Number(inv.total) || 0) - (Number(inv.refundAmount) || 0)));
    const totalRefund = Math.min(maxRefundRemaining, DB.round2(refundSubtotalNet + refundTax));
    return { lines, refundSubtotalNet, refundTax, totalRefund, maxRefundRemaining };
  }

  recalcReturnPreview(invId) {
    const db = DB.getData();
    const inv = (db.invoices || []).find(i => i.id === invId);
    const previewEl = document.getElementById('return-calc-summary');
    if (!inv || !previewEl) return;

    const calc = this._calculateReturnTotals(inv);
    previewEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>Items Selected (${calc.lines.length} lines):</span>
        <strong class="tnum">₹${calc.refundSubtotalNet.toLocaleString('en-IN')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>GST Tax Reversal:</span>
        <strong class="tnum">₹${calc.refundTax.toLocaleString('en-IN')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; padding-top: 6px; border-top: 1px dashed var(--border-medium); color: var(--warning);">
        <span>Total Refund / Credit Value:</span>
        <span class="tnum">₹${calc.totalRefund.toLocaleString('en-IN')}</span>
      </div>
    `;
  }

  openReturnInvoiceModal(invId) {
    if (this.isCashierMode()) {
      this.requireOwner('process sales returns and refunds');
      return;
    }

    const db = DB.getData();
    const inv = (db.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    const returnedMap = this._getReturnedMapForInvoice(inv);
    const cust = inv.customerId ? (db.customers || []).find(c => c.id === inv.customerId) : null;
    const hasDue = (Number(inv.due) || 0) > 0 || (cust && (Number(cust.balanceDue) || 0) > 0);
    const defaultMode = hasDue ? 'Adjust Udhaar' : (inv.paymentMode === 'UPI' ? 'UPI' : 'Cash');

    const existing = document.getElementById('return-invoice-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-backdrop" id="return-invoice-modal" onclick="if(event.target === this) document.getElementById('return-invoice-modal').remove()">
        <div class="modal-card" style="max-width: 580px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.rotateCcw(16)} Sales Return / Refund — #${this.escapeHtml(inv.id)}</div>
            <button class="topbar-icon-btn" onclick="document.getElementById('return-invoice-modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
              Customer: <strong>${this.escapeHtml(inv.customerName || 'Walk-in')}</strong> • Billed: <strong>${this.escapeHtml(inv.date || '')}</strong> • Mode: <strong>${this.escapeHtml(inv.paymentMode || 'Cash')}</strong>
            </div>

            <div class="table-container" style="margin-bottom: 12px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Rate</th>
                    <th>Billed / Left</th>
                    <th>Return Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${(inv.items || []).map(it => {
                    const origQty = DB.roundQty(it.qty || 0);
                    const retQty = returnedMap[it.id] || 0;
                    const remQty = Math.max(0, DB.roundQty(origQty - retQty));
                    return `
                      <tr>
                        <td style="font-weight: 600; font-size: 12.5px;">
                          ${this.escapeHtml(it.name)}
                          ${retQty > 0 ? `<div style="font-size: 10.5px; color: var(--warning);">Already returned: ${retQty}</div>` : ''}
                        </td>
                        <td class="tnum" style="font-size: 12px;">₹${DB.round2(it.price || 0)}</td>
                        <td class="tnum" style="font-size: 12px;">${origQty} / <strong>${remQty}</strong></td>
                        <td>
                          ${remQty > 0 ? `
                            <div style="display: flex; gap: 4px; align-items: center;">
                              <input type="number" step="any" min="0" max="${remQty}" value="0" class="form-input" style="width: 72px; padding: 5px 7px; font-size: 12.5px;" data-return-item="${this.escapeHtml(it.id)}" oninput="App.recalcReturnPreview('${this.escapeHtml(inv.id)}')" />
                              <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 6px; font-size: 10.5px;" onclick="const inp=this.previousElementSibling; inp.value='${remQty}'; App.recalcReturnPreview('${this.escapeHtml(inv.id)}');">Max</button>
                            </div>
                          ` : '<span class="badge badge-muted">Returned</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Refund Settlement Mode *</label>
                <select id="return-refund-mode" class="form-select">
                  <option value="Cash" ${defaultMode === 'Cash' ? 'selected' : ''}>Cash Refund from Drawer</option>
                  <option value="UPI" ${defaultMode === 'UPI' ? 'selected' : ''}>UPI Refund Transfer</option>
                  <option value="Adjust Udhaar" ${defaultMode === 'Adjust Udhaar' ? 'selected' : ''} ${inv.customerId ? '' : 'disabled'}>Adjust in Customer Udhaar Khata</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Return Reason</label>
                <input type="text" id="return-reason" class="form-input" placeholder="e.g. Damaged pack / Exchange" />
              </div>
            </div>

            <div id="return-calc-summary" style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 12px;"></div>

            <div class="modal-footer" style="padding: 8px 0 0; background: none;">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('return-invoice-modal').remove()">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="App.processReturn('${this.escapeHtml(inv.id)}')">
                ${Icons.check(14)} Confirm Return &amp; Restore Stock
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.recalcReturnPreview(invId);
  }

  processReturn(invId) {
    if (this.isCashierMode()) {
      this.requireOwner('process sales returns');
      return;
    }

    const db = DB.getData();
    const inv = (db.invoices || []).find(i => i.id === invId);
    if (!inv) return;

    const calc = this._calculateReturnTotals(inv);
    if (!calc.lines.length || calc.totalRefund <= 0) {
      this.toast('warning', 'Select Items', 'Enter return quantity greater than 0 for at least one item.');
      return;
    }

    const refundMode = document.getElementById('return-refund-mode')?.value || 'Cash';
    const reason = (document.getElementById('return-reason')?.value || '').trim();
    const todayStr = DB.getLocalDateStr();

    // 1. Restore Stock & Adjust Product Sales Telemetry into db.products
    let totalQtyRestored = 0;
    calc.lines.forEach(line => {
      const prod = (db.products || []).find(p => p.id === line.id);
      if (prod) {
        prod.stock = DB.roundQty((Number(prod.stock) || 0) + line.qty);
        const revDelta = line.netSubtotal !== undefined ? line.netSubtotal : line.refundValue;
        prod.soldQty = Math.max(0, DB.roundQty((Number(prod.soldQty) || 0) - line.qty));
        prod.soldRevenue = Math.max(0, DB.round2((Number(prod.soldRevenue) || 0) - revDelta));
      }
      totalQtyRestored = DB.roundQty(totalQtyRestored + line.qty);
      if (!Array.isArray(inv.returnedItems)) inv.returnedItems = [];
      inv.returnedItems.push({
        id: line.id,
        name: line.name,
        qty: line.qty,
        refundValue: line.refundValue,
        date: todayStr,
        refundMode
      });
    });

    // 2. Adjust Invoice Refund & Payment Balances
    inv.refundAmount = DB.round2((Number(inv.refundAmount) || 0) + calc.totalRefund);
    inv.lastReturnDate = todayStr;
    inv.refundMode = refundMode;

    if (inv.customerId) {
      const cust = (db.customers || []).find(c => c.id === inv.customerId);
      if (cust) {
        cust.totalSpent = Math.max(0, DB.round2((Number(cust.totalSpent) || 0) - calc.totalRefund));
        if (refundMode === 'Adjust Udhaar') {
          const udhaarAdj = Math.min(Number(cust.balanceDue) || 0, calc.totalRefund);
          cust.balanceDue = Math.max(0, DB.round2((Number(cust.balanceDue) || 0) - udhaarAdj));
          inv.due = Math.max(0, DB.round2((Number(inv.due) || 0) - calc.totalRefund));
        }
        if (!Array.isArray(cust.transactions)) cust.transactions = [];
        cust.transactions.unshift({
          id: DB.uid('TX'),
          date: todayStr,
          type: refundMode === 'Adjust Udhaar' ? 'CreditNote' : 'Refund',
          amount: calc.totalRefund,
          desc: `Return #${inv.id} (${refundMode})${reason ? ' • ' + reason : ''}`,
          invoiceId: inv.id
        });
        cust.transactions = cust.transactions.slice(0, 200);
      }
    }

    const retMapAfter = this._getReturnedMapForInvoice(inv);
    const allItemsReturned = (inv.items || []).every(it => (retMapAfter[it.id] || 0) >= (Number(it.qty) || 0) - 0.001);
    inv.status = (allItemsReturned || inv.refundAmount >= (Number(inv.total) || 0) - 0.5)
      ? 'Refunded'
      : 'Partial Return';

    DB.saveData(db);
    DB.playCashChime();
    document.getElementById('return-invoice-modal')?.remove();
    this.toast('success', 'Sales Return Complete', `${totalQtyRestored} qty restored to stock • Refund ₹${calc.totalRefund.toLocaleString('en-IN')} (${refundMode})`);
    this.renderViewOnly(this.currentView);
    if (window.POS) POS.renderCatalog();
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
          <button type="button" class="btn btn-secondary" onclick="App.printExpensesReport()" title="Print Shop Expenses Register">
            ${Icons.print(14)} Print Expenses
          </button>
          <button type="button" class="btn btn-secondary" onclick="App.exportExpensesCSV()">
            ${Icons.download(14)} Export CSV
          </button>
          <button type="button" class="btn btn-primary" onclick="App.openExpenseModal()">
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
                    <td>${this.escapeHtml(e.date || '')}</td>
                    <td style="font-weight: 600;">${this.escapeHtml(e.desc || '')}</td>
                    <td class="hide-mobile-col"><span class="badge badge-muted">${this.escapeHtml(e.cat || '')}</span></td>
                    <td style="font-weight: 700; color: var(--danger);" class="tnum">₹${(Number(e.amount) || 0).toLocaleString('en-IN')}</td>
                    <td class="hide-mobile-col"><span class="badge ${e.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${this.escapeHtml(e.status || 'Paid')}</span></td>
                    <td>
                      <button class="btn btn-danger btn-sm" onclick="App.deleteExpense('${this.escapeHtml(e.id)}')" title="Delete">
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
    if (this.isCashierMode()) {
      this.requireOwner('record store expenses');
      return;
    }
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
                  <input type="number" step="0.01" id="exp-amount" class="form-input" required min="0.01" placeholder="e.g. 1500" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Date *</label>
                  <input type="date" id="exp-date" class="form-input" value="${DB.getLocalDateStr()}" />
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
    if (this.isCashierMode()) {
      this.requireOwner('save expenses');
      return;
    }
    const desc = document.getElementById('exp-desc').value.trim();
    const cat = document.getElementById('exp-cat').value;
    const amount = DB.round2(parseFloat(document.getElementById('exp-amount').value) || 0);
    const date = document.getElementById('exp-date').value || DB.getLocalDateStr();
    const status = document.getElementById('exp-status').value;

    if (!desc || amount <= 0) {
      this.toast('warning', 'Missing Details', 'Please fill valid description and amount');
      return;
    }

    const newExp = {
      id: DB.uid('E'),
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
    if (this.isCashierMode()) {
      this.requireOwner('delete expenses');
      return;
    }
    if (confirm('Delete this expense entry?')) {
      DB.deleteItem('expenses', id);
      this.toast('info', 'Deleted', 'Expense entry removed');
      if (this.currentView === 'expenses') this.renderExpensesView(document.getElementById('main-view-container'));
    }
  }

  exportExpensesCSV() {
    const csv = DB.exportCSV('expenses');
    if (!csv) {
      this.toast('warning', 'No Expenses', 'Record at least one expense entry first.');
      return;
    }
    const file = `expenses_${DB.getLocalDateStr()}.csv`;
    DB.downloadFile(csv, file);
    this.toast('success', 'CSV Exported', `Downloaded ${file}`);
  }

  printExpensesReport() {
    const db = DB.getData();
    const shop = db.shop || {};
    const expenses = db.expenses || [];
    const totalExp = DB.round2(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${this.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Operating Expenses Statement</h2>
            <div style="font-size:12px; color:#4B5563;">Printed: ${DB.getLocalDateStr()} • ${expenses.length} Expense Entries</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Total Expenses:</strong> ₹${totalExp.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Date</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Description</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Category</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Status</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.length ? expenses.map(e => `
              <tr>
                <td style="padding:6px; border:1px solid #D1D5DB;">${this.escapeHtml(e.date || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; font-weight:600;">${this.escapeHtml(e.desc || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${this.escapeHtml(e.cat || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${this.escapeHtml(e.status || 'Paid')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${DB.round2(e.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="padding:12px; border:1px solid #D1D5DB; text-align:center; color:#6B7280;">No expenses recorded yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
    this.printHtmlDocument(html, 'wide');
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
          <button type="button" class="btn btn-secondary" onclick="Staff.printAttendanceReport()">
            ${Icons.print(14)} Print Muster Roll
          </button>
          <button type="button" class="btn btn-primary" onclick="Staff.openAddStaffModal()">
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
          <h1>Financial Reports, P&amp;L &amp; GSTR-1 Filing</h1>
          <p>Live revenue net of returns, dynamic period trends, GSTR-1 tax slabs &amp; TallyPrime XML exports</p>
        </div>
        <div class="page-actions-row">
          <button type="button" class="btn btn-secondary" onclick="if(window.Analytics) Analytics.printGstReport()">
            ${Icons.fileText(14)} Print GSTR-1
          </button>
          <button type="button" class="btn btn-primary" onclick="if(window.Analytics) Analytics.printPnLReport(); else window.print();">
            ${Icons.print(14)} Print P&amp;L Report
          </button>
        </div>
      </div>

      <div id="analytics-content-view"></div>
    `;
  }

  getDailyRegisterSummary(dateStr = DB.getLocalDateStr()) {
    const db = DB.getData();
    const todayInvoices = (db.invoices || []).filter(i => i.date === dateStr);
    const todayExpenses = (db.expenses || []).filter(e => e.date === dateStr && e.status !== 'Pending');

    let cashSales = 0, upiSales = 0, cardSales = 0, udhaarSales = 0, grossSales = 0;
    todayInvoices.forEach(inv => {
      const amt = Number(inv.total) || 0;
      const paidVal = inv.paid !== undefined ? (Number(inv.paid) || 0) : amt;
      grossSales += amt;
      if (inv.paymentMode === 'Cash') cashSales += paidVal;
      else if (inv.paymentMode === 'UPI') upiSales += paidVal;
      else if (inv.paymentMode === 'Card') cardSales += paidVal;
      else if (inv.paymentMode === 'Udhaar') udhaarSales += (Number(inv.due) || amt);
    });

    // Deduct cash & UPI refunds issued on dateStr (supports per-return dates + legacy fallback)
    let cashRefunds = 0, upiRefunds = 0;
    (db.invoices || []).forEach(inv => {
      const retList = Array.isArray(inv.returnedItems) ? inv.returnedItems : [];
      const datedItems = retList.filter(r => r && r.date);
      if (datedItems.length > 0) {
        datedItems.forEach(r => {
          if (r.date === dateStr) {
            const mode = r.refundMode || inv.refundMode || 'Cash';
            const val = Number(r.refundValue) || 0;
            if (mode === 'Cash') cashRefunds += val;
            else if (mode === 'UPI') upiRefunds += val;
          }
        });
      } else if (inv.lastReturnDate === dateStr && Number(inv.refundAmount) > 0) {
        if (inv.refundMode === 'Cash') cashRefunds += Number(inv.refundAmount) || 0;
        else if (inv.refundMode === 'UPI') upiRefunds += Number(inv.refundAmount) || 0;
      }
    });

    const totalExp = DB.round2(todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
    const netCashCollected = DB.round2(Math.max(0, cashSales - cashRefunds));
    const netUpiCollected = DB.round2(Math.max(0, upiSales - upiRefunds));
    const netCashInDrawer = DB.round2(Math.max(0, netCashCollected - totalExp));

    return {
      today: dateStr,
      billCount: todayInvoices.length,
      grossSales: DB.round2(grossSales),
      cashSales: netCashCollected,
      upiSales: netUpiCollected,
      cardSales: DB.round2(cardSales),
      udhaarSales: DB.round2(udhaarSales),
      cashRefunds: DB.round2(cashRefunds),
      upiRefunds: DB.round2(upiRefunds),
      totalExp,
      netCashInDrawer
    };
  }

  printHtmlDocument(html, mode = 'wide') {
    const printArea = document.getElementById('thermal-printable-area');
    if (!printArea) {
      window.print();
      return;
    }
    printArea.className = mode === 'wide' ? 'print-wide' : '';
    printArea.innerHTML = html;
    const cleanup = () => {
      printArea.className = '';
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }

  // 9. SYSTEM SETTINGS VIEW (Zero manual Gemini keys in cloud - Dual Offline + Firebase Sync)
  renderSettingsView(container) {
    const db = DB.getData();
    const shop = db.shop || {};
    const theme = db.theme || 'dark';
    const accent = db.accent || 'blue';
    const isSound = db.soundEnabled !== false;
    const hasOwnerPin = Boolean(db.ownerPinHash);
    const dbBytes = (JSON.stringify(db).length / 1024).toFixed(1);
    const dailyReg = this.getDailyRegisterSummary();
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
          <p>Manage business identity, Firebase Cloud + Offline dual storage, Owner PIN, receipts & themes</p>
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
                <input type="text" id="set-shop-name" class="form-input" value="${this.escapeHtml(shop.name || 'MyDukkan24 Mart')}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Owner / Cashier Name</label>
                <input type="text" id="set-shop-owner" class="form-input" value="${this.escapeHtml(shop.owner || 'Mayur Singh')}" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Phone Number *</label>
                  <input type="text" id="set-shop-phone" class="form-input" value="${this.escapeHtml(shop.phone || '+91 6306437348')}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">GSTIN Tax ID</label>
                  <input type="text" id="set-shop-gstin" class="form-input" value="${this.escapeHtml(shop.gstin || '09AAAAA0000A1Z5')}" placeholder="09AAAAA0000A1Z5" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">UPI ID for Dynamic Payments *</label>
                  <input type="text" id="set-shop-upi" class="form-input" value="${this.escapeHtml(shop.upiId || '6306437348@upi')}" required placeholder="yourname@upi" />
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
                <textarea id="set-shop-address" class="form-textarea" rows="2">${this.escapeHtml(shop.address || 'Hazratganj Market, Lucknow, Uttar Pradesh, India')}</textarea>
              </div>

              <!-- Live Store UPI QR Preview -->
              <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 14px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${encodeURIComponent(shop.upiId || '6306437348@upi')}&pn=${encodeURIComponent(shop.name || 'MyDukkan24')}" alt="Store UPI QR" style="width: 72px; height: 72px; border-radius: 8px; background: #fff; padding: 4px; display: block; flex-shrink: 0;" />
                <div style="flex: 1; min-width: 170px;">
                  <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">Active Dynamic UPI QR</div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px; overflow-wrap: anywhere;">VPA: <code style="color: var(--primary);">${this.escapeHtml(shop.upiId || '6306437348@upi')}</code></div>
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
                <input type="text" id="set-rcpt-header" class="form-input" value="${this.escapeHtml(shop.rcptHeader || 'HAZRATGANJ, LUCKNOW • TAX INVOICE')}" placeholder="e.g. HAZRATGANJ MARKET • TAX INVOICE" />
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Footer Thank You Note</label>
                <input type="text" id="set-rcpt-footer" class="form-input" value="${this.escapeHtml(shop.rcptFooter || 'THANK YOU FOR SHOPPING! VISIT AGAIN')}" placeholder="e.g. THANK YOU FOR SHOPPING!" />
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
              <div class="card-title">${Icons.wallet(16)} Daily Cash Counter (${dailyReg.today})</div>
              <span class="badge badge-success">Counter #1 Live</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">
              Real-time today's cash drawer net of refunds &amp; expenses, plus today's UPI digital settlement.
            </p>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px;">
              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Today's Cash In Drawer</div>
                <div style="font-size: 18px; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${dailyReg.netCashInDrawer.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-input); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Today's UPI Collection</div>
                <div style="font-size: 18px; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${dailyReg.upiSales.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="App.openCashDrawerModal()">
                ${Icons.receipt(14)} View Closing Sheet &amp; Print Z-Report
              </button>
            </div>
          </div>
        </div>

        <!-- Column 2: Security Role Lock, Theme Studio, Audio & Database Backups -->
        <div style="display: flex; flex-direction: column; gap: 20px; min-width: 0;">
          <!-- Counter Security & Owner PIN Card -->
          <div class="card" style="margin-bottom: 0; border-color: rgba(245, 158, 11, 0.3);">
            <div class="card-header">
              <div class="card-title">${Icons.lock(16)} Counter Security &amp; Role Lock (Owner / Cashier)</div>
              <span class="badge ${hasOwnerPin ? 'badge-success' : 'badge-warning'}">${hasOwnerPin ? 'PIN Active ✓' : 'PIN Not Set'}</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
              Lock the shop counter terminal into <strong>Cashier Mode</strong> (POS Billing + View-Only Stock). P&amp;L, Cost Margins, Deletes &amp; Settings stay protected behind your encrypted Owner PIN.
            </p>
            <form onsubmit="event.preventDefault(); App.saveOwnerPinSettings();" style="margin-bottom: 12px;">
              <div class="form-row-2">
                <div class="form-group" style="margin-bottom: 10px;">
                  <label class="form-label">${hasOwnerPin ? 'Change' : 'Set'} Owner PIN (4–6 Digits) *</label>
                  <input type="password" id="set-owner-pin-new" class="form-input" required minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="e.g. 2468" />
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                  <label class="form-label">Confirm Owner PIN *</label>
                  <input type="password" id="set-owner-pin-confirm" class="form-input" required minlength="4" maxlength="6" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="Repeat PIN" />
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="submit" class="btn btn-secondary btn-sm" style="flex: 1 1 140px; justify-content: center;">
                  ${Icons.check(13)} ${hasOwnerPin ? 'Update Owner PIN' : 'Save Owner PIN'}
                </button>
                <button type="button" class="btn btn-primary btn-sm" style="flex: 1 1 160px; justify-content: center;" onclick="App.openSwitchToCashierModal()">
                  ${Icons.lock(13)} Lock to Cashier Mode
                </button>
              </div>
            </form>
          </div>

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
                <div style="font-size: 11px; color: var(--text-muted);">Dynamic localization across menus, bills &amp; reports</div>
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
              <div class="card-title">${Icons.download(16)} Data Backups, JSON Restore &amp; Migration</div>
              <span class="badge badge-primary">Cloud + Offline</span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
              Export full store database into portable JSON, restore any JSON backup (auto-syncs to Firebase if signed in), or download CSV sheets.
            </p>
            <div class="quick-actions-grid" style="margin-top: 14px;">
              <button class="btn btn-secondary btn-sm" onclick="App.exportFullBackup()">
                ${Icons.download(14)} Export Backup (.json)
              </button>
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0; justify-content: center;">
                ${Icons.upload(14)} Restore Backup (.json)
                <input type="file" accept=".json,application/json" style="display: none;" onchange="App.importFullBackup(event)" />
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
    const escErr = cloud.lastError ? this.escapeHtml(cloud.lastError) : '';

    // 1. Pending Backend Config State (Zero manual config paste or guides shown to users)
    if (!cfg) {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 14px; background: var(--bg-input); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="flex: 1 1 240px; min-width: 0;">
            <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">Cloud Account Sync Ready Soon</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.55;">
              Live billing, barcode lookup, and Gemini AI run directly online. Google &amp; Email multi-device sync activates automatically once cloud project credentials are linked in the backend.
            </div>
          </div>
          <span class="badge badge-primary">Live Online OS</span>
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
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Connected Cloud Node</div>
              <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); font-family: var(--font-mono); margin-top: 2px; overflow-wrap: anywhere;">${this.escapeHtml(cfg.projectId)}</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Real-time Firestore Sync Ready</div>
            </div>

            ${escErr ? `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); margin-bottom: 10px; overflow-wrap: anywhere;">${escErr}</div>` : ''}
            ${!status.online ? `<div style="background: var(--warning-light); border: 1px solid var(--warning-border); color: var(--warning); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); margin-bottom: 10px;">Internet connection required to sign in and sync.</div>` : ''}

            <button type="button" class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="CloudSync.signInWithGoogle(App.getFirebaseSignupProfile(false))">
              <span style="font-weight: 900; font-size: 14px;">G</span> Continue with Google
            </button>
          </div>

          <div style="min-width: 0; background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
              <button type="button" class="btn btn-sm ${activeTab === 'signin' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; justify-content: center;" onclick="App.setFirebaseAuthTab('signin')">Sign In</button>
              <button type="button" class="btn btn-sm ${activeTab === 'signup' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1; justify-content: center;" onclick="App.setFirebaseAuthTab('signup')">Create Account</button>
            </div>
            <form onsubmit="event.preventDefault(); App.submitFirebaseAuth();">
              ${activeTab === 'signup' ? `
                <div class="form-row-2">
                  <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Shop / Store Name *</label>
                    <input type="text" id="fb-auth-shop" class="form-input" required placeholder="e.g. Sharma Kirana Mart" />
                  </div>
                  <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Owner Full Name *</label>
                    <input type="text" id="fb-auth-owner" class="form-input" required placeholder="e.g. Rajesh Sharma" />
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Mobile / WhatsApp *</label>
                    <input type="tel" id="fb-auth-phone" class="form-input" required placeholder="+91 98765 43210" />
                  </div>
                  <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Business UPI ID (Optional)</label>
                    <input type="text" id="fb-auth-upi" class="form-input" placeholder="yourname@upi" />
                  </div>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                  <label class="form-label">City / Store Address *</label>
                  <input type="text" id="fb-auth-address" class="form-input" required placeholder="Main Market, City, State" />
                </div>
              ` : ''}
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

    // 3. Connected & Signed In
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

        ${cloud.rulesUpgradeNeeded ? `
          <div style="background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.45); color: #FCD34D; font-size: 12px; padding: 10px 12px; border-radius: var(--radius-md); overflow-wrap: anywhere;">
            <strong>⚠️ Firestore Rules Update Recommended:</strong> Your database is syncing via the v9.0 safety bridge. To enable cloud storage of per-product sales telemetry (<code>soldQty</code> / <code>soldRevenue</code>), learned barcodes &amp; Khata history, paste updated <code>firestore.rules</code> into <strong>Firebase Console → mydukaan24-live → Firestore Database → Rules → Publish</strong>.
          </div>
        ` : ''}

        ${escErr ? `<div style="background: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger); font-size: 12px; padding: 8px 10px; border-radius: var(--radius-md); overflow-wrap: anywhere;"><strong>Sync Notice:</strong> ${escErr}</div>` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr)); gap: 10px;">
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Sync Cache</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #10B981; margin-top: 3px;">Cloud + Local Instant</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Sync Queue</div>
            <div style="font-size: 12.5px; font-weight: 700; color: ${pending > 0 ? 'var(--warning)' : 'var(--text-primary)'}; margin-top: 3px;">${pending} Pending Change(s)</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Last Cloud Sync</div>
            <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary); margin-top: 3px;">${this.escapeHtml(syncedStr)}</div>
          </div>
          <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
            <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Security Isolation</div>
            <div style="font-size: 12.5px; font-weight: 700; color: #60A5FA; margin-top: 3px;">Owner Only (UID Isolated)</div>
          </div>
        </div>

        ${(() => {
          const liveDb = window.DB ? DB.getData() : {};
          const products = liveDb.products || [];
          const totalUnitsSold = DB.roundQty(products.reduce((s, p) => s + (Number(p.soldQty) || 0), 0));
          const customers = liveDb.customers || [];
          const totalCustTxs = customers.reduce((s, c) => s + (Array.isArray(c.transactions) ? c.transactions.length : 0), 0);
          const attEntries = Object.keys(liveDb.attendance || {}).reduce((s, empId) => s + Object.keys((liveDb.attendance || {})[empId] || {}).length, 0);
          const learnedBarcodes = Object.keys((liveDb.barcodeCache && typeof liveDb.barcodeCache === 'object') ? liveDb.barcodeCache : {}).length;
          const telemetryCells = [
            { label: 'SKUs + Units Sold', val: `${products.length} SKUs • ${totalUnitsSold} sold` },
            { label: 'Sales Invoices', val: `${(liveDb.invoices || []).length} bills` },
            { label: 'Customers & Khata', val: `${customers.length} • ${totalCustTxs} TXs` },
            { label: 'Suppliers & Purchases', val: `${(liveDb.suppliers || []).length} • ${(liveDb.purchases || []).length} GRNs` },
            { label: 'Shop Expenses', val: `${(liveDb.expenses || []).length} entries` },
            { label: 'Staff & Attendance', val: `${(liveDb.staff || []).length} staff • ${attEntries} marks` },
            { label: 'Held / Parked Carts', val: `${(liveDb.parkedCarts || []).length} active` },
            { label: 'Learned Barcodes', val: `${learnedBarcodes} synced` },
            { label: 'Settings / PIN / Voice', val: `${(liveDb.shops || []).length} branch • ${this.escapeHtml(liveDb.voiceLang || 'hi-IN')}` }
          ];
          return `
            <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
                ☁️ A–Z Cloud Sync Telemetry (Synced Live Under /users/${uidShort}...)
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 165px), 1fr)); gap: 6px;">
                ${telemetryCells.map(cell => `
                  <div style="background: var(--bg-surface); padding: 6px 9px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); min-width: 0;">
                    <div style="font-size: 10px; color: var(--text-muted);">${cell.label}</div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cell.val}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })()}

        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; padding-top: 4px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="CloudSync.signOutUser()">
            ${Icons.logOut(13)} Sign Out
          </button>
        </div>
      </div>
    `;
  }

  openCloudAuthSection() {
    if (this.isCashierMode()) {
      this.requireOwner('manage Cloud Sync');
      return;
    }
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

  getFirebaseSignupProfile(strict = true) {
    const shopName = (document.getElementById('fb-auth-shop')?.value || '').trim();
    const ownerName = (document.getElementById('fb-auth-owner')?.value || '').trim();
    const phone = (document.getElementById('fb-auth-phone')?.value || '').trim();
    const address = (document.getElementById('fb-auth-address')?.value || '').trim();
    const upiId = (document.getElementById('fb-auth-upi')?.value || '').trim();
    if (!strict && !shopName && !ownerName && !phone && !address && !upiId) return null;
    return { shopName, ownerName, phone, address, upiId };
  }

  async submitFirebaseAuth() {
    if (!window.CloudSync) return;
    const email = (document.getElementById('fb-auth-email')?.value || '').trim();
    const password = document.getElementById('fb-auth-password')?.value || '';
    if (!email || password.length < 6) {
      this.toast('warning', 'Check Details', 'Enter a valid email and password (minimum 6 characters).');
      return;
    }
    let res;
    if (CloudSync.authTab === 'signup') {
      const profile = this.getFirebaseSignupProfile(true);
      if (!profile.shopName || !profile.ownerName || !profile.phone || !profile.address) {
        this.toast('warning', 'Store Details Needed', 'Enter Shop Name, Owner Name, Mobile Number, and Address.');
        return;
      }
      res = await CloudSync.signUpEmail(email, password, profile);
    } else {
      res = await CloudSync.signInEmail(email, password);
    }
    if (res && res.ok) {
      this.updateHeaderStoreName();
      if (this.currentView === 'settings') {
        const container = document.getElementById('main-view-container');
        if (container) this.renderSettingsView(container);
      }
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
      date: DB.getLocalDateStr(),
      time: "12:00 PM",
      customerName: "Ramesh Sharma",
      customerPhone: "9876543210",
      items: [
        { id: "P101", name: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1, price: 235, mrp: 260, gstRate: 0, unit: "bag", total: 235 },
        { id: "P103", name: "Amul Butter 100g", qty: 2, price: 55, mrp: 58, gstRate: 12, unit: "pack", total: 110 }
      ],
      subtotal: 345,
      tax: 13.2,
      gstBreakdown: {
        "0": { rate: 0, taxable: 235, tax: 0 },
        "12": { rate: 12, taxable: 110, tax: 13.2 }
      },
      discount: 0,
      total: 358.2,
      paid: 358.2,
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
    if (Array.isArray(db.shops)) {
      const activeId = db.activeShopId || 'SHOP-1';
      const idx = db.shops.findIndex(s => s && s.id === activeId);
      if (idx >= 0) {
        db.shops[idx] = {
          ...db.shops[idx],
          name: db.shop.name,
          owner: db.shop.owner,
          phone: db.shop.phone,
          gstin: db.shop.gstin,
          upiId: db.shop.upiId,
          address: db.shop.address
        };
      }
    }
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
    const todayStr = DB.getLocalDateStr();
    const isCashier = this.isCashierMode();

    const lowStock = products.filter(p => Number(p.stock || 0) <= Number(p.minStock || 0));
    const expiringProducts = this.getExpiringProducts(products);
    const expiringMeta = expiringProducts.map(p => ({
      product: p,
      ex: window.Inventory && typeof Inventory.getExpiryMeta === 'function' ? Inventory.getExpiryMeta(p.expiryDate) : null
    }));
    const expiredCount = expiringMeta.filter(x => x.ex && x.ex.days < 0).length;
    const debtors = customers.filter(c => (Number(c.balanceDue) || 0) > 0);
    const reg = this.getDailyRegisterSummary(todayStr);

    const notifications = [];

    if (expiringMeta.length) {
      const sampleNames = expiringMeta.slice(0, 2).map(x => {
        const d = x.ex ? x.ex.days : 0;
        return `${this.escapeHtml(x.product.name)} (${d < 0 ? 'Expired' : `${d}d`})`;
      }).join(', ');
      notifications.push({
        type: expiredCount > 0 ? 'danger' : 'warning',
        title: `${expiringMeta.length} Items ${expiredCount > 0 ? 'Expired / Expiring Soon' : 'Expiring in 7 Days'}`,
        desc: `${sampleNames}${expiringMeta.length > 2 ? '...' : ''}`,
        action: () => {
          App.navigate('inventory');
          if (window.Inventory && typeof Inventory.setStockFilter === 'function') {
            Inventory.setStockFilter(expiredCount > 0 && expiredCount === expiringMeta.length ? 'Expired' : 'Expiring7');
          }
        }
      });
    }

    if (lowStock.length) {
      const lowNames = lowStock.slice(0, 2).map(p => this.escapeHtml(p.name)).join(', ');
      notifications.push({
        type: 'warning',
        title: `${lowStock.length} Products Low in Stock`,
        desc: `${lowNames}${lowStock.length > 2 ? '...' : ''} need reordering.`,
        action: () => {
          App.navigate('inventory');
          if (window.Inventory && typeof Inventory.setStockFilter === 'function') {
            Inventory.setStockFilter('Low');
          }
        }
      });
    }

    if (!isCashier && debtors.length) {
      const totalDue = DB.round2(debtors.reduce((s, c) => s + (Number(c.balanceDue) || 0), 0));
      notifications.push({
        type: 'danger',
        title: `₹${totalDue.toLocaleString('en-IN')} Udhaar Pending`,
        desc: `${debtors.length} customer accounts waiting for collection.`,
        action: () => App.navigate('udhaar')
      });
    }

    if (!isCashier) {
      const netToday = DB.round2((reg.cashSales || 0) + (reg.upiSales || 0) + (reg.cardSales || 0));
      notifications.push({
        type: 'info',
        title: "Today's Register Status",
        desc: `₹${netToday.toLocaleString('en-IN')} net collected across ${reg.billCount} bills today.`,
        action: () => App.navigate('dashboard')
      });
    } else if (!notifications.length) {
      notifications.push({
        type: 'info',
        title: 'Counter Ready (Cashier Mode)',
        desc: 'All items in healthy stock with zero upcoming expiries.',
        action: () => App.navigate('pos')
      });
    }

    container.innerHTML = `
      <div class="notification-popover">
        <div class="notification-header">
          <span>Notifications &amp; Alerts</span>
          <span class="badge badge-muted">${notifications.length}</span>
        </div>
        <div class="notification-list">
          ${notifications.map((n, idx) => `
            <div class="notification-item" onclick="App.handleNotifClick(${idx})">
              <span style="color: ${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--primary)'}; flex-shrink: 0;">
                ${Icons.alert(16)}
              </span>
              <div style="min-width: 0;">
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
    const lowStock = products.filter(p => Number(p.stock || 0) <= Number(p.minStock || 0));
    const expiringSoon = this.getExpiringProducts(products, 7);
    const alertCount = lowStock.length + expiringSoon.length;
    const badge = document.getElementById('notification-badge-count');
    if (badge) {
      if (alertCount > 0) {
        badge.textContent = alertCount > 99 ? '99+' : String(alertCount);
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  // Backup Utilities
  exportFullBackup() {
    if (this.isCashierMode()) {
      this.requireOwner('export store backup');
      return;
    }
    const db = DB.getData();
    const jsonStr = JSON.stringify(db, null, 2);
    DB.downloadFile(jsonStr, `mydukkan24_backup_${DB.getLocalDateStr()}.json`, 'application/json');
    this.toast('success', 'Backup Exported', 'Full database downloaded securely');
  }

  async importFullBackup(event) {
    if (this.isCashierMode()) {
      if (event && event.target) event.target.value = '';
      this.requireOwner('restore JSON backup');
      return;
    }
    const input = event && event.target;
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;
    if (input) input.value = '';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.customers)) {
        throw new Error('Backup JSON missing valid products or customers arrays.');
      }

      const currentDb = DB.getData();
      const normalized = {
        ...currentDb,
        ...parsed,
        products: parsed.products.map(p => ({
          ...p,
          id: String(p.id || DB.uid('P')),
          stock: DB.roundQty(p.stock || 0),
          minStock: DB.roundQty(p.minStock || 0),
          price: DB.round2(p.price || 0),
          mrp: DB.round2(p.mrp || p.price || 0),
          cost: DB.round2(p.cost || 0),
          soldQty: p.soldQty !== undefined ? DB.roundQty(p.soldQty || 0) : undefined,
          soldRevenue: p.soldRevenue !== undefined ? DB.round2(p.soldRevenue || 0) : undefined,
          lastSoldAt: p.lastSoldAt !== undefined ? (Number(p.lastSoldAt) || 0) : undefined,
          gstRate: [0, 5, 12, 18].includes(Number(p.gstRate))
            ? Number(p.gstRate)
            : DB.inferDefaultGstRate(p.cat, p.name)
        })),
        customers: parsed.customers.map(c => ({
          ...c,
          id: String(c.id || DB.uid('C')),
          balanceDue: DB.round2(c.balanceDue || 0),
          totalSpent: DB.round2(c.totalSpent || 0),
          transactions: Array.isArray(c.transactions) ? c.transactions.slice(0, 200) : []
        })),
        suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
        purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        staff: Array.isArray(parsed.staff) ? parsed.staff : [],
        parkedCarts: Array.isArray(parsed.parkedCarts) ? parsed.parkedCarts.slice(0, 25) : [],
        attendance: (parsed.attendance && typeof parsed.attendance === 'object' && !Array.isArray(parsed.attendance)) ? parsed.attendance : {},
        barcodeCache: (parsed.barcodeCache && typeof parsed.barcodeCache === 'object' && !Array.isArray(parsed.barcodeCache)) ? parsed.barcodeCache : (currentDb.barcodeCache || {}),
        voiceLang: typeof parsed.voiceLang === 'string' && parsed.voiceLang.trim() ? parsed.voiceLang.trim() : (currentDb.voiceLang || 'hi-IN'),
        ownerPinHash: typeof parsed.ownerPinHash === 'string' ? parsed.ownerPinHash : (currentDb.ownerPinHash || ''),
        geminiKey: currentDb.geminiKey || ''
      };

      if (typeof DB.recomputeProductSalesStats === 'function') {
        DB.recomputeProductSalesStats(normalized, { onlyMissing: true });
      }
      if (normalized.voiceLang) {
        localStorage.setItem('mydukaan24_voice_lang', normalized.voiceLang);
        if (window.POS) window.POS._voiceLang = normalized.voiceLang;
      }
      if (normalized.barcodeCache && typeof DB._writeLocalBarcodeCache === 'function') {
        DB._writeLocalBarcodeCache(normalized.barcodeCache);
      }

      DB.saveData(normalized);
      this.applyTheme();
      this.updateHeaderStoreName();
      this.updateNotificationBadge();

      if (window.CloudSync && CloudSync.user && CloudSync.isOnline()) {
        this.toast('info', 'Syncing Restore...', 'Uploading restored JSON database & pruning old cloud docs...');
        await CloudSync.forceUploadAll({ pruneRemote: true });
      } else {
        this.toast('success', 'Backup Restored', `${normalized.products.length} products & ${normalized.invoices.length} invoices loaded.`);
      }

      setTimeout(() => location.reload(), 900);
    } catch (err) {
      this.toast('danger', 'Restore Failed', err && err.message ? err.message : 'Invalid backup JSON file format');
    }
  }

  resetToFactoryDefaults() {
    if (this.isCashierMode()) {
      this.requireOwner('reset demo data');
      return;
    }
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
        if (this.isCashierMode()) {
          this.requireOwner('open Day-End Cash Register');
          return;
        }
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
                Version 9.3.0 • Size: 4.8 MB • Android 8.0+ / PWA Universal
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
    if (this.isCashierMode()) {
      this.requireOwner('view Day-End Cash Register');
      return;
    }
    const db = DB.getData();
    const reg = this.getDailyRegisterSummary();
    const hasRefunds = reg.cashRefunds > 0 || reg.upiRefunds > 0;

    const modalHtml = `
      <div class="modal-backdrop" id="cash-drawer-modal" onclick="if(event.target===this) App.closeCashDrawerModal()">
        <div class="modal-card" style="max-width: 460px;">
          <div class="modal-header">
            <div class="modal-title">💰 Day-End Cash Register (Counter #1)</div>
            <button class="topbar-icon-btn" onclick="App.closeCashDrawerModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 14px; font-family: var(--font-mono);">
              Date: ${this.escapeHtml(reg.today)} • Store: ${this.escapeHtml((db.shop && db.shop.name) || 'MyDukkan24 Mart')}
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px;">
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Net Cash Collected</div>
                <div style="font-size: 17px; font-weight: 800; color: #10B981; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${reg.cashSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Net UPI Digital</div>
                <div style="font-size: 17px; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${reg.upiSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Card POS</div>
                <div style="font-size: 17px; font-weight: 800; color: #A78BFA; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${reg.cardSales.toLocaleString('en-IN')}
                </div>
              </div>
              <div style="background: var(--bg-surface); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); min-width: 0;">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Udhaar Issued</div>
                <div style="font-size: 17px; font-weight: 800; color: #F43F5E; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${reg.udhaarSales.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
                <span>Total Bills Issued:</span>
                <span style="font-weight: 700; font-family: var(--font-mono);">${reg.billCount} Bills</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
                <span>Total Gross Sales:</span>
                <span style="font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">₹${reg.grossSales.toLocaleString('en-IN')}</span>
              </div>
              ${hasRefunds ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--warning); margin-bottom: 4px;">
                  <span>Today's Sales Refunds (Cash / UPI):</span>
                  <span style="font-weight: 700; font-family: var(--font-mono);">-₹${(reg.cashRefunds + reg.upiRefunds).toLocaleString('en-IN')}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #F87171; margin-bottom: 4px;">
                <span>Today's Cash Expenses:</span>
                <span style="font-weight: 700; font-family: var(--font-mono);">-₹${reg.totalExp.toLocaleString('en-IN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; border-top: 1px dashed var(--border-medium); padding-top: 8px; margin-top: 6px;">
                <span style="color: var(--text-primary);">Net Cash in Counter Drawer:</span>
                <span style="color: #10B981; font-family: var(--font-mono); font-size: 17px;">₹${reg.netCashInDrawer.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary" style="flex: 1 1 170px; justify-content: center;" onclick="App.printDailyZReport()">
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

  printDailyZReport() {
    const db = DB.getData();
    const shop = db.shop || {};
    const reg = this.getDailyRegisterSummary();
    const netCollected = DB.round2(reg.cashSales + reg.upiSales + reg.cardSales);
    const zHtml = `
      <div style="font-family: Arial, sans-serif; color: #111; max-width: 680px; margin: 0 auto;">
        <h2 style="margin: 0 0 4px;">${this.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Day-End Z-Report</h2>
        <div style="font-size: 12px; color: #555; margin-bottom: 16px;">
          Date: ${this.escapeHtml(reg.today)} • Generated: ${new Date().toLocaleTimeString('en-IN')} • GSTIN: ${this.escapeHtml(shop.gstin || 'N/A')}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <tbody>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Bills Issued</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">${reg.billCount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Gross Sales Billed</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">₹${reg.grossSales.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Net Cash Collected</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">₹${reg.cashSales.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Net UPI Digital Collected</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">₹${reg.upiSales.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Card POS Collected</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">₹${reg.cardSales.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Udhaar Credit Issued</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 700;">₹${reg.udhaarSales.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Cash / UPI Refunds Issued</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #b91c1c;">-₹${(reg.cashRefunds + reg.upiRefunds).toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">Paid Cash Expenses</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #b91c1c;">-₹${reg.totalExp.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: 800; font-size: 14px; border-top: 2px solid #111;">Total Net Digital + Cash Collected</td><td style="padding: 10px 8px; text-align: right; font-weight: 800; font-size: 14px; border-top: 2px solid #111;">₹${netCollected.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 10px 8px; font-weight: 800; font-size: 15px; background: #f3f4f6;">Net Cash Expected in Drawer</td><td style="padding: 10px 8px; text-align: right; font-weight: 800; font-size: 15px; background: #f3f4f6;">₹${reg.netCashInDrawer.toLocaleString('en-IN')}</td></tr>
          </tbody>
        </table>
        <div style="font-size: 11px; color: #666;">Verified by Store Owner • MyDukkan24 Retail OS v9.3</div>
      </div>
    `;
    this.printHtmlDocument(zHtml, 'wide');
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
      <div style="color: ${type === 'success' ? 'var(--success)' : type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)'}; flex-shrink: 0;">
        ${Icons.check(16)}
      </div>
      <div style="min-width: 0;">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        ${desc ? `<div class="toast-desc">${this.escapeHtml(desc)}</div>` : ''}
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
