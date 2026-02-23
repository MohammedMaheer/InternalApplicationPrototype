/**
 * End-to-end test suite for StitchFlow Internal App
 * Tests: Auth, Customers, Measurements, Orders, Employees, RBAC
 * Requires server running on PORT (default 3000)
 */

const http = require("http");

const BASE = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0, failed = 0;
const failures = [];

/* ── HTTP helper with cookie jar ──────────────────────── */
class Session {
  constructor() { this.cookies = ""; }

  request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE);
      const opts = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {}
      };
      if (this.cookies) opts.headers["Cookie"] = this.cookies;
      if (body) {
        const json = JSON.stringify(body);
        opts.headers["Content-Type"] = "application/json";
        opts.headers["Content-Length"] = Buffer.byteLength(json);
      }
      const req = http.request(opts, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          // Capture set-cookie
          const sc = res.headers["set-cookie"];
          if (sc) {
            this.cookies = sc.map(c => c.split(";")[0]).join("; ");
          }
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        });
      });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  get(p) { return this.request("GET", p); }
  post(p, b) { return this.request("POST", p, b); }
  put(p, b) { return this.request("PUT", p, b); }
  patch(p, b) { return this.request("PATCH", p, b); }
  del(p) { return this.request("DELETE", p); }
}

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ✗ ${label}`); }
}

/* ── Test suites ──────────────────────────────────────── */

async function testAuth() {
  console.log("\n═══ AUTH ═══");
  const s = new Session();

  // 1. Unauthenticated /api/customers → 401
  let r = await s.get("/api/customers");
  assert(r.status === 401, "Unauthenticated API returns 401");

  // 2. Login with bad password → 401
  r = await s.post("/api/auth/login", { username: "admin", password: "wrong" });
  assert(r.status === 401, "Bad password returns 401");

  // 3. Login with missing fields → 400
  r = await s.post("/api/auth/login", { username: "admin" });
  assert(r.status === 400, "Missing password returns 400");

  // 4. Login with non-existent user → 401
  r = await s.post("/api/auth/login", { username: "nobody", password: "x" });
  assert(r.status === 401, "Non-existent user returns 401");

  // 5. Successful admin login
  r = await s.post("/api/auth/login", { username: "admin", password: "admin123" });
  assert(r.status === 200 && r.data.role === "admin", "Admin login succeeds");

  // 6. /me returns session info
  r = await s.get("/api/auth/me");
  assert(r.status === 200 && r.data.name === "Administrator", "/me returns user info");

  // 7. Authenticated API works
  r = await s.get("/api/customers");
  assert(r.status === 200 && Array.isArray(r.data), "Authenticated API works after login");

  // 8. Logout
  r = await s.post("/api/auth/logout");
  assert(r.status === 200 && r.data.loggedOut === true, "Logout succeeds");

  // 9. After logout, API returns 401
  r = await s.get("/api/customers");
  assert(r.status === 401, "API returns 401 after logout");

  // 10. /me after logout → 401
  r = await s.get("/api/auth/me");
  assert(r.status === 401, "/me returns 401 after logout");

  // 11. Manager login
  r = await s.post("/api/auth/login", { username: "manager", password: "manager123" });
  assert(r.status === 200 && r.data.role === "manager", "Manager login succeeds");
  await s.post("/api/auth/logout");

  // 12. Tailor login
  r = await s.post("/api/auth/login", { username: "tailor", password: "tailor123" });
  assert(r.status === 200 && r.data.role === "tailor", "Tailor login succeeds");
  await s.post("/api/auth/logout");
}

async function testCustomers() {
  console.log("\n═══ CUSTOMERS ═══");
  const s = new Session();
  await s.post("/api/auth/login", { username: "admin", password: "admin123" });

  // 1. Create customer
  let r = await s.post("/api/customers", { name: "Alice Smith", contact: "555-0100", email: "alice@test.com", preferences: "Slim fit" });
  assert(r.status === 201 && r.data.id, "Create customer");
  const id1 = r.data.id;

  // 2. Create second customer
  r = await s.post("/api/customers", { name: "Bob Jones", contact: "555-0200", email: "bob@test.com" });
  assert(r.status === 201, "Create second customer");
  const id2 = r.data.id;

  // 3. List customers
  r = await s.get("/api/customers");
  assert(r.status === 200 && r.data.length >= 2, "List customers returns >= 2");

  // 4. Get single customer
  r = await s.get("/api/customers/" + id1);
  assert(r.status === 200 && r.data.name === "Alice Smith", "Get single customer");

  // 5. Single customer includes measurements array
  assert(Array.isArray(r.data.measurements), "Single customer has measurements array");

  // 6. Update customer
  r = await s.put("/api/customers/" + id1, { name: "Alice Updated", contact: "555-9999", email: "alice2@test.com", preferences: "Regular fit" });
  assert(r.status === 200 && r.data.updated, "Update customer");

  // 7. Verify update
  r = await s.get("/api/customers/" + id1);
  assert(r.data.name === "Alice Updated", "Customer name updated correctly");

  // 8. Create without name → 400
  r = await s.post("/api/customers", { contact: "no-name" });
  assert(r.status === 400, "Create customer without name returns 400");

  // 9. Get non-existent → 404
  r = await s.get("/api/customers/99999");
  assert(r.status === 404, "Get non-existent customer returns 404");

  // 10. Delete customer (admin can)
  r = await s.del("/api/customers/" + id2);
  assert(r.status === 200 && r.data.deleted, "Admin can delete customer");

  // 11. Delete non-existent → 404
  r = await s.del("/api/customers/99999");
  assert(r.status === 404, "Delete non-existent returns 404");

  await s.post("/api/auth/logout");
  return id1;
}

async function testMeasurements(custId) {
  console.log("\n═══ MEASUREMENTS ═══");
  const s = new Session();
  await s.post("/api/auth/login", { username: "admin", password: "admin123" });

  // 1. Create measurement
  let r = await s.post("/api/measurements", {
    customer_id: custId, type: "shirt", chest: 40, waist: 34, hips: 38,
    shoulder_width: 18, sleeve_length: 25, inseam: null, length: 30, neck: 15.5, notes: "First fitting"
  });
  assert(r.status === 201 && r.data.id, "Create measurement");
  const mId1 = r.data.id;

  // 2. Create second measurement (pants)
  r = await s.post("/api/measurements", {
    customer_id: custId, type: "pants", waist: 34, hips: 38, inseam: 32, length: 42
  });
  assert(r.status === 201, "Create second measurement (pants)");
  const mId2 = r.data.id;

  // 3. List all measurements
  r = await s.get("/api/measurements");
  assert(r.status === 200 && r.data.length >= 2, "List all measurements");

  // 4. Customer name joined
  assert(r.data[0].customer_name, "Measurement includes customer_name join");

  // 5. Filter by customer_id
  r = await s.get("/api/measurements?customer_id=" + custId);
  assert(r.status === 200 && r.data.length >= 2, "Filter measurements by customer_id");

  // 6. Get single measurement
  r = await s.get("/api/measurements/" + mId1);
  assert(r.status === 200 && r.data.chest === 40, "Get single measurement");

  // 7. Update measurement
  r = await s.put("/api/measurements/" + mId1, {
    customer_id: custId, type: "shirt", chest: 41, waist: 34, hips: 38,
    shoulder_width: 18.5, sleeve_length: 25, length: 30, neck: 15.5, notes: "Adjusted"
  });
  assert(r.status === 200 && r.data.updated, "Update measurement");

  // 8. Verify update
  r = await s.get("/api/measurements/" + mId1);
  assert(r.data.chest === 41 && r.data.notes === "Adjusted", "Measurement updated correctly");

  // 9. Create without customer_id → 400
  r = await s.post("/api/measurements", { type: "shirt" });
  assert(r.status === 400, "Create measurement without customer_id returns 400");

  // 10. Get non-existent → 404
  r = await s.get("/api/measurements/99999");
  assert(r.status === 404, "Get non-existent measurement returns 404");

  // 11. Delete measurement
  r = await s.del("/api/measurements/" + mId2);
  assert(r.status === 200 && r.data.deleted, "Delete measurement");

  // 12. Customer detail includes measurement history
  r = await s.get("/api/customers/" + custId);
  assert(r.data.measurements.length >= 1, "Customer detail includes measurement history");

  // 13. History sorted by created_at DESC
  if (r.data.measurements.length >= 2) {
    assert(r.data.measurements[0].id >= r.data.measurements[1].id, "History sorted descending");
  } else {
    assert(true, "History sorted descending (only 1 record)");
  }

  await s.post("/api/auth/logout");
  return mId1;
}

async function testOrders(custId, measId) {
  console.log("\n═══ ORDERS ═══");
  const s = new Session();
  await s.post("/api/auth/login", { username: "admin", password: "admin123" });

  // Get an employee to assign
  let r = await s.get("/api/employees");
  const empId = r.data[0].id;

  // 1. Create order
  r = await s.post("/api/orders", {
    customer_id: custId, measurement_id: measId, description: "Blue suit",
    status: "Pending", assigned_to: empId, due_date: "2026-04-01"
  });
  assert(r.status === 201 && r.data.id, "Create order");
  const oId1 = r.data.id;

  // 2. Create second order
  r = await s.post("/api/orders", {
    customer_id: custId, description: "White shirt", status: "In Progress"
  });
  assert(r.status === 201, "Create second order");
  const oId2 = r.data.id;

  // 3. Create order with all statuses
  r = await s.post("/api/orders", { customer_id: custId, description: "Pant", status: "Completed" });
  assert(r.status === 201, "Create order with Completed status");
  const oId3 = r.data.id;

  r = await s.post("/api/orders", { customer_id: custId, description: "Jacket", status: "Delivered" });
  assert(r.status === 201, "Create order with Delivered status");
  const oId4 = r.data.id;

  // 4. Invalid status → 400
  r = await s.post("/api/orders", { customer_id: custId, status: "BadStatus" });
  assert(r.status === 400, "Invalid status returns 400");

  // 5. Missing customer_id → 400
  r = await s.post("/api/orders", { description: "No customer" });
  assert(r.status === 400, "Missing customer_id returns 400");

  // 6. List all orders
  r = await s.get("/api/orders");
  assert(r.status === 200 && r.data.length >= 4, "List orders returns >= 4");

  // 7. Orders include customer_name join
  const first = r.data.find(o => o.id === oId1);
  assert(first && first.customer_name, "Order includes customer_name join");

  // 8. Orders include assigned_to_name join
  assert(first && first.assigned_to_name, "Order includes assigned_to_name join");

  // 9. Get single order
  r = await s.get("/api/orders/" + oId1);
  assert(r.status === 200 && r.data.description === "Blue suit", "Get single order");

  // 10. Update order
  r = await s.put("/api/orders/" + oId1, {
    customer_id: custId, measurement_id: measId, description: "Blue suit (altered)",
    status: "In Progress", assigned_to: empId, due_date: "2026-04-15"
  });
  assert(r.status === 200 && r.data.updated, "Update order");

  // 11. PATCH status
  r = await s.patch("/api/orders/" + oId1 + "/status", { status: "Completed" });
  assert(r.status === 200 && r.data.updated, "PATCH status update");

  // 12. Verify PATCH
  r = await s.get("/api/orders/" + oId1);
  assert(r.data.status === "Completed", "Status patched correctly");

  // 13. PATCH invalid status → 400
  r = await s.patch("/api/orders/" + oId1 + "/status", { status: "Invalid" });
  assert(r.status === 400, "PATCH invalid status returns 400");

  // 14. Get non-existent → 404
  r = await s.get("/api/orders/99999");
  assert(r.status === 404, "Get non-existent order returns 404");

  // 15. Delete order
  r = await s.del("/api/orders/" + oId4);
  assert(r.status === 200 && r.data.deleted, "Admin can delete order");

  // 16. Delete non-existent → 404
  r = await s.del("/api/orders/99999");
  assert(r.status === 404, "Delete non-existent order returns 404");

  await s.post("/api/auth/logout");
}

async function testEmployees() {
  console.log("\n═══ EMPLOYEES ═══");
  const s = new Session();
  await s.post("/api/auth/login", { username: "admin", password: "admin123" });

  // 1. List seeded employees
  let r = await s.get("/api/employees");
  assert(r.status === 200 && r.data.length >= 3, "List seed employees (>=3)");

  // 2. Seed employees have no password_hash exposed
  assert(!r.data[0].password_hash, "password_hash not exposed in list");

  // 3. Get single employee
  r = await s.get("/api/employees/1");
  assert(r.status === 200 && r.data.name === "Administrator", "Get single employee");
  assert(!r.data.password_hash, "password_hash not exposed in single get");
  assert(r.data.username === "admin", "Username included in response");

  // 4. Create employee with credentials
  r = await s.post("/api/employees", {
    name: "NewTailor", contact: "555-NEW", role: "tailor",
    hire_date: "2026-01-15", username: "newtailor", password: "pass123"
  });
  assert(r.status === 201 && r.data.id, "Create employee with credentials");
  const newEmpId = r.data.id;

  // 5. New employee can log in
  const s2 = new Session();
  r = await s2.post("/api/auth/login", { username: "newtailor", password: "pass123" });
  assert(r.status === 200 && r.data.role === "tailor", "New employee can log in");
  await s2.post("/api/auth/logout");

  // 6. Create employee without credentials
  r = await s.post("/api/employees", { name: "No Login Staff", role: "tailor" });
  assert(r.status === 201, "Create employee without credentials");
  const noLoginId = r.data.id;

  // 7. Employee without credentials can't log in
  r = await s2.post("/api/auth/login", { username: "nologin", password: "x" });
  assert(r.status === 401, "Employee without username can't log in");

  // 8. Duplicate username → 400
  r = await s.post("/api/employees", { name: "Dup", username: "admin", password: "x" });
  assert(r.status === 400 && r.data.error.includes("already taken"), "Duplicate username returns 400");

  // 9. Create without name → 400
  r = await s.post("/api/employees", { contact: "nn" });
  assert(r.status === 400, "Create employee without name returns 400");

  // 10. Update employee
  r = await s.put("/api/employees/" + newEmpId, {
    name: "Updated Tailor", contact: "555-UPD", role: "tailor",
    hire_date: "2026-01-15", username: "newtailor"
  });
  assert(r.status === 200 && r.data.updated, "Update employee");

  // 11. Verify update
  r = await s.get("/api/employees/" + newEmpId);
  assert(r.data.name === "Updated Tailor", "Employee name updated correctly");

  // 12. Update with password change
  r = await s.put("/api/employees/" + newEmpId, {
    name: "Updated Tailor", contact: "555-UPD", role: "tailor",
    username: "newtailor", password: "newpass456"
  });
  assert(r.status === 200, "Update employee with new password");

  // 13. Employee can log in with new password
  r = await s2.post("/api/auth/login", { username: "newtailor", password: "newpass456" });
  assert(r.status === 200, "Employee logs in with new password");
  await s2.post("/api/auth/logout");

  // 14. Delete employee
  r = await s.del("/api/employees/" + noLoginId);
  assert(r.status === 200 && r.data.deleted, "Admin can delete employee");

  // 15. Get non-existent → 404
  r = await s.get("/api/employees/99999");
  assert(r.status === 404, "Get non-existent employee returns 404");

  // 16. Delete non-existent → 404
  r = await s.del("/api/employees/99999");
  assert(r.status === 404, "Delete non-existent employee returns 404");

  await s.post("/api/auth/logout");
  return newEmpId;
}

async function testRBAC() {
  console.log("\n═══ RBAC ═══");

  // ── Tailor restrictions ──
  const st = new Session();
  await st.post("/api/auth/login", { username: "tailor", password: "tailor123" });

  // 1. Tailor can read customers
  let r = await st.get("/api/customers");
  assert(r.status === 200, "Tailor can read customers");

  // 2. Tailor can create customer
  r = await st.post("/api/customers", { name: "Tailor Customer" });
  assert(r.status === 201, "Tailor can create customer");
  const tcId = r.data.id;

  // 3. Tailor CANNOT delete customer
  r = await st.del("/api/customers/" + tcId);
  assert(r.status === 403, "Tailor cannot delete customer");

  // 4. Tailor can read employees
  r = await st.get("/api/employees");
  assert(r.status === 200, "Tailor can read employees");

  // 5. Tailor CANNOT create employee
  r = await st.post("/api/employees", { name: "Hack" });
  assert(r.status === 403, "Tailor cannot create employee");

  // 6. Tailor CANNOT update employee
  r = await st.put("/api/employees/1", { name: "Hacked" });
  assert(r.status === 403, "Tailor cannot update employee");

  // 7. Tailor CANNOT delete employee
  r = await st.del("/api/employees/1");
  assert(r.status === 403, "Tailor cannot delete employee");

  // 8. Tailor can create order
  r = await st.post("/api/orders", { customer_id: tcId, description: "Tailor order" });
  assert(r.status === 201, "Tailor can create order");
  const toId = r.data.id;

  // 9. Tailor CANNOT delete order
  r = await st.del("/api/orders/" + toId);
  assert(r.status === 403, "Tailor cannot delete order");

  // 10. Tailor can PATCH order status
  r = await st.patch("/api/orders/" + toId + "/status", { status: "In Progress" });
  assert(r.status === 200, "Tailor can patch order status");

  await st.post("/api/auth/logout");

  // ── Manager permissions ──
  const sm = new Session();
  await sm.post("/api/auth/login", { username: "manager", password: "manager123" });

  // 11. Manager can create employee
  r = await sm.post("/api/employees", { name: "Mgr Created", role: "tailor" });
  assert(r.status === 201, "Manager can create employee");
  const mgrEmpId = r.data.id;

  // 12. Manager can update employee
  r = await sm.put("/api/employees/" + mgrEmpId, { name: "Mgr Updated", role: "tailor" });
  assert(r.status === 200, "Manager can update employee");

  // 13. Manager CANNOT delete employee
  r = await sm.del("/api/employees/" + mgrEmpId);
  assert(r.status === 403, "Manager cannot delete employee");

  // 14. Manager can delete customer
  r = await sm.del("/api/customers/" + tcId);
  assert(r.status === 200, "Manager can delete customer");

  // 15. Manager can delete order
  r = await sm.post("/api/customers", { name: "Mgr Cust" });
  const mcId = r.data.id;
  r = await sm.post("/api/orders", { customer_id: mcId, description: "Mgr order" });
  const moId = r.data.id;
  r = await sm.del("/api/orders/" + moId);
  assert(r.status === 200, "Manager can delete order");

  await sm.post("/api/auth/logout");

  // ── Admin cleanup ──
  const sa = new Session();
  await sa.post("/api/auth/login", { username: "admin", password: "admin123" });
  await sa.del("/api/employees/" + mgrEmpId);
  await sa.del("/api/customers/" + mcId);
  await sa.post("/api/auth/logout");
}

async function testPasswordChange() {
  console.log("\n═══ PASSWORD CHANGE ═══");
  const s = new Session();

  // Login as tailor
  await s.post("/api/auth/login", { username: "tailor", password: "tailor123" });

  // 1. Change password
  let r = await s.put("/api/auth/password", { current_password: "tailor123", new_password: "newpass1" });
  assert(r.status === 200 && r.data.updated, "Password change succeeds");

  await s.post("/api/auth/logout");

  // 2. Old password no longer works
  r = await s.post("/api/auth/login", { username: "tailor", password: "tailor123" });
  assert(r.status === 401, "Old password rejected");

  // 3. New password works
  r = await s.post("/api/auth/login", { username: "tailor", password: "newpass1" });
  assert(r.status === 200, "New password works");

  // 4. Wrong current password → 401
  r = await s.put("/api/auth/password", { current_password: "wrong", new_password: "validnew1" });
  assert(r.status === 401, "Wrong current password rejected");

  // 5. Too short new password → 400
  r = await s.put("/api/auth/password", { current_password: "newpass1", new_password: "ab" });
  assert(r.status === 400, "Too-short new password rejected");

  // 6. Missing fields → 400
  r = await s.put("/api/auth/password", { current_password: "newpass1" });
  assert(r.status === 400, "Missing new_password returns 400");

  // Restore original password
  await s.put("/api/auth/password", { current_password: "newpass1", new_password: "tailor123" });
  await s.post("/api/auth/logout");
}

async function testStaticPages() {
  console.log("\n═══ STATIC PAGES ═══");
  const s = new Session();

  // 1. Login page accessible
  let r = await s.get("/login");
  assert(r.status === 200 && typeof r.data === "string" && r.data.includes("StitchFlow"), "Login page loads");

  // 2. Login HTML page accessible
  r = await s.get("/login.html");
  assert(r.status === 200 && typeof r.data === "string" && r.data.includes("Sign in"), "login.html accessible");

  // 3. Index page accessible (SPA fallback)
  r = await s.get("/");
  assert(r.status === 200 && typeof r.data === "string" && r.data.includes("StitchFlow"), "Index page loads");

  // 4. Random path gets SPA fallback
  r = await s.get("/some/random/path");
  assert(r.status === 200 && typeof r.data === "string" && r.data.includes("StitchFlow"), "SPA fallback works");
}

/* ── Runner ───────────────────────────────────────────── */
(async () => {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   StitchFlow E2E Tests                      ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    await testAuth();
    const custId = await testCustomers();
    const measId = await testMeasurements(custId);
    await testOrders(custId, measId);
    await testEmployees();
    await testRBAC();
    await testPasswordChange();
    await testStaticPages();
  } catch (err) {
    console.error("\n⚠ Test suite crashed:", err.message);
    failed++;
    failures.push("CRASH: " + err.message);
  }

  console.log(`\n════════════════════════════════════════════════`);
  console.log(`  Total: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
  if (failures.length) {
    console.log(`\n  FAILURES:`);
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log(`════════════════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
})();
