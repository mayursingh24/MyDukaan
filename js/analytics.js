/**
 * MyDukkan24 — Financial Reports, Live Dynamic Analytics & GSTR-1 / Tally Engine
 * Live P&L from real invoices (net of returns), multi-period SVG charts, and GST compliance exports.
 */

class AnalyticsEngine {
  constructor() {
    this.timeRange = '7days'; // 'today', '7days', 'month', 'all'
  }

  setTimeRange(range) {
    this.timeRange = range;
    this.render();
  }

  _getPeriodBounds() {
    const todayStr = DB.getLocalDateStr();
    const sevenDaysAgo = DB.getOffsetDateStr(-6);
    const thirtyDaysAgo = DB.getOffsetDateStr(-29);
    return { todayStr, sevenDaysAgo, thirtyDaysAgo };
  }

  _getFilteredRecords() {
    const db = DB.getData();
    const invoices = db.invoices || [];
    const expenses = db.expenses || [];
    const products = db.products || [];
    const shop = db.shop || {};
    const { todayStr, sevenDaysAgo, thirtyDaysAgo } = this._getPeriodBounds();

    let filteredInvoices = invoices;
    let filteredExpenses = expenses;

    if (this.timeRange === 'today') {
      filteredInvoices = invoices.filter(i => i.date === todayStr);
      filteredExpenses = expenses.filter(e => e.date === todayStr);
    } else if (this.timeRange === '7days') {
      filteredInvoices = invoices.filter(i => (i.date || '') >= sevenDaysAgo);
      filteredExpenses = expenses.filter(e => (e.date || '') >= sevenDaysAgo);
    } else if (this.timeRange === 'month') {
      filteredInvoices = invoices.filter(i => (i.date || '') >= thirtyDaysAgo);
      filteredExpenses = expenses.filter(e => (e.date || '') >= thirtyDaysAgo);
    }

    return { db, invoices, expenses, products, shop, filteredInvoices, filteredExpenses, todayStr, sevenDaysAgo, thirtyDaysAgo };
  }

  _getInvoiceReturnedQtyMap(inv) {
    const map = {};
    (inv.returnedItems || []).forEach(ret => {
      if (!ret || !ret.id) return;
      map[ret.id] = DB.roundQty((map[ret.id] || 0) + (Number(ret.qty) || 0));
    });
    return map;
  }

  _computeInvoiceGstSlabs(inv, products, defaultTaxRate = 5) {
    const slabs = {};
    const grossTotal = Number(inv.total) || 0;
    const refundAmt = Math.min(grossTotal, Math.max(0, Number(inv.refundAmount) || 0));
    const netTotal = DB.round2(Math.max(0, grossTotal - refundAmt));
    const netRatio = grossTotal > 0 ? (netTotal / grossTotal) : 1;

    if (inv.gstBreakdown && typeof inv.gstBreakdown === 'object' && Object.keys(inv.gstBreakdown).length > 0) {
      Object.keys(inv.gstBreakdown).forEach(rateKey => {
        const entry = inv.gstBreakdown[rateKey];
        if (!entry) return;
        const rate = Number(entry.rate !== undefined ? entry.rate : rateKey) || 0;
        const taxable = DB.round2((Number(entry.taxable) || 0) * netRatio);
        const tax = DB.round2((Number(entry.tax) || 0) * netRatio);
        if (!slabs[rate]) slabs[rate] = { rate, taxable: 0, tax: 0 };
        slabs[rate].taxable = DB.round2(slabs[rate].taxable + taxable);
        slabs[rate].tax = DB.round2(slabs[rate].tax + tax);
      });
      return { slabs, netTotal };
    }

    // Legacy fallback for invoices created before gstBreakdown was stored
    const returnedMap = this._getInvoiceReturnedQtyMap(inv);
    const invTaxNet = DB.round2((Number(inv.tax) || 0) * netRatio);
    let rawTaxableSum = 0;
    const itemBuckets = [];

    (inv.items || []).forEach(it => {
      const origQty = Number(it.qty) || 0;
      const retQty = Math.min(origQty, returnedMap[it.id] || 0);
      const effQty = Math.max(0, DB.roundQty(origQty - retQty));
      if (effQty <= 0) return;
      const prod = products.find(p => p.id === it.id);
      const rate = Number(
        it.gstRate !== undefined
          ? it.gstRate
          : (prod && prod.gstRate !== undefined ? prod.gstRate : defaultTaxRate)
      ) || 0;
      const unitPrice = origQty > 0 && it.total ? ((Number(it.total) || 0) / origQty) : (Number(it.price) || 0);
      const lineNet = DB.round2(unitPrice * effQty);
      rawTaxableSum += lineNet;
      itemBuckets.push({ rate, lineNet });
    });

    const discountScale = rawTaxableSum > 0
      ? Math.max(0, (netTotal - invTaxNet) / rawTaxableSum)
      : 1;

    let computedTaxTotal = 0;
    itemBuckets.forEach(b => {
      const adjTaxable = DB.round2(b.lineNet * discountScale);
      const lineTax = DB.round2(adjTaxable * (b.rate / 100));
      computedTaxTotal += lineTax;
      if (!slabs[b.rate]) slabs[b.rate] = { rate: b.rate, taxable: 0, tax: 0 };
      slabs[b.rate].taxable = DB.round2(slabs[b.rate].taxable + adjTaxable);
      slabs[b.rate].tax = DB.round2(slabs[b.rate].tax + lineTax);
    });

    // If recorded invTaxNet differs significantly from calculated rate sum, scale slab tax to match recorded tax
    if (invTaxNet >= 0 && Math.abs(computedTaxTotal - invTaxNet) > 0.5 && computedTaxTotal > 0) {
      const fixRatio = invTaxNet / computedTaxTotal;
      Object.keys(slabs).forEach(k => {
        slabs[k].tax = DB.round2(slabs[k].tax * fixRatio);
      });
    }

    return { slabs, netTotal };
  }

