const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all employees
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM employees ORDER BY id DESC").all();
  res.json(rows);
});

// GET single employee
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Employee not found" });
  res.json(row);
});

// POST create employee
router.post("/", (req, res) => {
  const { name, contact, role, hire_date } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const info = db.prepare(
    "INSERT INTO employees (name, contact, role, hire_date) VALUES (?, ?, ?, ?)"
  ).run(name, contact || null, role || "tailor", hire_date || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT update employee
router.put("/:id", (req, res) => {
  const { name, contact, role, hire_date } = req.body;
  const info = db.prepare(
    "UPDATE employees SET name = ?, contact = ?, role = ?, hire_date = ? WHERE id = ?"
  ).run(name, contact || null, role || "tailor", hire_date || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Employee not found" });
  res.json({ updated: true });
});

// DELETE employee
router.delete("/:id", (req, res) => {
  try {
    const info = db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Employee not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
