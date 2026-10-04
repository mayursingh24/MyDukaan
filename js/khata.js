/**
 * MyDukaan Pro — Customer Udhaar Khata & CRM Ledger Engine
 * Created & Deployed by Mayur Singh
 */

class KhataEngine {
  constructor() {
    this.searchQuery = "";
  }

  render() {
    const listContainer = document.getElementById('khata-customer-list');
    const summaryRow = document.getElementById('khata-kpi-row');
    if (!listContainer) return;

    const db = DB.getData();
    let customers = db.customers;

    const totalCustomers = customers.length;
    const totalDues = customers.reduce((sum, c) => sum + (c.balanceDue || 0), 0);
    const totalCollected = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const customersWithDue = customers.filter(c => (c.balanceDue || 0) > 0);

    if (summaryRow) {
      summaryRow.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Udhaar (Dues)</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">⏳</div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">₹${totalDues.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--warning);">${customersWithDue.length} customers pending</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Revenue Collected</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">💰</div>
          </div>
          <div class="kpi-val" style="color: var(--success);">₹${totalCollected.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">Lifetime spent</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Customer Base</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">👥</div>
          </div>
          <div class="kpi-val">${totalCustomers}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered profiles</div>
        </div>
      `;
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q)
      );
    }

    if (!customers.length) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          No customer accounts found
        </div>
      `;
      return;
    }

    listContainer.innerHTML = customers.map(c => {
      const hasDue = c.balanceDue > 0;
      const db = DB.getData();
      const shop = db.shop;

      // WhatsApp Due Reminder Link
      const reminderMsg = `Namaste ${c.name} ji 🙏,%0A%0A` +
        `This is a gentle reminder regarding your pending balance of *₹${c.balanceDue.toLocaleString('en-IN')}* at *${encodeURIComponent(shop.name)}*.%0A%0A` +
        `You can easily pay via UPI to: *${encodeURIComponent(shop.upiId)}*%0A%0A` +
        `Thank you for your cooperation! Billed via MyDukaan Pro • Dev: Mayur Singh`;

      const waLink = c.phone ? `https://wa.me/91${c.phone}?text=${reminderMsg}` : `https://wa.me/?text=${reminderMsg}`;

      return `
        <div class="card" style="margin-bottom: 12px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 10px; background: var(--bg-input); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: var(--primary);">
                ${c.name.charAt(0)}
              </div>
              <div>
                <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                  ${c.name}
                  <span class="badge ${c.tier === 'Gold' ? 'badge-warning' : c.tier === 'Silver' ? 'badge-primary' : 'badge-muted'}">
                    ${c.tier || 'Regular'}
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  📞 ${c.phone} ${c.notes ? `• ${c.notes}` : ''}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="text-align: right;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Outstanding Due</div>
                <div style="font-size: 18px; font-weight: 800; color: ${hasDue ? 'var(--warning)' : 'var(--success)'};">
                  ${hasDue ? `₹${c.balanceDue.toLocaleString('en-IN')}` : '₹0 (Clear)'}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Points: ⭐ ${c.points || 0}</div>
              </div>

              <div style="display: flex; gap: 6px;">
                ${hasDue ? `
                  <button class="btn btn-success btn-sm" onclick="Khata.openRecordPaymentModal('${c.id}')">
                    💰 Receive Cash
                  </button>
                  <a href="${waLink}" target="_blank" class="btn btn-secondary btn-sm" title="Send WhatsApp Reminder">
                    📱 WhatsApp
                  </a>
                ` : ''}
                <button class="btn btn-secondary btn-sm" onclick="Khata.openCustomerLedger('${c.id}')">
                  📋 Ledger
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
    const db = DB.getData();
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return;

    const modalHtml = `
      <div class="modal-backdrop" id="khata-payment-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 420px;">
          <div class="modal-header">
            <div style="font-weight: 700;">💰 Record Udhaar Payment — ${customer.name}</div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; margin-bottom: 14px;">
              <div style="font-size: 12px; color: var(--text-muted);">Current Pending Due</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--warning);">₹${customer.balanceDue}</div>
            </div>

            <form onsubmit="event.preventDefault(); Khata.savePaymentRecord('${customer.id}');">
              <div class="form-group">
                <label class="form-label">Amount Received (₹) *</label>
                <input type="number" step="0.01" id="khata-pay-amount" class="form-input" required max="${customer.balanceDue}" value="${customer.balanceDue}" />
              </div>

              <div class="form-group">
                <label class="form-label">Payment Method *</label>
                <select id="khata-pay-mode" class="form-select">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <input type="text" id="khata-pay-notes" class="form-input" placeholder="e.g. Paid in shop" />
              </div>

              <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-success" style="flex: 1;">✓ Confirm Payment</button>
                <button type="button" class="btn btn-secondary" onclick="Khata.closeModal()">Cancel</button>
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
    const amount = parseFloat(document.getElementById('khata-pay-amount').value) || 0;
    const mode = document.getElementById('khata-pay-mode').value;
    const notes = document.getElementById('khata-pay-notes').value.trim();

    if (amount <= 0) {
      App.toast('danger', 'Invalid Amount', 'Enter a positive amount');
      return;
    }

    const db = DB.getData();
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return;

    customer.balanceDue = Math.max(0, customer.balanceDue - amount);
    DB.saveData(db);

    DB.playCashChime();
    this.closeModal();
    App.toast('success', 'Payment Received', `₹${amount} recorded for ${customer.name}`);
    this.render();
  }

  // Customer Ledger Modal
  openCustomerLedger(customerId) {
    const db = DB.getData();
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return;

    const invoices = db.invoices.filter(i => i.customerId === customerId);

    const modalHtml = `
      <div class="modal-backdrop" id="khata-ledger-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 580px;">
          <div class="modal-header">
            <div>
              <div style="font-weight: 700; font-size: 16px;">📋 Khata Ledger — ${customer.name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${customer.phone} • Balance: ₹${customer.balanceDue}</div>
            </div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px;">Order & Bill History (${invoices.length})</div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill #</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.length ? invoices.map(inv => `
                    <tr>
                      <td>${inv.date}</td>
                      <td style="font-family: var(--font-mono); font-weight: 600;">${inv.id}</td>
                      <td>${inv.items.length} items</td>
                      <td style="font-weight: 700;">₹${inv.total}</td>
                      <td>
                        <span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">
                          ${inv.status}
                        </span>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No past invoices recorded</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // Add new customer modal
  openAddCustomerModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="add-cust-modal" onclick="if(event.target === this) Khata.closeModal()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div style="font-weight: 700;">➕ Register New Customer</div>
            <button class="topbar-icon-btn" onclick="Khata.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Khata.saveCustomerForm();">
              <div class="form-group">
                <label class="form-label">Customer Name *</label>
                <input type="text" id="cust-name-input" class="form-input" required placeholder="e.g. Rajesh Kumar" />
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" id="cust-phone-input" class="form-input" required placeholder="10-digit mobile number" />
              </div>
              <div class="form-group">
                <label class="form-label">Starting Udhaar Balance (₹)</label>
                <input type="number" id="cust-due-input" class="form-input" placeholder="0" value="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Notes</label>
                <input type="text" id="cust-notes-input" class="form-input" placeholder="e.g. Regular neighbour" />
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Customer</button>
                <button type="button" class="btn btn-secondary" onclick="Khata.closeModal()">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveCustomerForm() {
    const name = document.getElementById('cust-name-input').value.trim();
    const phone = document.getElementById('cust-phone-input').value.trim();
    const balanceDue = parseFloat(document.getElementById('cust-due-input').value) || 0;
    const notes = document.getElementById('cust-notes-input').value.trim();

    if (!name || !phone) {
      App.toast('danger', 'Validation', 'Name and Phone are required');
      return;
    }

    const newCust = {
      id: `C${Date.now().toString().slice(-4)}`,
      name,
      phone,
      balanceDue,
      totalSpent: 0,
      points: 0,
      tier: "Regular",
      notes
    };

    DB.updateItem('customers', newCust);
    this.closeModal();
    App.toast('success', 'Customer Registered', name);
    this.render();
  }

  closeModal() {
    ['khata-payment-modal', 'khata-ledger-modal', 'add-cust-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}

window.Khata = new KhataEngine();
