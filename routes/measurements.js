const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all measurements (optional ?customer_id filter)
router.get("/", (req, res) => {
  if (req.query.customer_id) {
    const rows = db.prepare(
      `SELECT m.*, c.name AS customer_name FROM measurements m
       LEFT JOIN customers c ON m.customer_id = c.id
       WHERE m.customer_id = ? ORDER BY m.created_at DESC`
    ).all(req.query.customer_id);
    return res.json(rows);
  }
  const rows = db.prepare(
    `SELECT m.*, c.name AS customer_name FROM measurements m
     LEFT JOIN customers c ON m.customer_id = c.id
     ORDER BY m.id DESC`
  ).all();
  res.json(rows);
});

// GET single measurement
router.get("/:id", (req, res) => {
  const row = db.prepare(
    `SELECT m.*, c.name AS customer_name FROM measurements m
     LEFT JOIN customers c ON m.customer_id = c.id
     WHERE m.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Measurement not found" });
  res.json(row);
});

// POST create measurement
router.post("/", (req, res) => {
  const { customer_id, type, chest, waist, hips, shoulder_width, sleeve_length, inseam, length, neck, notes } = req.body;
  if (!customer_id) return res.status(400).json({ error: "customer_id is required" });
  const info = db.prepare(
    `INSERT INTO measurements (customer_id, type, chest, waist, hips, shoulder_width, sleeve_length, inseam, length, neck, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customer_id, type || "shirt", chest || null, waist || null, hips || null,
    shoulder_width || null, sleeve_length || null, inseam || null, length || null, neck || null, notes || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT update measurement
router.put("/:id", (req, res) => {
  const { customer_id, type, chest, waist, hips, shoulder_width, sleeve_length, inseam, length, neck, notes } = req.body;
  const info = db.prepare(
    `UPDATE measurements SET customer_id = ?, type = ?, chest = ?, waist = ?, hips = ?,
     shoulder_width = ?, sleeve_length = ?, inseam = ?, length = ?, neck = ?, notes = ? WHERE id = ?`
  ).run(customer_id, type || "shirt", chest || null, waist || null, hips || null,
    shoulder_width || null, sleeve_length || null, inseam || null, length || null, neck || null, notes || null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Measurement not found" });
  res.json({ updated: true });
});

// DELETE measurement
router.delete("/:id", (req, res) => {
  try {
    const info = db.prepare("DELETE FROM measurements WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Measurement not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
