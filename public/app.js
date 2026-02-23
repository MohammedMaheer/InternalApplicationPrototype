/* ── Role state ─────────────────────────────────────────── */
let currentRole = "admin";

document.getElementById("roleSel").addEventListener("change", function () {
  currentRole = this.value;
  toast("Switched to role: " + currentRole);
  // Refresh the active view to reflect permission changes
  const activeBtn = document.querySelector(".nav-links button.active");
  if (activeBtn) showView(activeBtn.dataset.view);
});

/* ── API helper ─────────────────────────────────────────── */
async function api(path, method = "GET", body) {
  const opts = { method, headers: { "x-role": currentRole } };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch("/api" + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── Toast ─────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("snack");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ── Modal helpers ─────────────────────────────────────── */
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  const form = document.querySelector("#" + id + " form");
  if (form) form.reset();
  // clear hidden ids
  document.querySelectorAll("#" + id + " input[type=hidden]").forEach(h => h.value = "");
}

/* ── Badge helpers ─────────────────────────────────────── */
function statusTag(s) {
  const cls = {
    "Pending": "tag-pending",
    "In Progress": "tag-inprogress",
    "Completed": "tag-completed",
    "Delivered": "tag-delivered"
  }[s] || "tag-pending";
  return `<span class="tag ${cls}">${s}</span>`;
}

function roleTag(r) {
  const cls = {
    "admin": "tag-admin",
    "manager": "tag-manager",
    "tailor": "tag-tailor"
  }[r] || "";
  return `<span class="tag ${cls}">${r}</span>`;
}

/* ── Navigation ────────────────────────────────────────── */
/* ── Permission helpers ────────────────────────────────── */
function canDelete() {
  return currentRole === "admin" || currentRole === "manager";
}
function canManageStaff() {
  return currentRole === "admin" || currentRole === "manager";
}
function canDeleteStaff() {
  return currentRole === "admin";
}

document.querySelectorAll(".nav-links button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-links button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showView(btn.dataset.view);
  });
});

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const loaders = {
    dashboard: loadDashboard,
    customers: loadCustomers,
    measurements: loadMeasurements,
    orders: loadOrders,
    employees: loadEmployees
  };
  if (loaders[id]) loaders[id]();
}

