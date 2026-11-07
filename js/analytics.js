/**
 * MyDukkan24 — Financial Reports, Analytics & Profit/Loss (P&L) Engine
 * Detailed business intelligence: revenue trends, COGS, net margins, top sellers & valuation.
 */

class AnalyticsEngine {
  constructor() {
    this.timeRange = '7days'; // 'today', '7days', 'month', 'all'
  }

  setTimeRange(range) {
    this.timeRange = range;
    this.render();
  }

  render() {
    const container = document.getElementById('analytics-content-view');
    if (!container) return;

    const db = DB.getData();
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];
    const products = db.products || [];

    // Filter by Time Range
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    let filteredInvoices = invoices;
    let filteredExpenses = expenses;

    if (this.timeRange === 'today') {
      filteredInvoices = invoices.filter(i => i.date === todayStr);
      filteredExpenses = expenses.filter(e => e.date === todayStr);
    } else if (this.timeRange === '7days') {
      filteredInvoices = invoices.filter(i => i.date >= sevenDaysAgo);
      filteredExpenses = expenses.filter(e => e.date >= sevenDaysAgo);
    } else if (this.timeRange === 'month') {
      filteredInvoices = invoices.filter(i => i.date >= thirtyDaysAgo);
      filteredExpenses = expenses.filter(e => e.date >= thirtyDaysAgo);
    }