  _parseHour24(timeStr = '') {
    const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return 12;
    let h = parseInt(m[1], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h;
  }

  _buildChartSeries(filteredInvoices) {
    if (this.timeRange === 'today') {
      const buckets = [
        { label: 'Morning', value: 0 },
        { label: 'Afternoon', value: 0 },
        { label: 'Evening', value: 0 },
        { label: 'Night', value: 0 }
      ];
      filteredInvoices.forEach(inv => {
        const net = Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0));
        const h = this._parseHour24(inv.time);
        if (h < 12) buckets[0].value += net;
        else if (h < 16) buckets[1].value += net;
        else if (h < 20) buckets[2].value += net;
        else buckets[3].value += net;
      });
      return {
        title: "Today's Hourly Sales Pulse",
        badge: 'Live Today',
        labels: buckets.map(b => b.label),
        values: buckets.map(b => DB.round2(b.value))
      };
    }

    if (this.timeRange === '7days') {
      const labels = [];
      const values = [];
      for (let offset = -6; offset <= 0; offset++) {
        const dStr = DB.getOffsetDateStr(offset);
        const dt = new Date(dStr + 'T00:00:00');
        const shortDay = offset === 0 ? 'Today' : dt.toLocaleDateString('en-IN', { weekday: 'short' });
        const dayTotal = filteredInvoices
          .filter(inv => inv.date === dStr)
          .reduce((s, inv) => s + Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0)), 0);
        labels.push(shortDay);
        values.push(DB.round2(dayTotal));
      }
      return {
        title: '7-Day Real Revenue Curve',
        badge: 'Last 7 Days',
        labels,
        values
      };
    }

    if (this.timeRange === 'month') {
      const buckets = [
        { label: 'Week 1', from: DB.getOffsetDateStr(-29), to: DB.getOffsetDateStr(-22), value: 0 },
        { label: 'Week 2', from: DB.getOffsetDateStr(-21), to: DB.getOffsetDateStr(-15), value: 0 },
        { label: 'Week 3', from: DB.getOffsetDateStr(-14), to: DB.getOffsetDateStr(-7), value: 0 },
        { label: 'Last 7d', from: DB.getOffsetDateStr(-6), to: DB.getOffsetDateStr(0), value: 0 }
      ];
      filteredInvoices.forEach(inv => {
        const d = inv.date || '';
        const net = Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0));
        const b = buckets.find(bk => d >= bk.from && d <= bk.to);
        if (b) b.value += net;
      });
      return {
        title: '30-Day Weekly Revenue Curve',
        badge: '4 Weeks',
        labels: buckets.map(b => b.label),
        values: buckets.map(b => DB.round2(b.value))
      };
    }

    // All-time chronological trend (group by YYYY-MM, or fallback to dates if single month)
    const monthTotals = {};
    filteredInvoices.forEach(inv => {
      const ym = (inv.date || DB.getLocalDateStr()).slice(0, 7);
      const net = Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0));
      monthTotals[ym] = (monthTotals[ym] || 0) + net;
    });

    const sortedMonths = Object.keys(monthTotals).sort();
    if (sortedMonths.length >= 2) {
      const slice = sortedMonths.slice(-7);
      return {
        title: 'All-Time Monthly Revenue Trend',
        badge: `${slice.length} Months`,
        labels: slice.map(ym => {
          const [y, m] = ym.split('-');
          const d = new Date(Number(y), Number(m) - 1, 1);
          return d.toLocaleDateString('en-IN', { month: 'short' });
        }),
        values: slice.map(ym => DB.round2(monthTotals[ym]))
      };
    }

    // Fallback to day buckets when all invoices fall inside 1 month
    const dateTotals = {};
    filteredInvoices.forEach(inv => {
      const d = inv.date || DB.getLocalDateStr();
      const net = Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0));
      dateTotals[d] = (dateTotals[d] || 0) + net;
    });
    const sortedDates = Object.keys(dateTotals).sort().slice(-7);
    if (sortedDates.length === 0) {
      return {
        title: 'Revenue Trend Curve',
        badge: 'No Data',
        labels: ['Start', 'Today'],
        values: [0, 0]
      };
    }
    if (sortedDates.length === 1) {
      return {
        title: 'All-Time Revenue Curve',
        badge: 'All Time',
        labels: ['Prior', sortedDates[0].slice(5)],
        values: [0, DB.round2(dateTotals[sortedDates[0]])]
      };
    }
    return {
      title: 'All-Time Daily Revenue Curve',
      badge: `${sortedDates.length} Days`,
      labels: sortedDates.map(d => d.slice(5)),
      values: sortedDates.map(d => DB.round2(dateTotals[d]))
    };
  }

  _computeMetrics() {
    const { db, products, shop, filteredInvoices, filteredExpenses } = this._getFilteredRecords();

    const billedRevenue = DB.round2(filteredInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const totalRefunds = DB.round2(filteredInvoices.reduce((s, i) => s + (Number(i.refundAmount) || 0), 0));
    const netRevenue = DB.round2(Math.max(0, billedRevenue - totalRefunds));
    const cashCollected = DB.round2(filteredInvoices.reduce((s, i) => s + Math.max(0, (Number(i.paid) || 0) - (i.refundMode !== 'Adjust Udhaar' ? (Number(i.refundAmount) || 0) : 0)), 0));
    const uncollectedDues = DB.round2(filteredInvoices.reduce((s, i) => s + (Number(i.due) || 0), 0));
    const totalExpenses = DB.round2(filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));

    let cogs = 0;
    const productSalesMap = {};
    const gstSlabSummary = {
      0: { rate: 0, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0, count: 0 },
      5: { rate: 5, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0, count: 0 },
      12: { rate: 12, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0, count: 0 },
      18: { rate: 18, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0, count: 0 }
    };
    const gstInvoiceRows = [];

    filteredInvoices.forEach(inv => {
      const returnedMap = this._getInvoiceReturnedQtyMap(inv);
      const invNet = Math.max(0, (Number(inv.total) || 0) - (Number(inv.refundAmount) || 0));
      const invRatio = (Number(inv.total) || 0) > 0 ? invNet / Number(inv.total) : 1;

      (inv.items || []).forEach(it => {
        const origQty = Number(it.qty) || 0;
        const retQty = Math.min(origQty, returnedMap[it.id] || 0);
        const effQty = Math.max(0, DB.roundQty(origQty - retQty));
        if (effQty <= 0) return;

        const prod = products.find(p => p.id === it.id);
        const unitCost = it.cost !== undefined ? (Number(it.cost) || 0) : (prod ? (Number(prod.cost) || 0) : (Number(it.price) || 0) * 0.8);
        const lineCost = DB.round2(unitCost * effQty);
        const unitSell = origQty > 0 && it.total !== undefined ? ((Number(it.total) || 0) / origQty) : (Number(it.price) || 0);
        const lineRev = DB.round2(unitSell * effQty * invRatio);

        cogs = DB.round2(cogs + lineCost);

        if (!productSalesMap[it.id]) {
          productSalesMap[it.id] = { id: it.id, name: it.name || 'Item', unit: it.unit || prod?.unit || 'unit', qty: 0, revenue: 0, cost: 0 };
        }
        productSalesMap[it.id].qty = DB.roundQty(productSalesMap[it.id].qty + effQty);
        productSalesMap[it.id].revenue = DB.round2(productSalesMap[it.id].revenue + lineRev);
        productSalesMap[it.id].cost = DB.round2(productSalesMap[it.id].cost + lineCost);
      });

      const { slabs, netTotal } = this._computeInvoiceGstSlabs(inv, products, Number(shop.taxRate) || 5);
      let invTaxable = 0;
      let invTax = 0;

      Object.keys(slabs).forEach(rk => {
        const s = slabs[rk];
        const rate = Number(s.rate) || 0;
        if (!gstSlabSummary[rate]) {
          gstSlabSummary[rate] = { rate, taxable: 0, cgst: 0, sgst: 0, tax: 0, gross: 0, count: 0 };
        }
        const halfTax = DB.round2(s.tax / 2);
        const otherHalf = DB.round2(s.tax - halfTax);
        gstSlabSummary[rate].taxable = DB.round2(gstSlabSummary[rate].taxable + s.taxable);
        gstSlabSummary[rate].cgst = DB.round2(gstSlabSummary[rate].cgst + halfTax);
        gstSlabSummary[rate].sgst = DB.round2(gstSlabSummary[rate].sgst + otherHalf);
        gstSlabSummary[rate].tax = DB.round2(gstSlabSummary[rate].tax + s.tax);
        gstSlabSummary[rate].gross = DB.round2(gstSlabSummary[rate].gross + s.taxable + s.tax);
        gstSlabSummary[rate].count += 1;

        invTaxable = DB.round2(invTaxable + s.taxable);
        invTax = DB.round2(invTax + s.tax);
      });

      const invCgst = DB.round2(invTax / 2);
      const invSgst = DB.round2(invTax - invCgst);
      gstInvoiceRows.push({
        id: inv.id,
        date: inv.date || '',
        customerName: inv.customerName || 'Walk-in Customer',
        paymentMode: inv.paymentMode || 'Cash',
        status: inv.status || 'Paid',
        taxable: invTaxable,
        cgst: invCgst,
        sgst: invSgst,
        tax: invTax,
        refundAmount: Number(inv.refundAmount) || 0,
        netTotal: DB.round2(netTotal),
        slabs
      });
    });

    // Unclamped real profitability metrics
    const grossProfit = DB.round2(netRevenue - cogs);
    const netProfit = DB.round2(grossProfit - totalExpenses);
    const profitMargin = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0;

    const productSalesList = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
    const topSellers = productSalesList.slice(0, 5);
    const soldIds = new Set(Object.keys(productSalesMap));
    const slowMovers = products.filter(p => !soldIds.has(p.id)).slice(0, 5);

    const totalInventoryCost = DB.round2(products.reduce((s, p) => s + ((Number(p.cost) || 0) * (Number(p.stock) || 0)), 0));
    const totalInventoryRetail = DB.round2(products.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0));
    const potentialProfit = DB.round2(totalInventoryRetail - totalInventoryCost);

    const chart = this._buildChartSeries(filteredInvoices);

    return {
      db,
      shop,
      filteredInvoices,
      filteredExpenses,
      billedRevenue,
      totalRefunds,
      netRevenue,
      cashCollected,
      uncollectedDues,
      totalExpenses,
      cogs,
      grossProfit,
      netProfit,
      profitMargin,
      topSellers,
      slowMovers,
      totalInventoryCost,
      totalInventoryRetail,
      potentialProfit,
      chart,
      gstSlabSummary,
      gstInvoiceRows
    };
  }

  render() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('view financial analytics, profit & GST reports');
      return;
    }

    const container = document.getElementById('analytics-content-view');
    if (!container) return;

    const m = this._computeMetrics();
    const {
      filteredInvoices,
      filteredExpenses,
      billedRevenue,
      totalRefunds,
      netRevenue,
      cogs,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      topSellers,
      slowMovers,
      totalInventoryCost,
      totalInventoryRetail,
      potentialProfit,
      chart,
      gstSlabSummary,
      gstInvoiceRows
    } = m;

    const vals = chart.values.length >= 2 ? chart.values : [0, chart.values[0] || 0];
    const lbls = chart.labels.length >= 2 ? chart.labels : ['', chart.labels[0] || 'Today'];
    const maxSale = Math.max(1, ...vals);
    const svgW = 540, svgH = 148;
    const pts = vals.map((val, idx) => ({
      x: (idx / Math.max(1, vals.length - 1)) * (svgW - 60) + 30,
      y: svgH - 28 - ((val / maxSale) * (svgH - 54)),
      val,
      label: lbls[idx] || ''
    }));

    const pathD = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${pts[pts.length - 1].x} ${svgH - 24} L ${pts[0].x} ${svgH - 24} Z`;

    const sortedSlabKeys = Object.keys(gstSlabSummary).map(Number).sort((a, b) => a - b);
    const totalGstTax = DB.round2(sortedSlabKeys.reduce((s, r) => s + gstSlabSummary[r].tax, 0));
    const totalTaxable = DB.round2(sortedSlabKeys.reduce((s, r) => s + gstSlabSummary[r].taxable, 0));
    const totalCgst = DB.round2(sortedSlabKeys.reduce((s, r) => s + gstSlabSummary[r].cgst, 0));
    const totalSgst = DB.round2(sortedSlabKeys.reduce((s, r) => s + gstSlabSummary[r].sgst, 0));

    container.innerHTML = `
      <!-- Time Range Selector Toolbar -->
      <div class="card" style="padding: 12px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Reporting Period (Live Store Invoices):</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
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
            <span class="kpi-title">Net Sales Revenue</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.chart(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${netRevenue.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: ${totalRefunds > 0 ? 'var(--warning)' : 'var(--success)'};">
            ${filteredInvoices.length} bills ${totalRefunds > 0 ? `(−₹${totalRefunds.toLocaleString('en-IN')} returns)` : 'recorded'}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Cost of Goods (COGS)</span>
            <div class="kpi-icon-badge" style="background: var(--warning-light); color: var(--warning);">
              ${Icons.package(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${cogs.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Wholesale procurement cost (net of returns)</div>
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
            <span class="kpi-title">Net Take-Home Profit</span>
            <div class="kpi-icon-badge" style="background: ${netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
            ${netProfit < 0 ? '-' : ''}₹${Math.abs(netProfit).toLocaleString('en-IN')}
          </div>
          <div class="kpi-trend" style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${profitMargin}% net margin</div>
        </div>
      </div>

      <!-- Performance Chart & P&L Statement -->
      <div class="responsive-analytics-grid" style="margin-bottom: 24px;">
        <!-- Left: Live SVG Revenue Curve -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div class="card-title">${Icons.chart(16)} ${DB.escapeHtml(chart.title)}</div>
            <span class="badge badge-primary">${DB.escapeHtml(chart.badge)}</span>
          </div>
          <div style="height: 175px; position: relative;">
            <svg viewBox="0 0 ${svgW} ${svgH}" style="width: 100%; height: 100%; overflow: visible;">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#2563EB" stop-opacity="0.34" />
                  <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="20" y1="${svgH - 24}" x2="${svgW - 15}" y2="${svgH - 24}" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="20" y1="22" x2="${svgW - 15}" y2="22" stroke="var(--border-subtle)" stroke-dasharray="3 3" stroke-width="1" />
              <text x="20" y="16" font-size="10" fill="var(--text-muted)">Peak ₹${Math.round(maxSale).toLocaleString('en-IN')}</text>
              <path d="${areaD}" fill="url(#chartGradient)" />
              <path d="${pathD}" fill="none" stroke="#3B82F6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              ${pts.map(p => `
                <g>
                  <title>${DB.escapeHtml(p.label)}: ₹${p.val.toLocaleString('en-IN')}</title>
                  <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#2563EB" stroke="var(--bg-card)" stroke-width="2" />
                  ${p.val > 0 ? `<text x="${p.x}" y="${Math.max(14, p.y - 9)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--text-primary)">₹${Math.round(p.val).toLocaleString('en-IN')}</text>` : ''}
                  <text x="${p.x}" y="${svgH - 6}" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">${DB.escapeHtml(p.label)}</text>
                </g>
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
              <span style="color: var(--text-secondary);">Gross Billed Invoices (+)</span>
              <strong class="tnum">₹${billedRevenue.toLocaleString('en-IN')}</strong>
            </div>
            ${totalRefunds > 0 ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--warning);">Sales Returns & Refunds (-)</span>
                <span style="color: var(--warning);" class="tnum">-₹${totalRefunds.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Cost of Goods Sold (-)</span>
              <span style="color: var(--danger);" class="tnum">-₹${cogs.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px dashed var(--border-subtle); font-weight: 600;">
              <span>Gross Product Margin</span>
              <span class="tnum" style="color: ${grossProfit >= 0 ? 'var(--text-primary)' : 'var(--danger)'};">${grossProfit < 0 ? '-' : ''}₹${Math.abs(grossProfit).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Store Operating Expenses (-)</span>
              <span style="color: var(--danger);" class="tnum">-₹${totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-medium); font-size: 15px; font-weight: 700;">
              <span>Net Take-Home Profit</span>
              <span style="color: ${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'};" class="tnum">
                ${netProfit < 0 ? '-' : ''}₹${Math.abs(netProfit).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- GST Filing Ready Reports (GSTR-1 & Tally Export) -->
      <div class="card" id="analytics-gst-report-card" style="margin-bottom: 24px;">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <div class="card-title">${Icons.fileText ? Icons.fileText(16) : Icons.receipt(16)} GST Filing Ready Reports (GSTR-1 &amp; TallyPrime Export)</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              Slab-wise CGST + SGST summary (0%, 5%, 12%, 18%) net of sales returns • GSTIN: ${DB.escapeHtml(m.shop.gstin || 'Unregistered')}
            </div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="Analytics.exportGstr1CSV()">
              ${Icons.download(13)} GSTR-1 CSV
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Analytics.exportTallyXML()">
              ${Icons.download(13)} Tally XML
            </button>
            <button class="btn btn-primary btn-sm" onclick="Analytics.printGstReport()">
              ${Icons.print(13)} Print GST PDF
            </button>
          </div>
        </div>

        <div class="table-container" style="margin-bottom: 16px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>GST Rate Slab</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>Total Tax</th>
                <th>Gross Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              ${sortedSlabKeys.map(rate => {
                const row = gstSlabSummary[rate];
                return `
                  <tr>
                    <td><span class="badge ${rate === 0 ? 'badge-muted' : rate === 5 ? 'badge-success' : rate === 12 ? 'badge-primary' : 'badge-warning'}">${rate}% GST Slab</span></td>
                    <td class="tnum">₹${row.taxable.toLocaleString('en-IN')}</td>
                    <td class="tnum">₹${row.cgst.toLocaleString('en-IN')}</td>
                    <td class="tnum">₹${row.sgst.toLocaleString('en-IN')}</td>
                    <td class="tnum" style="font-weight: 700;">₹${row.tax.toLocaleString('en-IN')}</td>
                    <td class="tnum" style="font-weight: 700; color: var(--primary);">₹${row.gross.toLocaleString('en-IN')}</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background: var(--bg-input); font-weight: 800;">
                <td>TOTAL TAX LIABILITY</td>
                <td class="tnum">₹${totalTaxable.toLocaleString('en-IN')}</td>
                <td class="tnum">₹${totalCgst.toLocaleString('en-IN')}</td>
                <td class="tnum">₹${totalSgst.toLocaleString('en-IN')}</td>
                <td class="tnum" style="color: var(--success);">₹${totalGstTax.toLocaleString('en-IN')}</td>
                <td class="tnum" style="color: var(--text-primary);">₹${DB.round2(totalTaxable + totalGstTax).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${gstInvoiceRows.length ? `
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
            GSTR-1 Invoice Register (Latest ${Math.min(10, gstInvoiceRows.length)} of ${gstInvoiceRows.length} Invoices)
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th class="hide-mobile-col">Date</th>
                  <th>Customer</th>
                  <th class="hide-mobile-col">Taxable</th>
                  <th>GST (CGST+SGST)</th>
                  <th>Net Total</th>
                </tr>
              </thead>
              <tbody>
                ${gstInvoiceRows.slice(0, 10).map(r => `
                  <tr>
                    <td style="font-family: var(--font-mono); font-weight: 700;">${DB.escapeHtml(r.id)}</td>
                    <td class="hide-mobile-col">${DB.escapeHtml(r.date)}</td>
                    <td>${DB.escapeHtml(r.customerName)}</td>
                    <td class="hide-mobile-col tnum">₹${r.taxable.toLocaleString('en-IN')}</td>
                    <td class="tnum">₹${r.tax.toLocaleString('en-IN')} <span style="font-size: 10.5px; color: var(--text-muted);">(${r.cgst}+${r.sgst})</span></td>
                    <td class="tnum" style="font-weight: 700;">₹${r.netTotal.toLocaleString('en-IN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>

      <!-- Top Sellers vs Slow Moving Grid -->
      <div class="responsive-equal-grid" style="margin-bottom: 24px;">
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
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topSellers.map(p => `
                    <tr>
                      <td style="font-weight: 600;">${DB.escapeHtml(p.name)}</td>
                      <td>${p.qty} ${DB.escapeHtml(p.unit)}</td>
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
                      <td style="font-weight: 600;">${DB.escapeHtml(p.name)}</td>
                      <td>${p.stock} ${DB.escapeHtml(p.unit)}</td>
                      <td style="font-weight: 700;" class="tnum">₹${DB.round2((Number(p.cost) || 0) * (Number(p.stock) || 0)).toLocaleString('en-IN')}</td>
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 155px), 1fr)); gap: 14px;">
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

  _csvEscape(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  _xmlEscape(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  exportGstr1CSV() {
    const m = this._computeMetrics();
    const lines = [
      `# MyDukkan24 GSTR-1 Report (${this.timeRange.toUpperCase()})`,
      `# Store: ${this._csvEscape(m.shop.name || 'MyDukkan24 Mart')} | GSTIN: ${this._csvEscape(m.shop.gstin || 'Unregistered')} | Generated: ${DB.getLocalDateStr()}`,
      '',
      'Section,GST Rate %,Taxable Value,CGST Amount,SGST Amount,Total GST,Gross Value'
    ];

    Object.keys(m.gstSlabSummary).map(Number).sort((a, b) => a - b).forEach(rate => {
      const s = m.gstSlabSummary[rate];
      lines.push(['B2C Slab Summary', `${rate}%`, s.taxable, s.cgst, s.sgst, s.tax, s.gross].map(x => this._csvEscape(x)).join(','));
    });

    lines.push('');
    lines.push('Invoice No,Date,Customer,Payment Mode,Status,Taxable Value,CGST,SGST,Total GST,Refund Deducted,Net Invoice Value');
    m.gstInvoiceRows.forEach(r => {
      lines.push([
        r.id, r.date, r.customerName, r.paymentMode, r.status,
        r.taxable, r.cgst, r.sgst, r.tax, r.refundAmount, r.netTotal
      ].map(x => this._csvEscape(x)).join(','));
    });

    DB.downloadFile(lines.join('\r\n'), `MyDukkan24_GSTR1_${this.timeRange}_${DB.getLocalDateStr()}.csv`, 'text/csv;charset=utf-8');
    App.toast('success', 'GSTR-1 Exported', 'Slab summary & invoice register CSV downloaded');
  }

  exportTallyXML() {
    const m = this._computeMetrics();
    const companyName = this._xmlEscape(m.shop.name || 'MyDukkan24 Mart');

    const vouchersXml = m.gstInvoiceRows.map(r => {
      const tallyDate = (r.date || DB.getLocalDateStr()).replace(/-/g, '');
      const partyLedger = this._xmlEscape(
        r.paymentMode === 'Cash' ? 'Cash' :
        r.paymentMode === 'UPI' ? 'Bank UPI Receipts' :
        r.paymentMode === 'Card' ? 'Bank Card POS' :
        (r.customerName || 'Sundry Debtors')
      );
      const narration = this._xmlEscape(`Invoice ${r.id} (${r.paymentMode}) - MyDukkan24 POS`);
      const netTotal = DB.round2(r.netTotal);
      const taxable = DB.round2(r.taxable);
      const cgst = DB.round2(r.cgst);
      const sgst = DB.round2(r.sgst);

      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${this._xmlEscape(r.id)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
            <NARRATION>${narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${netTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>GST Local Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxable.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${cgst > 0 ? `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>Output CGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
            ` : ''}
            ${sgst > 0 ? `
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>Output SGST</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
            ` : ''}
          </VOUCHER>
        </TALLYMESSAGE>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    DB.downloadFile(xml, `MyDukkan24_TallyPrime_${this.timeRange}_${DB.getLocalDateStr()}.xml`, 'application/xml;charset=utf-8');
    App.toast('success', 'Tally XML Exported', `${m.gstInvoiceRows.length} Sales Vouchers ready for TallyPrime import`);
  }

  printPnLReport() {
    const m = this._computeMetrics();
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 16px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:16px;">
          <div>
            <h2 style="margin:0; font-size:20px;">${DB.escapeHtml(m.shop.name || 'MyDukkan24 Mart')} — Financial P&amp;L Report</h2>
            <div style="font-size:12px; color:#4B5563;">Period: ${DB.escapeHtml(this.timeRange.toUpperCase())} • Printed: ${DB.getLocalDateStr()}</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Owner:</strong> ${DB.escapeHtml(m.shop.owner || '')}</div>
            <div><strong>GSTIN:</strong> ${DB.escapeHtml(m.shop.gstin || 'N/A')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:18px; font-size:13px;">
          <tr style="background:#F3F4F6;"><th style="text-align:left;padding:8px;border:1px solid #D1D5DB;">Financial Metric</th><th style="text-align:right;padding:8px;border:1px solid #D1D5DB;">Amount (₹)</th></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;">Gross Billed Revenue</td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;">₹${m.billedRevenue.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;">Less: Sales Returns &amp; Refunds</td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;">-₹${m.totalRefunds.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;"><strong>Net Sales Revenue</strong></td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;"><strong>₹${m.netRevenue.toLocaleString('en-IN')}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;">Cost of Goods Sold (COGS)</td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;">-₹${m.cogs.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;">Gross Product Margin</td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;">₹${m.grossProfit.toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #D1D5DB;">Store Operating Expenses</td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;">-₹${m.totalExpenses.toLocaleString('en-IN')}</td></tr>
          <tr style="background:#ECFDF5;"><td style="padding:8px;border:1px solid #D1D5DB;"><strong>Net Take-Home Profit (${m.profitMargin}%)</strong></td><td style="padding:8px;border:1px solid #D1D5DB;text-align:right;"><strong>₹${m.netProfit.toLocaleString('en-IN')}</strong></td></tr>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }

  printGstReport() {
    const m = this._computeMetrics();
    const slabKeys = Object.keys(m.gstSlabSummary).map(Number).sort((a, b) => a - b);
    const totalTaxable = DB.round2(slabKeys.reduce((s, r) => s + m.gstSlabSummary[r].taxable, 0));
    const totalCgst = DB.round2(slabKeys.reduce((s, r) => s + m.gstSlabSummary[r].cgst, 0));
    const totalSgst = DB.round2(slabKeys.reduce((s, r) => s + m.gstSlabSummary[r].sgst, 0));
    const totalTax = DB.round2(slabKeys.reduce((s, r) => s + m.gstSlabSummary[r].tax, 0));

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 16px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:16px;">
          <div>
            <h2 style="margin:0; font-size:20px;">${DB.escapeHtml(m.shop.name || 'MyDukkan24 Mart')} — GSTR-1 Tax Summary</h2>
            <div style="font-size:12px; color:#4B5563;">Period: ${DB.escapeHtml(this.timeRange.toUpperCase())} • Date: ${DB.getLocalDateStr()}</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>GSTIN:</strong> ${DB.escapeHtml(m.shop.gstin || 'Unregistered')}</div>
            <div><strong>Phone:</strong> ${DB.escapeHtml(m.shop.phone || '')}</div>
          </div>
        </div>
        <h3 style="font-size:14px; margin:0 0 8px;">1. GST Slab Breakup (0%, 5%, 12%, 18%)</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:18px; font-size:12.5px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:left;">Slab</th>
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:right;">Taxable (₹)</th>
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:right;">CGST (₹)</th>
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:right;">SGST (₹)</th>
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:right;">Total GST (₹)</th>
              <th style="padding:7px;border:1px solid #D1D5DB;text-align:right;">Gross (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${slabKeys.map(r => {
              const s = m.gstSlabSummary[r];
              return `<tr>
                <td style="padding:7px;border:1px solid #D1D5DB;">${r}% GST</td>
                <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${s.taxable.toLocaleString('en-IN')}</td>
                <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${s.cgst.toLocaleString('en-IN')}</td>
                <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${s.sgst.toLocaleString('en-IN')}</td>
                <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${s.tax.toLocaleString('en-IN')}</td>
                <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${s.gross.toLocaleString('en-IN')}</td>
              </tr>`;
            }).join('')}
            <tr style="background:#F9FAFB; font-weight:700;">
              <td style="padding:7px;border:1px solid #D1D5DB;">TOTAL</td>
              <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${totalTaxable.toLocaleString('en-IN')}</td>
              <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${totalCgst.toLocaleString('en-IN')}</td>
              <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${totalSgst.toLocaleString('en-IN')}</td>
              <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${totalTax.toLocaleString('en-IN')}</td>
              <td style="padding:7px;border:1px solid #D1D5DB;text-align:right;">₹${DB.round2(totalTaxable + totalTax).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        <h3 style="font-size:14px; margin:0 0 8px;">2. Invoice Register (${m.gstInvoiceRows.length} Invoices)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:left;">Invoice</th>
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:left;">Date</th>
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:left;">Customer</th>
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:right;">Taxable</th>
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:right;">GST</th>
              <th style="padding:6px;border:1px solid #D1D5DB;text-align:right;">Net Total</th>
            </tr>
          </thead>
          <tbody>
            ${m.gstInvoiceRows.map(r => `
              <tr>
                <td style="padding:6px;border:1px solid #D1D5DB;">${DB.escapeHtml(r.id)}</td>
                <td style="padding:6px;border:1px solid #D1D5DB;">${DB.escapeHtml(r.date)}</td>
                <td style="padding:6px;border:1px solid #D1D5DB;">${DB.escapeHtml(r.customerName)}</td>
                <td style="padding:6px;border:1px solid #D1D5DB;text-align:right;">₹${r.taxable.toLocaleString('en-IN')}</td>
                <td style="padding:6px;border:1px solid #D1D5DB;text-align:right;">₹${r.tax.toLocaleString('en-IN')}</td>
                <td style="padding:6px;border:1px solid #D1D5DB;text-align:right;">₹${r.netTotal.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }
}

window.Analytics = new AnalyticsEngine();
