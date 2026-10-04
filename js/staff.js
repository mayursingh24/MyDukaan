/**
 * MyDukaan Pro — Staff & Attendance Engine
 * Created & Deployed by Mayur Singh
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

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Active Staff</span>
            <div class="kpi-icon-badge" style="background: var(--primary-light); color: var(--primary);">👔</div>
          </div>
          <div class="kpi-val">${staffList.length}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Registered employees</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-title">Monthly Payroll</span>
            <div class="kpi-icon-badge" style="background: var(--danger-light); color: var(--danger);">💵</div>
          </div>
          <div class="kpi-val">₹${staffList.reduce((s, st) => s + st.salary, 0).toLocaleString('en-IN')}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">Salary budget</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📅 Daily Attendance — ${currentMonth}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Click any day to cycle: Present (Green) → Half-day (Yellow) → Leave (Red)</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Staff.openAddStaffModal()">➕ Add Staff Member</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
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

            return `
              <div style="background: var(--bg-input); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                      ${emp.name.charAt(0)}
                    </div>
                    <div>
                      <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${emp.name}</div>
                      <div style="font-size: 11px; color: var(--text-muted);">${emp.role} • 📞 ${emp.phone} • ₹${emp.salary}/mo</div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px; font-size: 12px;">
                    <span class="badge badge-success">✓ ${presentCount} Present</span>
                    <span class="badge badge-warning">½ ${halfCount} Half</span>
                    <span class="badge badge-danger">✕ ${leaveCount} Absent</span>
                  </div>
                </div>

                <!-- 31 Days Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(28px, 1fr)); gap: 4px;">
                  ${Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const isFuture = day > todayDateNum;
                    const status = isFuture ? 'future' : (empAtt[day] || 'present');
                    const color = status === 'present' ? 'var(--success)' : status === 'half' ? 'var(--warning)' : status === 'leave' ? 'var(--danger)' : 'var(--border-subtle)';
                    const bg = status === 'present' ? 'var(--success-light)' : status === 'half' ? 'var(--warning-light)' : status === 'leave' ? 'var(--danger-light)' : 'transparent';

                    return `
                      <button 
                        style="height: 32px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid ${color}; background: ${bg}; color: ${isFuture ? 'var(--text-muted)' : color}; cursor: ${isFuture ? 'default' : 'pointer'};"
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
            <div style="font-weight: 700;">➕ Add Staff Member</div>
            <button class="topbar-icon-btn" onclick="Staff.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <form onsubmit="event.preventDefault(); Staff.saveStaff();">
              <div class="form-group">
                <label class="form-label">Employee Name *</label>
                <input type="text" id="staff-name-input" class="form-input" required placeholder="e.g. Suresh Kumar" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Role</label>
                  <select id="staff-role-input" class="form-select">
                    <option value="Store Helper">Store Helper</option>
                    <option value="Billing Cashier">Billing Cashier</option>
                    <option value="Delivery Boy">Delivery Boy</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Salary (₹)</label>
                  <input type="number" id="staff-salary-input" class="form-input" required placeholder="15000" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" id="staff-phone-input" class="form-input" required placeholder="10-digit mobile" />
              </div>
              <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">Save Staff Member</button>
                <button type="button" class="btn btn-secondary" onclick="Staff.closeModal()">Cancel</button>
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
      App.toast('danger', 'Validation', 'Name and phone required');
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

  closeModal() {
    const m = document.getElementById('add-staff-modal');
    if (m) m.remove();
  }
}

window.Staff = new StaffEngine();
