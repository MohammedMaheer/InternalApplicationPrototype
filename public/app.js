/* ═══════════════════════════════════════════════════════
   StitchFlow – Frontend Application (Premium Dark Theme)
   ═══════════════════════════════════════════════════════ */
let ME = null;
let HIST_CUST = null;

/* ── Auth ── */
async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    if (!r.ok) throw 0;
    ME = await r.json();
    document.getElementById('userAvatar').textContent = (ME.name || '?')[0].toUpperCase();
    document.getElementById('userName').textContent = ME.name;
    document.getElementById('userRole').textContent = ME.role;
    const g = document.getElementById('greetName');
    if (g) g.textContent = ME.name.split(' ')[0];
  } catch {
    location.href = '/login.html';
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
}

/* ── API helper ── */
async function api(url, opts) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (r.status === 401) { location.href = '/login.html'; return; }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || r.statusText);
  }
  if (r.status === 204) return null;
  return r.json();
}

/* ── Toast ── */
function toast(msg) {
  const s = document.getElementById('snack');
  s.textContent = msg;
  s.classList.add('show');
  clearTimeout(s._t);
  s._t = setTimeout(() => s.classList.remove('show'), 2400);
}

/* ── Animate number ── */
function animateValue(el, end) {
  if (!el) return;
  const dur = 600;
  let start = 0, ts = null;
  const step = (t) => {
    if (!ts) ts = t;
    const p = Math.min((t - ts) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(ease * end);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Modal open / close ── */
function openModal(id) {
  const o = document.getElementById(id);
  o.classList.remove('closing');
  o.classList.add('open');
}
function closeModal(id) {
  const o = document.getElementById(id);
  o.classList.add('closing');
  setTimeout(() => { o.classList.remove('open', 'closing'); }, 220);
}

/* ── Tags ── */
function statusTag(s) {
  const cl = { Pending: 'tag-pending', 'In Progress': 'tag-inprogress', Completed: 'tag-completed', Delivered: 'tag-delivered' };
  return `<span class="tag ${cl[s] || 'tag-pending'}">${s}</span>`;
}
function roleTag(r) {
  const cl = { admin: 'tag-admin', manager: 'tag-manager', tailor: 'tag-tailor' };
  return `<span class="tag ${cl[r] || 'tag-tailor'}">${r}</span>`;
}

/* ── Permissions ── */
function canDelete()      { return ME && (ME.role === 'admin' || ME.role === 'manager'); }
function canManageStaff() { return ME && ME.role === 'admin'; }
function canDeleteStaff() { return ME && ME.role === 'admin'; }

/* ══════════════════════════════════
   NAV
   ══════════════════════════════════ */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(name);
  if (target) target.classList.add('active');
  const btn = document.querySelector(`.sidebar-nav button[data-view="${name}"]`);
  if (btn) btn.classList.add('active');
  const loaders = { dashboard: loadDashboard, customers: loadCustomers, measurements: loadMeasurements, orders: loadOrders, employees: loadEmployees };
  if (loaders[name]) loaders[name]();
}

document.querySelectorAll('.sidebar-nav button').forEach(b => {
  b.addEventListener('click', () => showView(b.dataset.view));
});

/* ══════════════════════════════════
   DASHBOARD
   ══════════════════════════════════ */
async function loadDashboard() {
  const [custs, meass, ords, emps] = await Promise.all([
    api('/api/customers'), api('/api/measurements'), api('/api/orders'), api('/api/employees')
  ]);

  const icons = [
    { label: 'Customers',    icon: '👤', cls: 'ic-blue',   count: custs.length },
    { label: 'Measurements', icon: '📐', cls: 'ic-green',  count: meass.length },
    { label: 'Orders',       icon: '📦', cls: 'ic-amber',  count: ords.length },
    { label: 'Staff',        icon: '🧑‍💼', cls: 'ic-purple', count: emps.length }
  ];

  document.getElementById('kpiRow').innerHTML = icons.map(k =>
    `<div class="kpi">
       <div class="kpi-header">
         <span class="label">${k.label}</span>
         <span class="kpi-icon ${k.cls}">${k.icon}</span>
       </div>
       <span class="value" data-target="${k.count}">0</span>
     </div>`
  ).join('');

  document.querySelectorAll('.kpi .value').forEach(el => {
    animateValue(el, parseInt(el.dataset.target));
  });

  /* Status breakdown */
  const counts = { Pending: 0, 'In Progress': 0, Completed: 0, Delivered: 0 };
  ords.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  const total = ords.length || 1;
  const sb = document.getElementById('statusBreakdown');
  sb.innerHTML = Object.entries(counts).map(([s, c]) => {
    const cls = s === 'Pending' ? 'pending' : s === 'In Progress' ? 'inprogress' : s === 'Completed' ? 'completed' : 'delivered';
    const pct = Math.round(c / total * 100);
    return `<div class="status-bar-row">
      <span class="status-bar-label">${s}</span>
      <div class="status-bar-track"><div class="status-bar-fill ${cls}" data-width="${pct}" style="width:0%"></div></div>
      <span class="status-bar-count">${c}</span>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    sb.querySelectorAll('.status-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });

  /* Recent orders */
  const recent = ords.slice(-5).reverse();
  document.getElementById('recentOrders').innerHTML = recent.length
    ? recent.map((o, i) =>
        `<tr style="--i:${i}"><td>${o.id}</td><td>${o.customer_name || '—'}</td><td>${o.description || '—'}</td><td>${statusTag(o.status)}</td><td>${o.due_date || '—'}</td></tr>`
      ).join('')
    : '<tr><td colspan="5" class="empty-msg">No orders yet</td></tr>';
}

/* ══════════════════════════════════
   CUSTOMERS
   ══════════════════════════════════ */
async function loadCustomers() {
  const data = await api('/api/customers');
  const tb = document.getElementById('custRows');
  tb.innerHTML = data.length
    ? data.map((c, i) =>
        `<tr style="--i:${i}">
          <td>${c.id}</td>
          <td style="color:var(--text);font-weight:500">${c.name}</td>
          <td>${c.contact || '—'}</td>
          <td>${c.email || '—'}</td>
          <td>${c.preferences || '—'}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="viewMeasurementHistory(${c.id},'${c.name.replace(/'/g,"\\'")}')">History</button></td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" onclick="editCustomer(${c.id})">Edit</button>
            ${canDelete() ? `<button class="btn btn-del btn-sm" onclick="deleteCustomer(${c.id})">Del</button>` : ''}
          </td>
        </tr>`
      ).join('')
    : '<tr><td colspan="7" class="empty-msg">No customers yet</td></tr>';
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('custId').value;
  const body = {
    name:        document.getElementById('custName').value,
    contact:     document.getElementById('custContact').value,
    email:       document.getElementById('custEmail').value,
    preferences: document.getElementById('custPrefs').value
  };
  try {
    if (id) await api(`/api/customers/${id}`, { method: 'PUT', body });
    else     await api('/api/customers', { method: 'POST', body });
    closeModal('custDlg');
    document.getElementById('custForm').reset();
    document.getElementById('custId').value = '';
    toast(id ? 'Customer updated' : 'Customer created');
    loadCustomers();
  } catch (err) { toast('Error: ' + err.message); }
}

async function editCustomer(id) {
  const c = await api(`/api/customers/${id}`);
  document.getElementById('custId').value = c.id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custContact').value = c.contact || '';
  document.getElementById('custEmail').value = c.email || '';
  document.getElementById('custPrefs').value = c.preferences || '';
  document.getElementById('custDlgTitle').textContent = 'Edit customer';
  openModal('custDlg');
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try { await api(`/api/customers/${id}`, { method: 'DELETE' }); toast('Customer deleted'); loadCustomers(); }
  catch (err) { toast('Error: ' + err.message); }
}

/* ── Customer Measurement History ── */
async function viewMeasurementHistory(custId, custName) {
  HIST_CUST = { id: custId, name: custName };
  document.getElementById('custHistTitle').textContent = 'Measurement History';
  document.getElementById('custHistInfo').innerHTML = `<strong>${custName}</strong> — All recorded measurements`;
  const data = await api(`/api/customers/${custId}/measurements`);
  const tb = document.getElementById('custHistRows');
  tb.innerHTML = data.length
    ? data.map((m, i) =>
        `<tr style="--i:${i}">
          <td>${m.id}</td><td>${m.measurement_type}</td>
          <td>${m.chest||'—'}</td><td>${m.waist||'—'}</td><td>${m.hips||'—'}</td>
          <td>${m.shoulder||'—'}</td><td>${m.sleeve_length||'—'}</td><td>${m.inseam||'—'}</td>
          <td>${m.length||'—'}</td><td>${m.neck||'—'}</td><td>${m.notes||'—'}</td>
          <td>${m.created_at?.split('T')[0]||'—'}</td>
        </tr>`
      ).join('')
    : '<tr><td colspan="12" class="empty-msg">No measurements recorded</td></tr>';
  openModal('custHistDlg');
}

function addMeasForCustomerFromHistory() {
  closeModal('custHistDlg');
  setTimeout(() => {
    document.getElementById('measId').value = '';
    document.getElementById('measForm').reset();
    document.getElementById('measDlgTitle').textContent = 'Record measurement';
    populateMeasCustomers().then(() => {
      document.getElementById('measCustomer').value = HIST_CUST.id;
    });
    openModal('measDlg');
  }, 250);
}

/* ══════════════════════════════════
   MEASUREMENTS
   ══════════════════════════════════ */
async function populateMeasCustomers() {
  const custs = await api('/api/customers');
  const sel = document.getElementById('measCustomer');
  sel.innerHTML = '<option value="">— pick customer —</option>' +
    custs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadMeasurements() {
  const data = await api('/api/measurements');
  const tb = document.getElementById('measRows');
  tb.innerHTML = data.length
    ? data.map((m, i) =>
        `<tr style="--i:${i}">
          <td>${m.id}</td>
          <td style="color:var(--text);font-weight:500">${m.customer_name || '—'}</td>
          <td>${m.measurement_type}</td>
          <td>${m.chest||'—'}</td><td>${m.waist||'—'}</td><td>${m.hips||'—'}</td>
          <td>${m.shoulder||'—'}</td><td>${m.sleeve_length||'—'}</td>
          <td>${m.length||'—'}</td>
          <td>${m.created_at?.split('T')[0]||'—'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" onclick="editMeasurement(${m.id})">Edit</button>
            ${canDelete() ? `<button class="btn btn-del btn-sm" onclick="deleteMeasurement(${m.id})">Del</button>` : ''}
          </td>
        </tr>`
      ).join('')
    : '<tr><td colspan="11" class="empty-msg">No measurements yet</td></tr>';
}

async function saveMeasurement(e) {
  e.preventDefault();
  const id = document.getElementById('measId').value;
  const body = {
    customer_id:      document.getElementById('measCustomer').value,
    measurement_type:  document.getElementById('measType').value,
    chest:            document.getElementById('measChest').value || null,
    waist:            document.getElementById('measWaist').value || null,
    hips:             document.getElementById('measHips').value || null,
    shoulder:         document.getElementById('measShoulder').value || null,
    sleeve_length:    document.getElementById('measSleeve').value || null,
    inseam:           document.getElementById('measInseam').value || null,
    length:           document.getElementById('measLength').value || null,
    neck:             document.getElementById('measNeck').value || null,
    notes:            document.getElementById('measNotes').value
  };
  try {
    if (id) await api(`/api/measurements/${id}`, { method: 'PUT', body });
    else     await api('/api/measurements', { method: 'POST', body });
    closeModal('measDlg');
    document.getElementById('measForm').reset();
    document.getElementById('measId').value = '';
    toast(id ? 'Measurement updated' : 'Measurement saved');
    loadMeasurements();
  } catch (err) { toast('Error: ' + err.message); }
}

async function editMeasurement(id) {
  const m = await api(`/api/measurements/${id}`);
  await populateMeasCustomers();
  document.getElementById('measId').value = m.id;
  document.getElementById('measCustomer').value = m.customer_id;
  document.getElementById('measType').value = m.measurement_type;
  document.getElementById('measChest').value = m.chest || '';
  document.getElementById('measWaist').value = m.waist || '';
  document.getElementById('measHips').value = m.hips || '';
  document.getElementById('measShoulder').value = m.shoulder || '';
  document.getElementById('measSleeve').value = m.sleeve_length || '';
  document.getElementById('measInseam').value = m.inseam || '';
  document.getElementById('measLength').value = m.length || '';
  document.getElementById('measNeck').value = m.neck || '';
  document.getElementById('measNotes').value = m.notes || '';
  document.getElementById('measDlgTitle').textContent = 'Edit measurement';
  openModal('measDlg');
}

async function deleteMeasurement(id) {
  if (!confirm('Delete this measurement?')) return;
  try { await api(`/api/measurements/${id}`, { method: 'DELETE' }); toast('Measurement deleted'); loadMeasurements(); }
  catch (err) { toast('Error: ' + err.message); }
}

/* ══════════════════════════════════
   ORDERS
   ══════════════════════════════════ */
async function populateOrderDropdowns() {
  const [custs, meass, emps] = await Promise.all([
    api('/api/customers'), api('/api/measurements'), api('/api/employees')
  ]);
  document.getElementById('orderCustomer').innerHTML =
    '<option value="">— pick customer —</option>' + custs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('orderMeasurement').innerHTML =
    '<option value="">— pick —</option>' + meass.map(m => `<option value="${m.id}">${m.customer_name} — ${m.measurement_type} #${m.id}</option>`).join('');
  document.getElementById('orderAssigned').innerHTML =
    '<option value="">— unassigned —</option>' + emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

async function loadOrders() {
  const data = await api('/api/orders');
  const tb = document.getElementById('orderRows');
  tb.innerHTML = data.length
    ? data.map((o, i) =>
        `<tr style="--i:${i}">
          <td>${o.id}</td>
          <td style="color:var(--text);font-weight:500">${o.customer_name || '—'}</td>
          <td>${o.description || '—'}</td>
          <td>${canDelete()
            ? `<select class="inline-status-sel" onchange="quickStatusChange(${o.id},this.value)">
                ${['Pending','In Progress','Completed','Delivered'].map(s => `<option${s===o.status?' selected':''}>${s}</option>`).join('')}
               </select>`
            : statusTag(o.status)}</td>
          <td>${o.assigned_name || '—'}</td>
          <td>${o.due_date || '—'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" onclick="editOrder(${o.id})">Edit</button>
            ${canDelete() ? `<button class="btn btn-del btn-sm" onclick="deleteOrder(${o.id})">Del</button>` : ''}
          </td>
        </tr>`
      ).join('')
    : '<tr><td colspan="7" class="empty-msg">No orders yet</td></tr>';
}

async function saveOrder(e) {
  e.preventDefault();
  const id = document.getElementById('orderId').value;
  const body = {
    customer_id:    document.getElementById('orderCustomer').value,
    measurement_id: document.getElementById('orderMeasurement').value || null,
    description:    document.getElementById('orderDesc').value,
    status:         document.getElementById('orderStatus').value,
    assigned_to:    document.getElementById('orderAssigned').value || null,
    due_date:       document.getElementById('orderDue').value || null
  };
  try {
    if (id) await api(`/api/orders/${id}`, { method: 'PUT', body });
    else     await api('/api/orders', { method: 'POST', body });
    closeModal('orderDlg');
    document.getElementById('orderForm').reset();
    document.getElementById('orderId').value = '';
    toast(id ? 'Order updated' : 'Order created');
    loadOrders();
  } catch (err) { toast('Error: ' + err.message); }
}

async function editOrder(id) {
  const o = await api(`/api/orders/${id}`);
  await populateOrderDropdowns();
  document.getElementById('orderId').value = o.id;
  document.getElementById('orderCustomer').value = o.customer_id;
  document.getElementById('orderMeasurement').value = o.measurement_id || '';
  document.getElementById('orderDesc').value = o.description || '';
  document.getElementById('orderStatus').value = o.status;
  document.getElementById('orderAssigned').value = o.assigned_to || '';
  document.getElementById('orderDue').value = o.due_date || '';
  document.getElementById('orderDlgTitle').textContent = 'Edit order';
  openModal('orderDlg');
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  try { await api(`/api/orders/${id}`, { method: 'DELETE' }); toast('Order deleted'); loadOrders(); }
  catch (err) { toast('Error: ' + err.message); }
}

async function quickStatusChange(id, status) {
  try { await api(`/api/orders/${id}`, { method: 'PATCH', body: { status } }); toast('Status → ' + status); }
  catch (err) { toast('Error: ' + err.message); }
}

/* ══════════════════════════════════
   EMPLOYEES
   ══════════════════════════════════ */
async function loadEmployees() {
  const data = await api('/api/employees');
  const tb = document.getElementById('empRows');
  tb.innerHTML = data.length
    ? data.map((e, i) =>
        `<tr style="--i:${i}">
          <td>${e.id}</td>
          <td style="color:var(--text);font-weight:500">${e.name}</td>
          <td>${e.contact || '—'}</td>
          <td>${roleTag(e.role)}</td>
          <td>${e.username || '—'}</td>
          <td>${e.hire_date || '—'}</td>
          <td class="actions">
            ${canManageStaff() ? `<button class="btn btn-ghost btn-sm" onclick="editEmployee(${e.id})">Edit</button>` : ''}
            ${canDeleteStaff() ? `<button class="btn btn-del btn-sm" onclick="deleteEmployee(${e.id})">Del</button>` : ''}
          </td>
        </tr>`
      ).join('')
    : '<tr><td colspan="7" class="empty-msg">No staff members yet</td></tr>';
}

async function saveEmployee(e) {
  e.preventDefault();
  const id = document.getElementById('empId').value;
  const body = {
    name:     document.getElementById('empName').value,
    contact:  document.getElementById('empContact').value,
    role:     document.getElementById('empRole').value,
    hire_date:document.getElementById('empDate').value || null
  };
  const u = document.getElementById('empUsername').value;
  const p = document.getElementById('empPassword').value;
  if (u) body.username = u;
  if (p) body.password = p;
  try {
    if (id) await api(`/api/employees/${id}`, { method: 'PUT', body });
    else     await api('/api/employees', { method: 'POST', body });
    closeModal('empDlg');
    document.getElementById('empForm').reset();
    document.getElementById('empId').value = '';
    toast(id ? 'Staff updated' : 'Staff added');
    loadEmployees();
  } catch (err) { toast('Error: ' + err.message); }
}

async function editEmployee(id) {
  const e = await api(`/api/employees/${id}`);
  document.getElementById('empId').value = e.id;
  document.getElementById('empName').value = e.name;
  document.getElementById('empContact').value = e.contact || '';
  document.getElementById('empRole').value = e.role;
  document.getElementById('empDate').value = e.hire_date || '';
  document.getElementById('empUsername').value = e.username || '';
  document.getElementById('empPassword').value = '';
  document.getElementById('empDlgTitle').textContent = 'Edit staff member';
  openModal('empDlg');
}

async function deleteEmployee(id) {
  if (!confirm('Delete this staff member?')) return;
  try { await api(`/api/employees/${id}`, { method: 'DELETE' }); toast('Staff deleted'); loadEmployees(); }
  catch (err) { toast('Error: ' + err.message); }
}

/* ══════════════════════════════════
   OVERLAY CLICK-TO-CLOSE
   ══════════════════════════════════ */
['custDlg','measDlg','orderDlg','empDlg','custHistDlg'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal(id);
  });
});

/* ── Reset dialog titles on open ── */
const _origOpen = openModal;
openModal = function(id) {
  if (id === 'custDlg') {
    if (!document.getElementById('custId').value) {
      document.getElementById('custDlgTitle').textContent = 'New customer';
      document.getElementById('custForm').reset();
    }
  }
  if (id === 'measDlg') {
    if (!document.getElementById('measId').value) {
      document.getElementById('measDlgTitle').textContent = 'Record measurement';
      document.getElementById('measForm').reset();
      populateMeasCustomers();
    }
  }
  if (id === 'orderDlg') {
    if (!document.getElementById('orderId').value) {
      document.getElementById('orderDlgTitle').textContent = 'New order';
      document.getElementById('orderForm').reset();
      populateOrderDropdowns();
    }
  }
  if (id === 'empDlg') {
    if (!document.getElementById('empId').value) {
      document.getElementById('empDlgTitle').textContent = 'Add staff member';
      document.getElementById('empForm').reset();
    }
  }
  _origOpen(id);
};

/* ══════════════════════════════════
   BOOT
   ══════════════════════════════════ */
checkAuth().then(() => loadDashboard());
