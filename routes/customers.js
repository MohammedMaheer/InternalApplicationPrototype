const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all customers
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM customers ORDER BY id DESC").all();
  res.json(rows);
});

// GET single customer (includes measurement history)
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Customer not found" });
  row.measurements = db.prepare(
    "SELECT * FROM measurements WHERE customer_id = ? ORDER BY created_at DESC, id DESC"
  ).all(req.params.id);
  res.json(row);
});

// POST create customer
router.post("/", (req, res) => {
  const { name, contact, email, preferences } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const info = db.prepare(
    "INSERT INTO customers (name, contact, email, preferences) VALUES (?, ?, ?, ?)"
  ).run(name, contact || null, email || null, preferences || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT update customer
router.put("/:id", (req, res) => {
  const { name, contact, email, preferences } = req.body;
  const info = db.prepare(
    "UPDATE customers SET name = ?, contact = ?, email = ?, preferences = ? WHERE id = ?"
  ).run(name, contact || null, email || null, preferences || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Customer not found" });
  res.json({ updated: true });
});

// DELETE customer (admin/manager only)
router.delete("/:id", (req, res) => {
  if (!req.requireRole("admin", "manager")) return;
  try {
    const info = db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Customer not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
