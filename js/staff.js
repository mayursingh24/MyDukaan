/**
 * MyDukkan24 — Employees Directory & Attendance Management Engine
 * Staff tracking, 31-day visual attendance calendar, and payroll estimation.
 */

class StaffEngine {
  render() {
    const container = document.getElementById('staff-content-view');
    if (!container) return;

    const db = DB.getData();
    const staffList = db.staff || [];
    const attendance = db.attendance || {};

    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const todayDateNum = today.getDate();

    const totalSalaryBudget = staffList.reduce((s, st) => s + (st.salary || 0), 0);

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
            <div class="card-title">${Icons.calendar(16)} Monthly Attendance — ${currentMonth}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              Click any date button to cycle status: Present (Green) → Half-Day (Amber) → Absent (Red)
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Staff.openAddStaffModal()">
            ${Icons.plus(14)} Add Employee
          </button>
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
            const estPay = Math.round((emp.salary / daysInMonth) * effectiveDays);

            return `
              <div style="background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                      ${emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${emp.name}</div>
                      <div style="font-size: 11.5px; color: var(--text-muted);">
                        ${emp.role} • Phone: ${emp.phone} • ₹${emp.salary.toLocaleString('en-IN')}/month
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <span class="badge badge-success">${presentCount} Present</span>
                    <span class="badge badge-warning">${halfCount} Half</span>
                    <span class="badge badge-danger">${leaveCount} Absent</span>
                    <span class="badge badge-primary" title="Estimated Earned Pay so far">Est: ₹${estPay.toLocaleString('en-IN')}</span>
                    <button class="btn btn-danger btn-sm" onclick="Staff.deleteStaff('${emp.id}')" title="Delete employee">
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
                        ${isFuture ? 'disabled' : `onclick="Staff.cycleAttendance('${emp.id}', ${day})"`}
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
                  <input type="number" id="staff-salary-input" class="form-input" required placeholder="15000" />
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
      id: `S${Date.now().toString().slice(-4)}`,
      name,
      role,
      salary,
      phone,
      joinDate: new Date().toISOString().split('T')[0],
      status: "Active"
    };

    DB.updateItem('staff', newEmp);
    this.closeModal();
    App.toast('success', 'Staff Added', `${name} (${role})`);
    this.render();
  }

  deleteStaff(id) {
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
}

window.Staff = new StaffEngine();
