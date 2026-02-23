const express = require("express");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Session middleware
app.use(session({
  name: "sid",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000  // 8 hours
  }
}));

// Serve static files with no-cache to prevent stale frontend code
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }
  })
);

// Auth routes (public — no session check)
app.use("/api/auth", require("./routes/auth"));

// ── Auth gate: all /api/* below here require login ────────
app.use("/api", (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Attach role from session to every request
  req.role = req.session.userRole;
  next();
});

// Role-based access control helper – attached to req for routes
app.use("/api", (req, res, next) => {
  req.requireRole = (...roles) => {
    if (!roles.includes(req.role)) {
      res.status(403).json({ error: `Access denied. Requires role: ${roles.join(" or ")}` });
      return false;
    }
    return true;
  };
  next();
});

// API routes (all protected by session)
app.use("/api/employees", require("./routes/employees"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/measurements", require("./routes/measurements"));
app.use("/api/orders", require("./routes/orders"));

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// SPA fallback – serve index.html for any non-API GET
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running → http://localhost:${PORT}`));