/* ── Dashboard ─────────────────────────────────────────── */
async function loadDashboard() {
  const [customers, measurements, orders, employees] = await Promise.all([
    api("/customers"), api("/measurements"), api("/orders"), api("/employees")
  ]);

  document.getElementById("kpiRow").innerHTML = `
    <div class="kpi c1"><div class="num">${customers.length}</div><div class="lbl">Customers</div></div>
    <div class="kpi c2"><div class="num">${measurements.length}</div><div class="lbl">Measurements</div></div>
    <div class="kpi c3"><div class="num">${orders.length}</div><div class="lbl">Orders</div></div>
    <div class="kpi c4"><div class="num">${employees.length}</div><div class="lbl">Staff</div></div>
  `;

  // Order status breakdown
  const statusCounts = { "Pending": 0, "In Progress": 0, "Completed": 0, "Delivered": 0 };
  orders.forEach(o => { if (statusCounts.hasOwnProperty(o.status)) statusCounts[o.status]++; });
  const total = orders.length || 1;
  const statusClasses = { "Pending": "pending", "In Progress": "inprogress", "Completed": "completed", "Delivered": "delivered" };

  document.getElementById("statusBreakdown").innerHTML = Object.entries(statusCounts).map(([label, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="status-bar-row">
      <div class="status-bar-label">${label}</div>
      <div class="status-bar-track">
        <div class="status-bar-fill ${statusClasses[label]}" style="width:${orders.length ? pct : 0}%">${pct > 8 ? pct + "%" : ""}</div>
      </div>
      <div class="status-bar-count">${count}</div>
    </div>`;
  }).join("");

  const recent = orders.slice(0, 8);
  document.getElementById("recentOrders").innerHTML = recent.length
    ? recent.map(o => `<tr>
        <td>${o.id}</td>
        <td>${o.customer_name || "—"}</td>
        <td>${o.description || "—"}</td>
        <td>${statusTag(o.status)}</td>
        <td>${o.due_date || "—"}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="empty-msg">No orders yet</td></tr>`;
}

/* ── Customers ─────────────────────────────────────────── */
async function loadCustomers() {
  const rows = await api("/customers");
  document.getElementById("custRows").innerHTML = rows.length
    ? rows.map(c => `<tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${c.contact || "—"}</td>
        <td>${c.email || "—"}</td>
        <td>${c.preferences || "—"}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewMeasurementHistory(${c.id})">View history</button></td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="editCustomer(${c.id})">Edit</button>
          <button class="btn btn-del btn-sm" ${!canDelete() ? "disabled" : ""} onclick="deleteCustomer(${c.id})">Del</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty-msg">No customers added</td></tr>`;
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById("custId").value;
  const body = {
    name: document.getElementById("custName").value,
    contact: document.getElementById("custContact").value,
    email: document.getElementById("custEmail").value,
    preferences: document.getElementById("custPrefs").value
  };
  if (id) await api("/customers/" + id, "PUT", body);
  else await api("/customers", "POST", body);
  closeModal("custDlg");
  toast(id ? "Customer updated" : "Customer added");
  loadCustomers();
}

async function editCustomer(id) {
  const c = await api("/customers/" + id);
  document.getElementById("custId").value = c.id;
  document.getElementById("custName").value = c.name;
  document.getElementById("custContact").value = c.contact || "";
  document.getElementById("custEmail").value = c.email || "";
  document.getElementById("custPrefs").value = c.preferences || "";
  document.getElementById("custDlgTitle").textContent = "Edit customer";
  openModal("custDlg");
}

async function deleteCustomer(id) {
  if (!canDelete()) { toast("Access denied — requires Admin or Manager role"); return; }
  if (!confirm("Delete this customer? Their orders and measurements will also be removed.")) return;
  try {
    await api("/customers/" + id, "DELETE");
    toast("Customer deleted");
    loadCustomers();
  } catch (err) {
    toast(err.message || "Delete failed");
  }
}

/* ── Customer Measurement History ──────────────────────── */
let historyCustomerId = null;

async function viewMeasurementHistory(customerId) {
  historyCustomerId = customerId;
  const customer = await api("/customers/" + customerId);
  document.getElementById("custHistTitle").textContent = "Measurement History — " + customer.name;
  document.getElementById("custHistInfo").innerHTML =
    "<strong>" + customer.name + "</strong>" +
    (customer.contact ? " &middot; " + customer.contact : "") +
    (customer.email ? " &middot; " + customer.email : "") +
    (customer.preferences ? "<br>Preferences: " + customer.preferences : "");

  const measurements = customer.measurements || [];
  document.getElementById("custHistRows").innerHTML = measurements.length
    ? measurements.map(m => `<tr>
        <td>${m.id}</td>
        <td>${m.type}</td>
        <td>${m.chest || "—"}</td>
        <td>${m.waist || "—"}</td>
        <td>${m.hips || "—"}</td>
        <td>${m.shoulder_width || "—"}</td>
        <td>${m.sleeve_length || "—"}</td>
        <td>${m.inseam || "—"}</td>
        <td>${m.length || "—"}</td>
        <td>${m.neck || "—"}</td>
        <td>${m.notes || "—"}</td>
        <td>${m.created_at ? m.created_at.slice(0, 10) : "—"}</td>
      </tr>`).join("")
    : '<tr><td colspan="12" class="empty-msg">No measurements recorded for this customer</td></tr>';

  openModal("custHistDlg");
}

function addMeasForCustomerFromHistory() {
  closeModal("custHistDlg");
  populateMeasCustomers().then(() => {
    if (historyCustomerId) {
      document.getElementById("measCustomer").value = historyCustomerId;
    }
    openModal("measDlg");
  });
}

/* ── Measurements ──────────────────────────────────────── */
async function loadMeasurements() {
  const rows = await api("/measurements");
  document.getElementById("measRows").innerHTML = rows.length
    ? rows.map(m => `<tr>
        <td>${m.id}</td>
        <td>${m.customer_name || m.customer_id}</td>
        <td>${m.type}</td>
        <td>${m.chest || "—"}</td>
        <td>${m.waist || "—"}</td>
        <td>${m.hips || "—"}</td>
        <td>${m.shoulder_width || "—"}</td>
        <td>${m.sleeve_length || "—"}</td>
        <td>${m.length || "—"}</td>
        <td>${m.created_at ? m.created_at.slice(0, 10) : "—"}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="editMeasurement(${m.id})">Edit</button>
          <button class="btn btn-del btn-sm" onclick="deleteMeasurement(${m.id})">Del</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="11" class="empty-msg">No measurements recorded</td></tr>`;
}

async function populateMeasCustomers() {
  const sel = document.getElementById("measCustomer");
  sel.innerHTML = "";
  const custs = await api("/customers");
  custs.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id; o.textContent = c.name;
    sel.appendChild(o);
  });
}

async function saveMeasurement(e) {
  e.preventDefault();
  await populateMeasCustomers(); // make sure list is fresh
  const id = document.getElementById("measId").value;
  const body = {
    customer_id: document.getElementById("measCustomer").value,
    type: document.getElementById("measType").value,
    chest: document.getElementById("measChest").value || null,
    waist: document.getElementById("measWaist").value || null,
    hips: document.getElementById("measHips").value || null,
    shoulder_width: document.getElementById("measShoulder").value || null,
    sleeve_length: document.getElementById("measSleeve").value || null,
    inseam: document.getElementById("measInseam").value || null,
    length: document.getElementById("measLength").value || null,
    neck: document.getElementById("measNeck").value || null,
    notes: document.getElementById("measNotes").value
  };
  if (id) await api("/measurements/" + id, "PUT", body);
  else await api("/measurements", "POST", body);
  closeModal("measDlg");
  toast(id ? "Measurement updated" : "Measurement recorded");
  loadMeasurements();
}

async function editMeasurement(id) {
  await populateMeasCustomers();
  const m = await api("/measurements/" + id);
  document.getElementById("measId").value = m.id;
  document.getElementById("measCustomer").value = m.customer_id;
  document.getElementById("measType").value = m.type;
  document.getElementById("measChest").value = m.chest || "";
  document.getElementById("measWaist").value = m.waist || "";
  document.getElementById("measHips").value = m.hips || "";
  document.getElementById("measShoulder").value = m.shoulder_width || "";
  document.getElementById("measSleeve").value = m.sleeve_length || "";
  document.getElementById("measInseam").value = m.inseam || "";
  document.getElementById("measLength").value = m.length || "";
  document.getElementById("measNeck").value = m.neck || "";
  document.getElementById("measNotes").value = m.notes || "";
  document.getElementById("measDlgTitle").textContent = "Edit measurement";
  openModal("measDlg");
}

async function deleteMeasurement(id) {
  if (!confirm("Delete this measurement?")) return;
  try {
    const res = await api("/measurements/" + id, "DELETE");
    if (res.error) { toast(res.error); return; }
    toast("Measurement deleted");
    loadMeasurements();
  } catch (err) {
    toast(err.message || "Delete failed");
  }
}

/* ── Orders ────────────────────────────────────────────── */
async function loadOrders() {
  const rows = await api("/orders");
  document.getElementById("orderRows").innerHTML = rows.length
    ? rows.map(o => `<tr>
        <td>${o.id}</td>
        <td>${o.customer_name || "—"}</td>
        <td>${o.description || "—"}</td>
        <td>
          <select class="inline-status-sel" data-order-id="${o.id}" onchange="quickStatusChange(this)" style="padding:3px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px;font-family:inherit;cursor:pointer;">
            ${["Pending","In Progress","Completed","Delivered"].map(s =>
              `<option ${o.status === s ? "selected" : ""}>${s}</option>`
            ).join("")}
          </select>
        </td>
        <td>${o.assigned_to_name || "—"}</td>
        <td>${o.due_date || "—"}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="editOrder(${o.id})">Edit</button>
          <button class="btn btn-del btn-sm" ${!canDelete() ? "disabled" : ""} onclick="deleteOrder(${o.id})">Del</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty-msg">No orders yet</td></tr>`;
}

async function quickStatusChange(sel) {
  const orderId = sel.dataset.orderId;
  const newStatus = sel.value;
  try {
    await api("/orders/" + orderId + "/status", "PATCH", { status: newStatus });
    toast("Status → " + newStatus);
  } catch (err) {
    toast(err.message);
    loadOrders();
  }
}

async function populateOrderDropdowns() {
  const custs = await api("/customers");
  const emps = await api("/employees");
  const measurements = await api("/measurements");

  const cs = document.getElementById("orderCustomer");
  cs.innerHTML = "";
  custs.forEach(c => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; cs.appendChild(o); });

  const ms = document.getElementById("orderMeasurement");
  ms.innerHTML = '<option value="">— pick —</option>';
  measurements.forEach(m => { const o = document.createElement("option"); o.value = m.id; o.textContent = `#${m.id} ${m.type} (${m.customer_name || m.customer_id})`; ms.appendChild(o); });

  const es = document.getElementById("orderAssigned");
  es.innerHTML = '<option value="">— unassigned —</option>';
  emps.forEach(e => { const o = document.createElement("option"); o.value = e.id; o.textContent = e.name; es.appendChild(o); });
}

async function saveOrder(e) {
  e.preventDefault();
  const id = document.getElementById("orderId").value;
  const body = {
    customer_id: document.getElementById("orderCustomer").value,
    measurement_id: document.getElementById("orderMeasurement").value || null,
    description: document.getElementById("orderDesc").value,
    status: document.getElementById("orderStatus").value,
    assigned_to: document.getElementById("orderAssigned").value || null,
    due_date: document.getElementById("orderDue").value || null
  };
  if (id) await api("/orders/" + id, "PUT", body);
  else await api("/orders", "POST", body);
  closeModal("orderDlg");
  toast(id ? "Order updated" : "Order created");
  loadOrders();
}

async function editOrder(id) {
  await populateOrderDropdowns();
  const o = await api("/orders/" + id);
  document.getElementById("orderId").value = o.id;
  document.getElementById("orderCustomer").value = o.customer_id;
  document.getElementById("orderMeasurement").value = o.measurement_id || "";
  document.getElementById("orderDesc").value = o.description || "";
  document.getElementById("orderStatus").value = o.status;
  document.getElementById("orderAssigned").value = o.assigned_to || "";
  document.getElementById("orderDue").value = o.due_date || "";
  document.getElementById("orderDlgTitle").textContent = "Edit order";
  openModal("orderDlg");
}

async function deleteOrder(id) {
  if (!canDelete()) { toast("Access denied — requires Admin or Manager role"); return; }
  if (!confirm("Delete this order?")) return;
  try {
    await api("/orders/" + id, "DELETE");
    toast("Order deleted");
    loadOrders();
  } catch (err) {
    toast(err.message || "Delete failed");
  }
}

/* ── Employees ─────────────────────────────────────────── */
async function loadEmployees() {
  const rows = await api("/employees");
  document.getElementById("empRows").innerHTML = rows.length
    ? rows.map(e => `<tr>
        <td>${e.id}</td>
        <td>${e.name}</td>
        <td>${e.contact || "—"}</td>
        <td>${roleTag(e.role)}</td>
        <td>${e.hire_date || "—"}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" ${!canManageStaff() ? "disabled" : ""} onclick="editEmployee(${e.id})">Edit</button>
          <button class="btn btn-del btn-sm" ${!canDeleteStaff() ? "disabled" : ""} onclick="deleteEmployee(${e.id})">Del</button>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="empty-msg">No staff members</td></tr>`;
}

async function saveEmployee(e) {
  e.preventDefault();
  const id = document.getElementById("empId").value;
  const body = {
    name: document.getElementById("empName").value,
    contact: document.getElementById("empContact").value,
    role: document.getElementById("empRole").value,
    hire_date: document.getElementById("empDate").value || null
  };
  if (id) await api("/employees/" + id, "PUT", body);
  else await api("/employees", "POST", body);
  closeModal("empDlg");
  toast(id ? "Staff updated" : "Staff member added");
  loadEmployees();
}

async function editEmployee(id) {
  if (!canManageStaff()) { toast("Access denied — requires Admin or Manager role"); return; }
  const e = await api("/employees/" + id);
  document.getElementById("empId").value = e.id;
  document.getElementById("empName").value = e.name;
  document.getElementById("empContact").value = e.contact || "";
  document.getElementById("empRole").value = e.role;
  document.getElementById("empDate").value = e.hire_date || "";
  document.getElementById("empDlgTitle").textContent = "Edit staff member";
  openModal("empDlg");
}

async function deleteEmployee(id) {
  if (!canDeleteStaff()) { toast("Access denied — requires Admin role"); return; }
  if (!confirm("Remove this staff member?")) return;
  try {
    await api("/employees/" + id, "DELETE");
    toast("Staff member removed");
    loadEmployees();
  } catch (err) {
    toast(err.message || "Delete failed");
  }
}

/* ── Populate dropdowns on modal open ──────────────────── */
document.getElementById("measDlg").addEventListener("click", function handler(e) {
  if (e.target === this) closeModal("measDlg");
});
document.getElementById("custDlg").addEventListener("click", function(e) {
  if (e.target === this) closeModal("custDlg");
});
document.getElementById("orderDlg").addEventListener("click", function(e) {
  if (e.target === this) closeModal("orderDlg");
});
document.getElementById("empDlg").addEventListener("click", function(e) {
  if (e.target === this) closeModal("empDlg");
});
document.getElementById("custHistDlg").addEventListener("click", function(e) {
  if (e.target === this) closeModal("custHistDlg");
});

// Populate selects when opening measurement & order modals
const origOpenModal = openModal;
openModal = function(id) {
  if (id === "measDlg") populateMeasCustomers();
  if (id === "orderDlg") populateOrderDropdowns();
  origOpenModal(id);
};

/* ── Boot ──────────────────────────────────────────────── */
loadDashboard();
