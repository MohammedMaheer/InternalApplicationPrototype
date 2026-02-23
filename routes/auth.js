const express = require("express");
const router = express.Router();
const db = require("../db");

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.prepare(
    "SELECT id, name, username, password_hash, role FROM employees WHERE username = ?"
  ).get(username.trim().toLowerCase());

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  if (!db.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Store session
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;

  res.json({
    id: user.id,
    name: user.name,
    role: user.role
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("sid");
    res.json({ loggedOut: true });
  });
});

// GET /api/auth/me — check current session
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.userRole
  });
});

// PUT /api/auth/password — change own password
router.put("/password", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Both current and new password are required" });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters" });
  }

  const user = db.prepare("SELECT password_hash FROM employees WHERE id = ?").get(req.session.userId);
  if (!user || !db.verifyPassword(current_password, user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const newHash = db.hashPassword(new_password);
  db.prepare("UPDATE employees SET password_hash = ? WHERE id = ?").run(newHash, req.session.userId);
  res.json({ updated: true });
});

module.exports = router;