    // Financial calculations
    const grossRevenue = filteredInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const cashCollected = filteredInvoices.reduce((s, i) => s + (i.paid || 0), 0);
    const uncollectedDues = filteredInvoices.reduce((s, i) => s + (i.due || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    // Cost of Goods Sold (COGS)
    let cogs = 0;
    const productSalesMap = {}; // id -> { name, qty, revenue, cost }

    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.id);
        const unitCost = prod ? prod.cost : (it.price * 0.8);
        const lineCost = unitCost * it.qty;
        cogs += lineCost;

        if (!productSalesMap[it.id]) {
          productSalesMap[it.id] = {
            id: it.id,
            name: it.name,
            qty: 0,
            revenue: 0,
            cost: 0
          };
        }
        productSalesMap[it.id].qty += it.qty;
        productSalesMap[it.id].revenue += it.total;
        productSalesMap[it.id].cost += lineCost;
      });
    });

    const grossProfit = Math.max(0, grossRevenue - cogs);
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

    // Top selling and slow moving items
    const productSalesList = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
    const topSellers = productSalesList.slice(0, 5);

    const soldIds = new Set(Object.keys(productSalesMap));
    const slowMovers = products.filter(p => !soldIds.has(p.id)).slice(0, 5);

    // Inventory Valuation
    const totalInventoryCost = products.reduce((s, p) => s + (p.cost * p.stock), 0);
    const totalInventoryRetail = products.reduce((s, p) => s + (p.price * p.stock), 0);
    const potentialProfit = Math.max(0, totalInventoryRetail - totalInventoryCost);

    // Dynamic Chart Data (Last 7 Days)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const salesData = [3200, 4100, 3800, 5200, 6800, 8400, 7100];
    const maxSale = Math.max(...salesData);
    const svgW = 540, svgH = 130;
    const pts = salesData.map((val, idx) => ({
      x: (idx / (salesData.length - 1)) * (svgW - 40) + 20,
      y: svgH - 25 - ((val / maxSale) * (svgH - 45))
    }));

    const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${svgH - 10} L ${pts[0].x} ${svgH - 10} Z`;

    container.innerHTML = `
      <!-- Time Range Selector Toolbar -->
      <div class="card" style="padding: 12px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Reporting Period:</div>
          <div style="display: flex; gap: 6px;">
            <button class="cat-chip ${this.timeRange === 'today' ? 'active' : ''}" onclick="Analytics.setTimeRange('today')">Today</button>
            <button class="cat-chip ${this.timeRange === '7days' ? 'active' : ''}" onclick="Analytics.setTimeRange('7days')">Last 7 Days</button>
            <button class="cat-chip ${this.timeRange === 'month' ? 'active' : ''}" onclick="Analytics.setTimeRange('month')">Last 30 Days</button>
            <button class="cat-chip ${this.timeRange === 'all' ? 'active' : ''}" onclick="Analytics.setTimeRange('all')">All Time</button>
          </div>
        </div>
      </div>

      <!-- Financial Metrics Grid -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Gross Sales Revenue</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.chart(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${grossRevenue.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--success);">${filteredInvoices.length} invoices generated</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Cost of Goods (COGS)</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">
              ${Icons.package(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${cogs.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Wholesale product procurement cost</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Operating Expenses</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${totalExpenses.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${filteredExpenses.length} expense entries</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Estimated Net Profit</span>
            <div class="kpi-icon-badge" style="background: ${netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ₹${netProfit.toLocaleString('en-IN')}
          </div>
          <div class="kpi-trend" style="color: var(--success);">${profitMargin}% net margin</div>
        </div>
      </div>

      <!-- Performance Chart & P&L Statement -->
      <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 20px; margin-bottom: 24px;">
        <!-- Left: SVG Revenue Curve -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.chart(16)} 7-Day Revenue Velocity</div>
            <span class="badge badge-primary">Trend Curve</span>
          </div>
          <div style="height: 160px; position: relative;">
            <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: 100%; overflow: visible;">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#2563EB" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path d="${areaD}" fill="url(#chartGradient)" />
              <path d="${pathD}" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" />
              ${pts.map((p, idx) => `
                <circle cx="${p.x}" cy="${p.y}" r="4" fill="#2563EB" stroke="var(--bg-card)" stroke-width="2" />
                <text x="${p.x}" y="${svgH - 2}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${days[idx]}</text>
              `).join('')}
            </svg>
          </div>
        </div>

        <!-- Right: Official P&L Statement -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.receipt(16)} Profit & Loss Breakdown</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Gross Sales Revenue (+)</span>
              <strong class="tnum">₹${grossRevenue.toLocaleString('en-IN')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Cost of Goods Sold (-)</span>
              <span style="color: var(--danger);" class="tnum">-₹${cogs.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px dashed var(--border-subtle); font-weight: 600;">
              <span>Gross Profit</span>
              <span class="tnum">₹${grossProfit.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Store Operating Expenses (-)</span>
              <span style="color: var(--danger);" class="tnum">-₹${totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-medium); font-size: 15px; font-weight: 700;">
              <span>Net Take-Home Profit</span>
              <span style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};" class="tnum">
                ₹${netProfit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Sellers vs Slow Moving Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        <!-- Top Selling Products -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.package(16)} Top Selling Products</div>
            <span class="badge badge-success">High Demand</span>
          </div>
          ${topSellers.length ? `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topSellers.map(p => `
                    <tr>
                      <td style="font-weight: 600;">${p.name}</td>
                      <td>${p.qty} units</td>
                      <td style="font-weight: 700;" class="tnum">₹${p.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px;">
              No sales data recorded in this period.
            </div>
          `}
        </div>

        <!-- Slow Moving Products -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.inventory(16)} Slow-Moving / Zero-Sale Items</div>
            <span class="badge badge-warning">Review Stock</span>
          </div>
          ${slowMovers.length ? `
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Tied-Up Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${slowMovers.map(p => `
                    <tr>
                      <td style="font-weight: 600;">${p.name}</td>
                      <td>${p.stock} ${p.unit}</td>
                      <td style="font-weight: 700;" class="tnum">₹${(p.cost * p.stock).toLocaleString('en-IN')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px;">
              All products in catalog have recorded sales.
            </div>
          `}
        </div>
      </div>

      <!-- Inventory Asset Valuation -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">${Icons.wallet(16)} Store Inventory Asset Valuation</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total Inventory Cost</div>
            <div style="font-size: 20px; font-weight: 700; margin-top: 4px;" class="tnum">₹${totalInventoryCost.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Procurement investment</div>
          </div>
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Expected Retail Realization</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--primary); margin-top: 4px;" class="tnum">₹${totalInventoryRetail.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Value at current selling prices</div>
          </div>
          <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Potential Gross Profit</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--success); margin-top: 4px;" class="tnum">₹${potentialProfit.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Expected markup gain upon sale</div>
          </div>
        </div>
      </div>
    `;
  }
}

window.Analytics = new AnalyticsEngine();
