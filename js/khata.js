/**
 * MyDukkan24 — Customer Management & Digital Udhaar Khata (Credit Ledger)
 * Engineered for Indian retail stores to track debts, settlements, and WhatsApp reminders.
 */

class KhataEngine {
  constructor() {
    this.searchQuery = "";
    this.udhaarFilter = "pending"; // 'pending' | 'all' | 'clear'
    this.crmSearch = "";
    this.crmTier = "All";
    this.crmSort = "spent";
  }

  setSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.render();
  }

  setUdhaarFilter(filter) {
    this.udhaarFilter = filter || 'pending';
    this.render();
  }

  setCrmSearch(val) {
    this.crmSearch = (val || '').toLowerCase().trim();
    this.renderCustomersView();
  }

  setCrmTier(tier) {
    this.crmTier = tier || 'All';
    this.renderCustomersView();
  }

  setCrmSort(sortBy) {
    this.crmSort = sortBy || 'spent';
    this.renderCustomersView();
  }

  billCustomer(customerId) {
    if (!window.POS || !window.App) return;
    POS.selectedCustomerId = customerId || '';
    App.navigate('pos');
  }

  render() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('access Customer Udhaar Khata ledger');
      return;
    }

    const listContainer = document.getElementById('khata-customer-list');
    const summaryRow = document.getElementById('khata-kpi-row');
    document.querySelectorAll('[data-udhaar-filter]').forEach(btn => {
      const isMatch = btn.dataset.udhaarFilter === this.udhaarFilter;
      btn.classList.toggle('btn-primary', isMatch);
      btn.classList.toggle('btn-secondary', !isMatch);
    });
    if (!listContainer) return;

    const db = DB.getData();
    let customers = [...(db.customers || [])];

    const totalCustomers = customers.length;
    const totalDues = DB.round2(customers.reduce((sum, c) => sum + (Number(c.balanceDue) || 0), 0));
    const totalCollected = DB.round2(customers.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0));
    const customersWithDue = customers.filter(c => (Number(c.balanceDue) || 0) > 0);
    const avgDue = customersWithDue.length ? DB.round2(totalDues / customersWithDue.length) : 0;

    // Update Udhaar badge in sidebar
    const navBadge = document.getElementById('nav-udhaar-badge');
    if (navBadge) {
      navBadge.textContent = totalDues > 0 ? `₹${totalDues.toLocaleString('en-IN')}` : 'Clear';
    }

    if (summaryRow) {
      summaryRow.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Pending Udhaar Recovery</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.book(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: ${totalDues > 0 ? 'var(--danger)' : 'var(--success)'};">
            ₹${totalDues.toLocaleString('en-IN')}
          </div>
          <div class="kpi-trend" style="color: var(--danger);">
            ${customersWithDue.length} account(s) owing dues • Avg ₹${avgDue.toLocaleString('en-IN')}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Credit Sales Settled/Billed</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${totalCollected.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">Lifetime khata turnover across ${totalCustomers} accounts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Cleared Accounts</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.check(16)}
            </div>
          </div>
          <div class="kpi-val">${totalCustomers - customersWithDue.length} / ${totalCustomers}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Zero pending balance accounts</div>
        </div>
      `;
    }

    // Apply Udhaar status filter (Pending / All / Cleared) and sort highest dues first
    customers.sort((a, b) => (Number(b.balanceDue) || 0) - (Number(a.balanceDue) || 0));
    if (this.udhaarFilter === 'pending') {
      customers = customers.filter(c => (Number(c.balanceDue) || 0) > 0);
    } else if (this.udhaarFilter === 'clear') {
      customers = customers.filter(c => (Number(c.balanceDue) || 0) <= 0);
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      customers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    if (!customers.length) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
          <div>${Icons.book(34)}</div>
          <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">
            ${this.udhaarFilter === 'pending' && totalCustomers > 0 ? 'All customer Udhaar balances are clear!' : 'No matching Udhaar accounts found'}
          </div>
          ${this.udhaarFilter === 'pending' && totalCustomers > 0 ? `
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="Khata.setUdhaarFilter('all')">Show All ${totalCustomers} Accounts</button>
          ` : ''}
        </div>
      `;
      return;
    }

    const shop = db.shop || {};
    listContainer.innerHTML = customers.map(c => {
      const due = DB.round2(c.balanceDue || 0);
      const hasDue = due > 0;

      // Build WhatsApp reminder message
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const reminderMsg = `Namaste ${encodeURIComponent(c.name || 'Customer')} ji,%0A%0A` +
        `This is a gentle payment reminder from *${encodeURIComponent(shop.name || 'MyDukkan24')}*.%0A` +
        `Your outstanding balance due is: *₹${due.toLocaleString('en-IN')}*.%0A%0A` +
        `You can conveniently pay via UPI to: *${encodeURIComponent(shop.upiId || '6306437348@upi')}*%0A%0A` +
        `Thank you for shopping with us! Billed via MyDukkan24.`;

      const waLink = cleanPhone ?
        `https://wa.me/91${cleanPhone.slice(-10)}?text=${reminderMsg}` :
        `https://wa.me/?text=${reminderMsg}`;

      return `
        <div class="card" style="margin-bottom: 12px; padding: 14px 16px;">
          <div class="khata-card-row">
            <div class="khata-customer-main">
              <div style="width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--radius-md); background: var(--bg-input); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: ${hasDue ? 'var(--danger)' : 'var(--success)'};">
                ${DB.escapeHtml((c.name || 'C').charAt(0).toUpperCase())}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <span>${DB.escapeHtml(c.name)}</span>
                  <span class="badge ${hasDue ? 'badge-danger' : 'badge-success'}">${hasDue ? 'Due Pending' : 'Clear'}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px; word-break: break-word;">
                  Phone: ${DB.escapeHtml(c.phone || 'N/A')} ${c.notes ? `• ${DB.escapeHtml(c.notes)}` : ''}
                </div>
              </div>
            </div>

            <div class="khata-card-right">
              <div class="khata-balance-block">
                <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px;">Balance Due</div>
                <div style="font-size: 16px; font-weight: 700; color: ${hasDue ? 'var(--danger)' : 'var(--success)'};" class="tnum">
                  ${hasDue ? `₹${due.toLocaleString('en-IN')}` : '₹0 (Clear)'}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Lifetime: ₹${DB.round2(c.totalSpent || 0).toLocaleString('en-IN')}</div>
              </div>

              <div class="khata-card-actions">
                ${hasDue ? `
                  <button class="btn btn-success btn-sm" onclick="Khata.openRecordPaymentModal('${DB.escapeHtml(c.id)}')">
                    ${Icons.wallet(14)} Settle
                  </button>
                  <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Send WhatsApp Due Reminder">
                    ${Icons.whatsapp(14)} Remind
                  </a>
                ` : ''}
                <button class="btn btn-secondary btn-sm" onclick="Khata.printCustomerStatement('${DB.escapeHtml(c.id)}')" title="Print Customer Khata Statement">
                  ${Icons.print(14)} Print
                </button>
                <button class="btn btn-secondary btn-sm" onclick="Khata.openCustomerLedger('${DB.escapeHtml(c.id)}')" title="View Order History">
                  ${Icons.receipt(14)} Ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Dedicated CUSTOMERS DIRECTORY & LOYALTY CRM View ('customers')
  renderCustomersView() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('access Customer Directory & CRM');
      return;
    }

    const listEl = document.getElementById('customers-crm-grid');
    const kpiEl = document.getElementById('customers-crm-kpi-row');
    if (!listEl) return;

    const db = DB.getData();
    const rawCustomers = db.customers || [];
    const invoices = db.invoices || [];

    const enriched = rawCustomers.map(c => {
      const custInvoices = invoices.filter(inv => inv.customerId === c.id);
      const orderCount = custInvoices.length;
      const lastOrder = custInvoices.map(i => i.date || '').filter(Boolean).sort().pop() || 'Never';
      const billedTotal = DB.round2(custInvoices.reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.refundAmount) || 0)), 0));
      return {
        ...c,
        orderCount,
        lastOrder,
        lifetimeSpend: Math.max(Number(c.totalSpent) || 0, billedTotal)
      };
    });

    const goldCount = enriched.filter(c => c.tier === 'Gold').length;
    const totalPoints = enriched.reduce((s, c) => s + (Number(c.points) || 0), 0);
    const totalLifetime = DB.round2(enriched.reduce((s, c) => s + c.lifetimeSpend, 0));

    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-title">Registered Customers</span><div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">${Icons.users(16)}</div></div>
          <div class="kpi-val">${enriched.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Saved buyer profiles</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-title">VIP Gold Members</span><div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">${Icons.sparkles(16)}</div></div>
          <div class="kpi-val" style="color: var(--warning);">${goldCount}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">High-repeat neighborhood buyers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-title">Loyalty Points Issued</span><div class="kpi-icon-badge" style="background: rgba(139,92,246,0.14); color: #A78BFA;">${Icons.chart(16)}</div></div>
          <div class="kpi-val tnum">${totalPoints.toLocaleString('en-IN')} pts</div>
          <div class="kpi-trend" style="color: var(--text-muted);">1 pt per ₹100 spend</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-title">Lifetime Customer Value</span><div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">${Icons.wallet(16)}</div></div>
          <div class="kpi-val tnum">₹${totalLifetime.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">Total revenue from CRM profiles</div>
        </div>
      `;
    }

    let filtered = [...enriched];
    if (this.crmTier !== 'All') {
      filtered = filtered.filter(c => (c.tier || 'Bronze') === this.crmTier);
    }
    if (this.crmSearch) {
      const q = this.crmSearch;
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    }

    if (this.crmSort === 'orders') filtered.sort((a, b) => b.orderCount - a.orderCount);
    else if (this.crmSort === 'points') filtered.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
    else if (this.crmSort === 'name') filtered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    else filtered.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

    if (!filtered.length) {
      listEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
          ${Icons.users(34)}
          <div style="font-weight: 700; font-size: 14px; margin-top: 8px;">No customers match your filter</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const tierBadge = c.tier === 'Gold' ? 'badge-warning' : c.tier === 'Silver' ? 'badge-primary' : 'badge-muted';
      const due = DB.round2(c.balanceDue || 0);
      return `
        <div class="catalog-sku-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                <div style="width: 38px; height: 38px; flex-shrink: 0; border-radius: var(--radius-md); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px;">
                  ${DB.escapeHtml((c.name || 'C').charAt(0).toUpperCase())}
                </div>
                <div style="min-width: 0;">
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${DB.escapeHtml(c.name)}</div>
                  <div style="font-size: 11.5px; color: var(--text-muted);">${DB.escapeHtml(c.phone || 'N/A')}</div>
                </div>
              </div>
              <span class="badge ${tierBadge}">${DB.escapeHtml(c.tier || 'Bronze')}</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: var(--bg-input); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 11.5px; margin-bottom: 8px;">
              <div><div style="color: var(--text-muted); font-size: 10px;">Lifetime Spend</div><strong class="tnum" style="color: var(--text-primary);">₹${c.lifetimeSpend.toLocaleString('en-IN')}</strong></div>
              <div><div style="color: var(--text-muted); font-size: 10px;">Loyalty Points</div><strong class="tnum" style="color: var(--primary);">${c.points || 0} pts</strong></div>
              <div><div style="color: var(--text-muted); font-size: 10px;">Orders</div><strong>${c.orderCount} bills</strong></div>
              <div><div style="color: var(--text-muted); font-size: 10px;">Last Visit</div><strong>${DB.escapeHtml(c.lastOrder)}</strong></div>
            </div>

            ${c.email ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px;">Email: ${DB.escapeHtml(c.email)}</div>` : ''}
            <div style="font-size: 11.5px; color: ${due > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;">
              ${due > 0 ? `Udhaar Due: ₹${due.toLocaleString('en-IN')}` : '✓ Account Settled'}
            </div>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
            <button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="Khata.billCustomer('${DB.escapeHtml(c.id)}')">
              ⚡ New Bill
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Khata.openCustomerLedger('${DB.escapeHtml(c.id)}')" title="Purchase History">
              ${Icons.receipt(13)}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Khata.printCustomerStatement('${DB.escapeHtml(c.id)}')" title="Print Profile Statement">
              ${Icons.print(13)}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Khata.openCustomerModal(DB.getData().customers.find(x => x.id === '${DB.escapeHtml(c.id)}'))" title="Edit">
              ${Icons.edit(13)}
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="Khata.deleteCustomer('${DB.escapeHtml(c.id)}')" title="Delete">
              ${Icons.trash(13)}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Record payment against customer due
  openRecordPaymentModal(customerId) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('settle customer Udhaar balances');
      return;
    }

    const db = DB.getData();
    const customer = (db.customers || []).find(c => c.id === customerId);
    if (!customer) return;

    const bal = DB.round2(customer.balanceDue || 0);
    const modalHtml = `
      <div class="modal-backdrop" id="khata-payment-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 420px;">
          <div class="modal-header">
            <div class="modal-title">
              ${Icons.wallet(16)} Settle Udhaar — ${DB.escapeHtml(customer.name)}
            </div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 14px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Current Pending Balance</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--danger); margin-top: 2px;" class="tnum">₹${bal.toLocaleString('en-IN')}</div>
            </div>

            <form onsubmit="event.preventDefault(); Khata.savePaymentRecord('${DB.escapeHtml(customer.id)}');">
              <div class="form-group">
                <label class="form-label">Amount Received (₹) *</label>
                <input type="number" step="0.01" min="0.01" id="khata-pay-amount" class="form-input" required max="${bal}" value="${bal}" />
              </div>

              <div class="form-group">
                <label class="form-label">Payment Mode *</label>
                <select id="khata-pay-mode" class="form-select">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Payment Notes (Optional)</label>
                <input type="text" id="khata-pay-notes" class="form-input" placeholder="e.g. Paid cash at counter" />
              </div>

              <div class="modal-footer" style="padding: 14px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="Khata.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">
                  ${Icons.check(14)} Confirm Payment
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

  savePaymentRecord(customerId) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('record customer Udhaar settlement');
      return;
    }

    const amount = DB.round2(parseFloat(document.getElementById('khata-pay-amount').value) || 0);
    const mode = document.getElementById('khata-pay-mode').value;
    const notes = document.getElementById('khata-pay-notes').value.trim();

    if (amount <= 0) {
      App.toast('danger', 'Invalid Amount', 'Enter a valid payment amount');
      return;
    }

    const db = DB.getData();
    const customer = (db.customers || []).find(c => c.id === customerId);
    if (!customer) return;

    customer.balanceDue = DB.round2(Math.max(0, (Number(customer.balanceDue) || 0) - amount));
    if (notes) {
      customer.notes = `${customer.notes ? customer.notes + ' | ' : ''}Paid ₹${amount} via ${mode} (${notes})`.slice(0, 200);
    }
    DB.saveData(db);

    DB.playCashChime();
    this.closeModal();
    App.toast('success', 'Payment Settled', `Received ₹${amount} (${mode}) from ${customer.name}`);
    this.render();
    if (document.getElementById('customers-crm-grid')) this.renderCustomersView();
  }

  // Customer Ledger Modal (Purchase History)
  openCustomerLedger(customerId) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('view customer credit ledger');
      return;
    }

    const db = DB.getData();
    const customer = (db.customers || []).find(c => c.id === customerId);
    if (!customer) return;

    const invoices = (db.invoices || []).filter(i => i.customerId === customerId);

    const modalHtml = `
      <div class="modal-backdrop" id="khata-ledger-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 560px;">
          <div class="modal-header">
            <div>
              <div class="modal-title">${Icons.receipt(16)} Ledger — ${DB.escapeHtml(customer.name)}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Phone: ${DB.escapeHtml(customer.phone || 'N/A')} • Pending Balance: ₹${DB.round2(customer.balanceDue || 0)}
              </div>
            </div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Order History (${invoices.length} transactions)</div>
            ${invoices.length ? `
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice #</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${invoices.map(inv => `
                      <tr>
                        <td>${DB.escapeHtml(inv.date)}</td>
                        <td style="font-family: var(--font-mono); font-weight: 600;">${DB.escapeHtml(inv.id)}</td>
                        <td>${(inv.items || []).length} items</td>
                        <td style="font-weight: 700;" class="tnum">₹${DB.round2(inv.total).toLocaleString('en-IN')}</td>
                        <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Refunded' ? 'badge-danger' : 'badge-warning'}">${DB.escapeHtml(inv.status)}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
                No orders recorded for this customer yet.
              </div>
            `}
            <div class="modal-footer" style="padding: 14px 0 0; background: none; display: flex; gap: 8px; justify-content: flex-end;">
              <button class="btn btn-primary" onclick="Khata.printCustomerStatement('${DB.escapeHtml(customer.id)}')">
                ${Icons.print(14)} Print Statement
              </button>
              <button class="btn btn-secondary" onclick="Khata.closeModal()">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Add / Edit Customer Modal
  openCustomerModal(customer = null) {
    const isEdit = !!customer;
    const isCashier = window.App && typeof App.isCashierMode === 'function' && App.isCashierMode();
    if (isEdit && isCashier) {
      App.requireOwner('edit customer credit profiles');
      return;
    }

    const modalHtml = `
      <div class="modal-backdrop" id="customer-form-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 460px;">
          <div class="modal-header">
            <div class="modal-title">
              ${isEdit ? Icons.edit(16) : Icons.users(16)}
              <span>${isEdit ? 'Edit Customer Profile' : 'Add New Customer Profile'}</span>
            </div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Khata.saveCustomerForm('${isEdit ? DB.escapeHtml(customer.id) : ''}');">
              <div class="form-group">
                <label class="form-label">Customer Name *</label>
                <input type="text" id="cust-name" class="form-input" required placeholder="e.g. Ramesh Sharma" value="${isEdit ? DB.escapeHtml(customer.name) : ''}" />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Phone Number *</label>
                  <input type="text" id="cust-phone" class="form-input" required placeholder="e.g. 9876543210" value="${isEdit ? DB.escapeHtml(customer.phone) : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Loyalty Tier</label>
                  <select id="cust-tier" class="form-select">
                    <option value="Bronze" ${isEdit && customer.tier === 'Bronze' ? 'selected' : ''}>Bronze Tier</option>
                    <option value="Silver" ${isEdit && customer.tier === 'Silver' ? 'selected' : ''}>Silver Tier</option>
                    <option value="Gold" ${isEdit && customer.tier === 'Gold' ? 'selected' : ''}>Gold Tier</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Email Address (Optional)</label>
                <input type="email" id="cust-email" class="form-input" placeholder="e.g. ramesh@gmail.com" value="${isEdit ? DB.escapeHtml(customer.email || '') : ''}" />
              </div>

              ${!isCashier ? `
                <div class="form-group">
                  <label class="form-label">Opening Udhaar Balance (₹)</label>
                  <input type="number" step="0.01" id="cust-balance" class="form-input" placeholder="0" value="${isEdit ? (Number(customer.balanceDue) || 0) : '0'}" />
                </div>
              ` : `<input type="hidden" id="cust-balance" value="0" />`}

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <input type="text" id="cust-notes" class="form-input" placeholder="e.g. Regular neighbourhood buyer" value="${isEdit ? DB.escapeHtml(customer.notes || '') : ''}" />
              </div>

              <div class="modal-footer" style="padding: 14px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="Khata.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  ${Icons.check(14)} ${isEdit ? 'Update Customer' : 'Save Customer'}
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

  saveCustomerForm(editId = '') {
    const isCashier = window.App && typeof App.isCashierMode === 'function' && App.isCashierMode();
    if (editId && isCashier) {
      App.requireOwner('edit customer profile');
      return;
    }

    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const tier = document.getElementById('cust-tier').value;
    const email = document.getElementById('cust-email').value.trim();
    const balanceDue = isCashier ? 0 : DB.round2(parseFloat(document.getElementById('cust-balance').value) || 0);
    const notes = document.getElementById('cust-notes').value.trim();

    if (!name || !phone) {
      App.toast('danger', 'Validation Error', 'Customer name and phone number are required');
      return;
    }

    const db = DB.getData();
    let createdId = '';

    if (editId) {
      const cust = (db.customers || []).find(c => c.id === editId);
      if (cust) {
        cust.name = name;
        cust.phone = phone;
        cust.tier = tier;
        cust.email = email;
        cust.balanceDue = balanceDue;
        cust.notes = notes;
        DB.saveData(db);
        App.toast('success', 'Updated', `${name} profile updated`);
      }
    } else {
      createdId = DB.uid('C');
      const newCust = {
        id: createdId,
        name,
        phone,
        email,
        tier,
        balanceDue,
        totalSpent: 0,
        points: 0,
        notes
      };
      if (!Array.isArray(db.customers)) db.customers = [];
      db.customers.unshift(newCust);
      DB.saveData(db);
      App.toast('success', 'Created', `${name} added to customer list`);
    }

    this.closeModal();
    if (window.App && App.currentView === 'pos' && window.POS) {
      if (createdId) POS.selectedCustomerId = createdId;
      POS.renderCart();
    } else if (window.App && App.currentView === 'customers') {
      this.renderCustomersView();
    } else if (window.App && App.currentView === 'udhaar') {
      this.render();
    }
  }

  deleteCustomer(id) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('delete customer profile');
      return;
    }

    const db = DB.getData();
    const cust = (db.customers || []).find(c => c.id === id);
    if (!cust) return;

    if (confirm(`Delete khata profile for "${cust.name}"?`)) {
      DB.deleteItem('customers', id);
      App.toast('info', 'Deleted', `${cust.name} removed from customer list`);
      if (window.App && App.currentView === 'customers') this.renderCustomersView();
      else this.render();
    }
  }

  printCustomerStatement(customerId) {
    const db = DB.getData();
    const shop = db.shop || {};
    const cust = (db.customers || []).find(c => c.id === customerId);
    if (!cust) return;
    const invoices = (db.invoices || []).filter(i => i.customerId === customerId);
    const due = DB.round2(cust.balanceDue || 0);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 760px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Customer Account Statement</h2>
            <div style="font-size:12px; color:#4B5563;">Customer: <strong>${DB.escapeHtml(cust.name)}</strong> • Phone: ${DB.escapeHtml(cust.phone || 'N/A')}</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Statement Date:</strong> ${DB.getLocalDateStr()}</div>
            <div style="color: ${due > 0 ? '#DC2626' : '#059669'}; font-weight:700;">Balance Due: ₹${due.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Date</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Invoice #</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Payment</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Total</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.length ? invoices.map(inv => `
              <tr>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(inv.date || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; font-family:monospace;">${DB.escapeHtml(inv.id)}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(inv.paymentMode || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${DB.round2(inv.total || 0).toLocaleString('en-IN')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${DB.escapeHtml(inv.status || '')}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="padding:10px; border:1px solid #D1D5DB; text-align:center; color:#6B7280;">No invoice rows recorded yet. Opening Balance: ₹${due.toLocaleString('en-IN')}</td></tr>`}
          </tbody>
        </table>
        <div style="font-size:12px; color:#374151; border-top:1px dashed #CBD5E1; padding-top:8px;">
          UPI Payment ID: <strong>${DB.escapeHtml(shop.upiId || '6306437348@upi')}</strong> • Total Lifetime Spend: ₹${DB.round2(cust.totalSpent || 0).toLocaleString('en-IN')} • Loyalty Points: ${cust.points || 0}
        </div>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }

  printKhataSummary() {
    const db = DB.getData();
    const shop = db.shop || {};
    const customers = [...(db.customers || [])].sort((a, b) => (Number(b.balanceDue) || 0) - (Number(a.balanceDue) || 0));
    const totalDues = DB.round2(customers.reduce((s, c) => s + (Number(c.balanceDue) || 0), 0));
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Udhaar Khata Dues Statement</h2>
            <div style="font-size:12px; color:#4B5563;">Printed: ${DB.getLocalDateStr()} • ${customers.filter(c => (Number(c.balanceDue) || 0) > 0).length} Pending Accounts</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Total Receivable:</strong> ₹${totalDues.toLocaleString('en-IN')}</div>
            <div><strong>UPI ID:</strong> ${DB.escapeHtml(shop.upiId || '6306437348@upi')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Customer</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Phone</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Lifetime Spend</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Balance Due</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td style="padding:6px; border:1px solid #D1D5DB; font-weight:700;">${DB.escapeHtml(c.name)}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(c.phone || '')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right;">₹${DB.round2(c.totalSpent || 0).toLocaleString('en-IN')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB; text-align:right; font-weight:700; color: ${(Number(c.balanceDue) || 0) > 0 ? '#DC2626' : '#059669'};">₹${DB.round2(c.balanceDue || 0).toLocaleString('en-IN')}</td>
                <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(c.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }

  printCustomersDirectory() {
    const db = DB.getData();
    const shop = db.shop || {};
    const customers = db.customers || [];
    const invoices = db.invoices || [];
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Customers &amp; Loyalty Directory</h2>
            <div style="font-size:12px; color:#4B5563;">Printed: ${DB.getLocalDateStr()} • ${customers.length} Customer Profiles</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Gold Tier:</strong> ${customers.filter(c => c.tier === 'Gold').length}</div>
            <div><strong>Total Points:</strong> ${customers.reduce((s, c) => s + (Number(c.points) || 0), 0)}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Name</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:left;">Phone</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Tier</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Orders</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:center;">Points</th>
              <th style="padding:6px; border:1px solid #D1D5DB; text-align:right;">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(c => {
              const ordCount = invoices.filter(i => i.customerId === c.id).length;
              return `
                <tr>
                  <td style="padding:6px; border:1px solid #D1D5DB; font-weight:700;">${DB.escapeHtml(c.name)}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB;">${DB.escapeHtml(c.phone || '')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${DB.escapeHtml(c.tier || 'Bronze')}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${ordCount}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:center;">${c.points || 0}</td>
                  <td style="padding:6px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${DB.round2(c.totalSpent || 0).toLocaleString('en-IN')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }

  closeModal() {
    ['khata-payment-modal', 'khata-ledger-modal', 'customer-form-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}

window.Khata = new KhataEngine();
