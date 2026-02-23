const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "data", "app.db");
const fs = require("fs");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    role TEXT DEFAULT 'tailor',
    hire_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    preferences TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'shirt',
    chest REAL,
    waist REAL,
    hips REAL,
    shoulder_width REAL,
    sleeve_length REAL,
    inseam REAL,
    length REAL,
    neck REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    measurement_id INTEGER,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    assigned_to INTEGER,
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
  );
`);

// Seed a default admin if the employees table is empty
const count = db.prepare("SELECT COUNT(*) AS c FROM employees").get();
if (count.c === 0) {
  db.prepare("INSERT INTO employees (name, contact, role, hire_date) VALUES (?, ?, ?, ?)").run(
    "Admin", "", "admin", new Date().toISOString().slice(0, 10)
  );
}

module.exports = db;
