const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all employees (exclude password_hash)
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id, name, contact, role, hire_date, username FROM employees ORDER BY id DESC").all();
  res.json(rows);
});

// GET single employee (exclude password_hash)
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT id, name, contact, role, hire_date, username FROM employees WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Employee not found" });
  res.json(row);
});

// POST create employee (admin/manager only)
router.post("/", (req, res) => {
  if (!req.requireRole("admin", "manager")) return;
  const { name, contact, role, hire_date, username, password } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  let passwordHash = null;
  if (username && password) {
    // Check username uniqueness
    const existing = db.prepare("SELECT id FROM employees WHERE username = ?").get(username.toLowerCase());
    if (existing) return res.status(400).json({ error: "Username already taken" });
    passwordHash = db.hashPassword(password);
  }

  const info = db.prepare(
    "INSERT INTO employees (name, contact, role, hire_date, username, password_hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, contact || null, role || "tailor", hire_date || null, username ? username.toLowerCase() : null, passwordHash);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT update employee (admin/manager only)
router.put("/:id", (req, res) => {
  if (!req.requireRole("admin", "manager")) return;
  const { name, contact, role, hire_date, username, password } = req.body;

  // If username changed, check uniqueness
  if (username) {
    const existing = db.prepare("SELECT id FROM employees WHERE username = ? AND id != ?").get(username.toLowerCase(), req.params.id);
    if (existing) return res.status(400).json({ error: "Username already taken" });
  }

  const info = db.prepare(
    "UPDATE employees SET name = ?, contact = ?, role = ?, hire_date = ?, username = ? WHERE id = ?"
  ).run(name, contact || null, role || "tailor", hire_date || null, username ? username.toLowerCase() : null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Employee not found" });

  // Optionally update password
  if (password) {
    db.prepare("UPDATE employees SET password_hash = ? WHERE id = ?").run(db.hashPassword(password), req.params.id);
  }

  res.json({ updated: true });
});

// DELETE employee (admin only)
router.delete("/:id", (req, res) => {
  if (!req.requireRole("admin")) return;
  try {
    const info = db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Employee not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
