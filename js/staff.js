/**
 * MyDukkan24 — Employees Directory & Attendance Management Engine
 * Staff tracking, 31-day visual attendance calendar, and payroll estimation.
 */

class StaffEngine {
  render() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('manage staff & payroll');
      return;
    }

    const container = document.getElementById('staff-content-view');
    if (!container) return;

    const db = DB.getData();
    const staffList = db.staff || [];
    const attendance = db.attendance || {};

    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const todayDateNum = today.getDate();

    const totalSalaryBudget = staffList.reduce((s, st) => s + (Number(st.salary) || 0), 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Active Team Members</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">
              ${Icons.staff(16)}
            </div>
          </div>
          <div class="kpi-val">${staffList.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered employees & cashiers</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Monthly Payroll Budget</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">
              ${Icons.wallet(16)}
            </div>
          </div>
          <div class="kpi-val tnum">₹${totalSalaryBudget.toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Base salary allocation</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${Icons.calendar(16)} Monthly Attendance — ${DB.escapeHtml(currentMonth)}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              Click any date button to cycle status: Present (Green) → Half-Day (Amber) → Absent (Red)
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="Staff.printAttendanceReport()">
              ${Icons.print(14)} Print Muster Roll
            </button>
            <button class="btn btn-primary btn-sm" onclick="Staff.openAddStaffModal()">
              ${Icons.plus(14)} Add Employee
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${staffList.map(emp => {
            const empAtt = attendance[emp.id] || {};
            let presentCount = 0;
            let halfCount = 0;
            let leaveCount = 0;

            for (let d = 1; d <= todayDateNum; d++) {
              const status = empAtt[d] || 'present';
              if (status === 'present') presentCount++;
              else if (status === 'half') halfCount++;
              else leaveCount++;
            }

            // Estimate pro-rated salary for current month
            const effectiveDays = presentCount + (halfCount * 0.5);
            const estPay = Math.round(((Number(emp.salary) || 0) / daysInMonth) * effectiveDays);

            return `
              <div style="background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 200px;">
                    <div style="width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--radius-md); background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                      ${DB.escapeHtml((emp.name || 'S').charAt(0).toUpperCase())}
                    </div>
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${DB.escapeHtml(emp.name)}</div>
                      <div style="font-size: 11.5px; color: var(--text-muted); word-break: break-word;">
                        ${DB.escapeHtml(emp.role)} • Phone: ${DB.escapeHtml(emp.phone || '')} • ₹${(Number(emp.salary) || 0).toLocaleString('en-IN')}/month
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <span class="badge badge-success">${presentCount} Present</span>
                    <span class="badge badge-warning">${halfCount} Half</span>
                    <span class="badge badge-danger">${leaveCount} Absent</span>
                    <span class="badge badge-primary" title="Estimated Earned Pay so far">Est: ₹${estPay.toLocaleString('en-IN')}</span>
                    <button class="btn btn-danger btn-sm" onclick="Staff.deleteStaff('${DB.escapeHtml(emp.id)}')" title="Delete employee">
                      ${Icons.trash(13)}
                    </button>
                  </div>
                </div>

                <!-- 31 Days Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)); gap: 4px;">
                  ${Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const isFuture = day > todayDateNum;
                    const status = isFuture ? 'future' : (empAtt[day] || 'present');
                    const color = status === 'present' ? 'var(--success)' : status === 'half' ? 'var(--warning)' : status === 'leave' ? 'var(--danger)' : 'var(--border-subtle)';
                    const bg = status === 'present' ? 'var(--success-light)' : status === 'half' ? 'var(--warning-light)' : status === 'leave' ? 'var(--danger-light)' : 'transparent';

                    return `
                      <button
                        style="height: 32px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid ${color}; background: ${bg}; color: ${isFuture ? 'var(--text-muted)' : color}; cursor: ${isFuture ? 'default' : 'pointer'};"
                        ${isFuture ? 'disabled' : `onclick="Staff.cycleAttendance('${DB.escapeHtml(emp.id)}', ${day})"`}
                        title="Day ${day}: ${status}"
                      >
                        ${day}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  cycleAttendance(empId, day) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('edit staff attendance');
      return;
    }

    const db = DB.getData();
    if (!db.attendance) db.attendance = {};
    if (!db.attendance[empId]) db.attendance[empId] = {};

    const current = db.attendance[empId][day] || 'present';
    const next = current === 'present' ? 'half' : current === 'half' ? 'leave' : 'present';
    db.attendance[empId][day] = next;

    DB.saveData(db);
    this.render();
  }

  openAddStaffModal() {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('add employees');
      return;
    }

    const modalHtml = `
      <div class="modal-backdrop" id="add-staff-modal" onclick="if(event.target === this) Staff.closeModal()">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-title">${Icons.staff(16)} Add Employee</div>
            <button class="topbar-icon-btn" onclick="Staff.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Staff.saveStaff();">
              <div class="form-group">
                <label class="form-label">Employee Full Name *</label>
                <input type="text" id="staff-name-input" class="form-input" required placeholder="e.g. Suresh Kumar" />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Store Role *</label>
                  <select id="staff-role-input" class="form-select">
                    <option value="Store Helper">Store Helper</option>
                    <option value="Billing Cashier">Billing Cashier</option>
                    <option value="Delivery Boy">Delivery Boy</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Salary (₹) *</label>
                  <input type="number" id="staff-salary-input" class="form-input" required min="0" placeholder="15000" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" id="staff-phone-input" class="form-input" required placeholder="10-digit mobile number" />
              </div>

              <div class="modal-footer" style="padding: 14px 0 0; background: none;">
                <button type="button" class="btn btn-secondary" onclick="Staff.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  ${Icons.check(14)} Save Employee
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

  saveStaff() {
    const name = document.getElementById('staff-name-input').value.trim();
    const role = document.getElementById('staff-role-input').value;
    const salary = parseFloat(document.getElementById('staff-salary-input').value) || 0;
    const phone = document.getElementById('staff-phone-input').value.trim();

    if (!name || !phone) {
      App.toast('danger', 'Validation', 'Employee name and phone are required');
      return;
    }

    const newEmp = {
      id: DB.uid('S'),
      name,
      role,
      salary,
      phone,
      joinDate: DB.getLocalDateStr(),
      status: "Active"
    };

    DB.updateItem('staff', newEmp);
    this.closeModal();
    App.toast('success', 'Staff Added', `${name} (${role})`);
    this.render();
  }

  deleteStaff(id) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('remove employees');
      return;
    }

    const db = DB.getData();
    const emp = (db.staff || []).find(s => s.id === id);
    if (!emp) return;

    if (confirm(`Remove "${emp.name}" from employee directory?`)) {
      DB.deleteItem('staff', id);
      App.toast('info', 'Deleted', `${emp.name} removed`);
      this.render();
    }
  }

  closeModal() {
    const m = document.getElementById('add-staff-modal');
    if (m) m.remove();
  }

  printAttendanceReport() {
    const db = DB.getData();
    const shop = db.shop || {};
    const staffList = db.staff || [];
    const attendance = db.attendance || {};
    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const todayDateNum = today.getDate();

    let totalPayroll = 0;
    const rows = staffList.map(emp => {
      const empAtt = attendance[emp.id] || {};
      let presentCount = 0, halfCount = 0, leaveCount = 0;
      for (let d = 1; d <= todayDateNum; d++) {
        const s = empAtt[d] || 'present';
        if (s === 'present') presentCount++;
        else if (s === 'half') halfCount++;
        else leaveCount++;
      }
      const estPay = Math.round(((Number(emp.salary) || 0) / daysInMonth) * (presentCount + halfCount * 0.5));
      totalPayroll += estPay;
      return `
        <tr>
          <td style="padding:7px; border:1px solid #D1D5DB; font-weight:700;">${DB.escapeHtml(emp.name)}</td>
          <td style="padding:7px; border:1px solid #D1D5DB;">${DB.escapeHtml(emp.role)}</td>
          <td style="padding:7px; border:1px solid #D1D5DB;">${DB.escapeHtml(emp.phone || '')}</td>
          <td style="padding:7px; border:1px solid #D1D5DB; text-align:center;">${presentCount}</td>
          <td style="padding:7px; border:1px solid #D1D5DB; text-align:center;">${halfCount}</td>
          <td style="padding:7px; border:1px solid #D1D5DB; text-align:center;">${leaveCount}</td>
          <td style="padding:7px; border:1px solid #D1D5DB; text-align:right;">₹${(Number(emp.salary) || 0).toLocaleString('en-IN')}</td>
          <td style="padding:7px; border:1px solid #D1D5DB; text-align:right; font-weight:700;">₹${estPay.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; padding: 14px; max-width: 780px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:14px;">
          <div>
            <h2 style="margin:0; font-size:19px;">${DB.escapeHtml(shop.name || 'MyDukkan24 Mart')} — Staff Muster Roll &amp; Payroll</h2>
            <div style="font-size:12px; color:#4B5563;">Month: ${DB.escapeHtml(currentMonth)} (Up to Day ${todayDateNum}) • Printed: ${DB.getLocalDateStr()}</div>
          </div>
          <div style="text-align:right; font-size:12px;">
            <div><strong>Total Team:</strong> ${staffList.length}</div>
            <div><strong>Est. Earned Payroll:</strong> ₹${totalPayroll.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:left;">Name</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:left;">Role</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:left;">Phone</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:center;">Present</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:center;">Half</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:center;">Absent</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:right;">Base Salary</th>
              <th style="padding:7px; border:1px solid #D1D5DB; text-align:right;">Est. Earned</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    App.printHtmlDocument(html, 'wide');
  }
}

window.Staff = new StaffEngine();
