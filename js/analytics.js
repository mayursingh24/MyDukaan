/**
 * MyDukaan Pro — Analytics, Reports & P&L Engine
 * Created & Deployed by Mayur Singh
 */

class AnalyticsEngine {
  render() {
    const container = document.getElementById('analytics-content-view');
    if (!container) return;

    const db = DB.getData();
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];
    const products = db.products || [];

    // Financial Metrics
    const totalRevenue = invoices.reduce((s, i) => s + (i.paid || 0), 0);
    const totalUdhaar = invoices.reduce((s, i) => s + (i.due || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Cost of goods sold (COGS)
    let cogs = 0;
    invoices.forEach(inv => {
      inv.items.forEach(it => {
        const prod = products.find(p => p.id === it.id);
        const unitCost = prod ? prod.cost : (it.price * 0.8);
        cogs += (unitCost * it.qty);
      });
    });

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // SVG Weekly Sales Line Graph
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const salesData = [1850, 2400, 1950, 3100, 4200, 5600, 4800];
    const maxSale = Math.max(...salesData);
    const svgW = 500, svgH = 120;
    const pts = salesData.map((val, idx) => ({
      x: (idx / (salesData.length - 1)) * (svgW - 40) + 20,
      y: svgH - 20 - ((val / maxSale) * (svgH - 40))
    }));

    const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${svgH - 10} L ${pts[0].x} ${svgH - 10} Z`;

    // Expense Categories
    const expenseCats = {};
    expenses.forEach(e => {
      expenseCats[e.cat] = (expenseCats[e.cat] || 0) + e.amount;
    });

    container.innerHTML = `
      <!-- Financial Overview KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Gross Revenue</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">📈</div>
          </div>
          <div class="kpi-val">₹${totalRevenue.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">+14% vs last week</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Total Operating Costs</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">💸</div>
          </div>
          <div class="kpi-val">₹${totalExpenses.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Rent, Bills & Salary</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Net Profit</span>
            <div class="kpi-icon-badge" style="background: var(--success-light); color: var(--success);">💵</div>
          </div>
          <div class="kpi-val" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ₹${netProfit.toLocaleString('en-IN')}
          </div>
          <div class="kpi-trend" style="color: var(--success);">${profitMargin}% profit margin</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Uncollected Udhaar</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">⏳</div>
          </div>
          <div class="kpi-val" style="color: var(--warning);">₹${totalUdhaar.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--warning);">Pending in market</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- Weekly Sales SVG Chart -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">📊 7-Day Revenue Trend</div>
            <span class="badge badge-primary">Real-time Graph</span>
          </div>
          <div style="height: 160px; position: relative;">
            <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: 100%; overflow: visible;" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <path d="${areaD}" fill="url(#areaGradient)" />
              <path d="${pathD}" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              ${pts.map((p, i) => `
                <circle cx="${p.x}" cy="${p.y}" r="4" fill="#3B82F6" stroke="#162032" stroke-width="2">
                  <title>${days[i]}: ₹${salesData[i]}</title>
                </circle>
              `).join('')}
            </svg>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 10px 0; border-top: 1px solid var(--border-subtle); font-size: 11px; color: var(--text-muted);">
            ${days.map(d => `<span>${d}</span>`).join('')}
          </div>
        </div>

        <!-- Profit & Loss Summary Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">📑 P&L Statement</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Sales Revenue</span>
              <span style="font-weight: 700; color: var(--text-primary);">₹${totalRevenue}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Cost of Goods (COGS)</span>
              <span style="color: var(--danger);">-₹${Math.round(cogs)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 6px;">
              <span style="font-weight: 600;">Gross Profit</span>
              <span style="font-weight: 700; color: var(--success);">₹${Math.round(grossProfit)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Operating Expenses</span>
              <span style="color: var(--danger);">-₹${totalExpenses}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-medium); padding-top: 8px; font-size: 14.5px; font-weight: 800;">
              <span>Net In-Pocket Profit</span>
              <span style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">₹${netProfit}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Expense Categories Breakdown -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💸 Store Expenses Breakdown</div>
          <button class="btn btn-primary btn-sm" onclick="Analytics.openAddExpenseModal()">➕ Add Expense</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px;">
          ${Object.entries(expenseCats).map(([cat, amt]) => {
            const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
            return `
              <div style="background: var(--bg-input); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="font-weight: 700; color: var(--text-primary);">${cat}</span>
                  <span style="color: var(--text-muted);">${pct}%</span>
                </div>
                <div style="font-size: 16px; font-weight: 800; color: var(--danger);">₹${amt.toLocaleString('en-IN')}</div>
                <div style="height: 4px; background: rgba(255,255,255,0.06); border-radius: 10px; margin-top: 8px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: var(--primary);"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(e => `
                <tr>
                  <td>${e.date}</td>
                  <td style="font-weight: 600;">${e.desc}</td>
                  <td><span class="badge badge-muted">${e.cat}</span></td>
                  <td style="font-weight: 700; color: var(--danger);">₹${e.amount}</td>
                  <td><span class="badge ${e.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${e.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  openAddExpenseModal() {
    const modalHtml = `
      <div class="modal-backdrop" id="add-expense-modal" onclick="if(event.target === this) Analytics.closeModal()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div style="font-weight: 700;">➕ Record New Expense</div>
            <button class="topbar-icon-btn" onclick="Analytics.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Analytics.saveExpense();">
              <div class="form-group">
                <label class="form-label">Expense Description *</label>
                <input type="text" id="exp-desc" class="form-input" required placeholder="e.g. Electric Bill, Chai & Snacks" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="exp-cat" class="form-select">
                    ${['Rent', 'Utilities', 'Salary', 'Logistics', 'Inventory Stock', 'Maintenance', 'Snacks & Tea', 'Misc'].map(c => `
                      <option value="${c}">${c}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (₹) *</label>
                  <input type="number" step="0.01" id="exp-amt" class="form-input" required placeholder="500" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Payment Status</label>
                  <select id="exp-status" class="form-select">
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Date</label>
                  <input type="date" id="exp-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Expense</button>
                <button type="button" class="btn btn-secondary" onclick="Analytics.closeModal()">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    this.closeModal();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  saveExpense() {
    const desc = document.getElementById('exp-desc').value.trim();
    const cat = document.getElementById('exp-cat').value;
    const amount = parseFloat(document.getElementById('exp-amt').value) || 0;
    const status = document.getElementById('exp-status').value;
    const date = document.getElementById('exp-date').value || new Date().toISOString().split('T')[0];

    if (!desc || amount <= 0) {
      App.toast('danger', 'Validation', 'Description and valid amount are required');
      return;
    }

    const newExp = {
      id: `E${Date.now().toString().slice(-4)}`,
      desc,
      cat,
      amount,
      status,
      date
    };

    DB.updateItem('expenses', newExp);
    this.closeModal();
    App.toast('success', 'Expense Logged', `${desc} (₹${amount})`);
    this.render();
  }

  closeModal() {
    const m = document.getElementById('add-expense-modal');
    if (m) m.remove();
  }
}

window.Analytics = new AnalyticsEngine();
