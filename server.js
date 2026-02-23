const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files with no-cache to prevent stale frontend code
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }
  })
);

// Simple role middleware (prototype only – defaults to admin)
app.use((req, res, next) => {
  req.role = req.headers["x-role"] || "admin";
  next();
});

// Role-based access control helper – attached to req for routes
app.use((req, res, next) => {
  req.requireRole = (...roles) => {
    if (!roles.includes(req.role)) {
      res.status(403).json({ error: `Access denied. Requires role: ${roles.join(" or ")}` });
      return false;
    }
    return true;
  };
  next();
});

// API routes
app.use("/api/employees", require("./routes/employees"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/measurements", require("./routes/measurements"));
app.use("/api/orders", require("./routes/orders"));

// SPA fallback – serve index.html for any non-API GET
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running → http://localhost:${PORT}`));
