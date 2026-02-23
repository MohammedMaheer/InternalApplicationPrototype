const express = require("express");
const router = express.Router();
const db = require("../db");

const VALID_STATUSES = ["Pending", "In Progress", "Completed", "Delivered"];

// GET all orders
router.get("/", (req, res) => {
  const rows = db.prepare(
    `SELECT o.*, c.name AS customer_name, e.name AS assigned_to_name
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     LEFT JOIN employees e ON o.assigned_to = e.id
     ORDER BY o.id DESC`
  ).all();
  res.json(rows);
});

// GET single order
router.get("/:id", (req, res) => {
  const row = db.prepare(
    `SELECT o.*, c.name AS customer_name, e.name AS assigned_to_name
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     LEFT JOIN employees e ON o.assigned_to = e.id
     WHERE o.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Order not found" });
  res.json(row);
});

// POST create order
router.post("/", (req, res) => {
  const { customer_id, measurement_id, description, status, assigned_to, due_date } = req.body;
  if (!customer_id) return res.status(400).json({ error: "customer_id is required" });
  const s = status || "Pending";
  if (!VALID_STATUSES.includes(s)) return res.status(400).json({ error: "Invalid status" });
  const info = db.prepare(
    `INSERT INTO orders (customer_id, measurement_id, description, status, assigned_to, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(customer_id, measurement_id || null, description || null, s, assigned_to || null, due_date || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT update order
router.put("/:id", (req, res) => {
  const { customer_id, measurement_id, description, status, assigned_to, due_date } = req.body;
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const info = db.prepare(
    `UPDATE orders SET customer_id = ?, measurement_id = ?, description = ?, status = ?, assigned_to = ?, due_date = ? WHERE id = ?`
  ).run(customer_id, measurement_id || null, description || null, status || "Pending", assigned_to || null, due_date || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ updated: true });
});

// PATCH update order status only
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const info = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Order not found" });
  res.json({ updated: true });
});

// DELETE order (admin/manager only)
router.delete("/:id", (req, res) => {
  if (!req.requireRole("admin", "manager")) return;
  try {
    const info = db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Order not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
