/**
 * MyDukkan24 — Customer Management & Digital Udhaar Khata (Credit Ledger)
 * Engineered for Indian retail stores to track debts, settlements, and WhatsApp reminders.
 */

class KhataEngine {
  constructor() {
    this.searchQuery = "";
  }

  setSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.render();
  }

  render() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('access Customer Udhaar Khata ledger');
      return;
    }

    const listContainer = document.getElementById('khata-customer-list');
    const summaryRow = document.getElementById('khata-kpi-row');
    if (!listContainer) return;

    const db = DB.getData();
    let customers = db.customers || [];

    const totalCustomers = customers.length;
    const totalDues = DB.round2(customers.reduce((sum, c) => sum + (Number(c.balanceDue) || 0), 0));
    const totalCollected = DB.round2(customers.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0));
    const customersWithDue = customers.filter(c => (Number(c.balanceDue) || 0) > 0);

    // Update Udhaar badge in sidebar
    const navBadge = document.getElementById('nav-udhaar-badge');
    if (navBadge) {
      navBadge.textContent = totalDues > 0 ? `₹${totalDues.toLocaleString('en-IN')}` : 'Clear';
    }

    if (summaryRow) {
      summaryRow.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Outstanding Dues</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.book(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: ${totalDues > 0 ? 'var(--danger)' : 'var(--success)'};">
            ₹${totalDues.toLocaleString('en-IN')}
          </div>
          <div class="kpi-trend" style="color: var(--danger);">
            ${customersWithDue.length} accounts with pending balance
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Lifetime Spend</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${totalCollected.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">Recorded revenue from khata profiles</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Active Customer Accounts</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.users(16)}
            </div>
          </div>
          <div class="kpi-val">${totalCustomers}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered customer directory</div>
        </div>
      `;
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
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div>${Icons.users(36)}</div>
          <div style="font-weight: 600; font-size: 14px; margin-top: 8px;">No customer accounts found</div>
          <p style="font-size: 12px; margin-top: 4px;">Click "Add Customer" to create your first credit khata profile.</p>
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
              <div style="width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--radius-md); background: var(--bg-input); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: var(--primary);">
                ${DB.escapeHtml((c.name || 'C').charAt(0).toUpperCase())}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                  <span>${DB.escapeHtml(c.name)}</span>
                  <span class="badge ${c.tier === 'Gold' ? 'badge-warning' : c.tier === 'Silver' ? 'badge-primary' : 'badge-muted'}">
                    ${DB.escapeHtml(c.tier || 'Regular')}
                  </span>
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
                <div style="font-size: 11px; color: var(--text-muted);">Points: ${c.points || 0}</div>
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
                <button class="btn btn-secondary btn-sm" onclick="Khata.openCustomerLedger('${DB.escapeHtml(c.id)}')" title="View Order History">
                  ${Icons.receipt(14)} History
                </button>
                <button class="btn btn-secondary btn-sm" onclick="Khata.openCustomerModal(DB.getData().customers.find(x => x.id === '${DB.escapeHtml(c.id)}'))" title="Edit Customer">
                  ${Icons.edit(14)}
                </button>
                <button class="btn btn-danger btn-sm" onclick="Khata.deleteCustomer('${DB.escapeHtml(c.id)}')" title="Delete Profile">
                  ${Icons.trash(14)}
                </button>
              </div>
            </div>
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
            <div class="modal-footer" style="padding: 14px 0 0; background: none;">
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
    } else if (window.App && (App.currentView === 'udhaar' || App.currentView === 'customers')) {
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
      this.render();
    }
  }

  closeModal() {
    ['khata-payment-modal', 'khata-ledger-modal', 'customer-form-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}

window.Khata = new KhataEngine();
