const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dbPath = path.join(__dirname, 'safebox.db');
const db = new DatabaseSync(dbPath);
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student'
    );  
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Pending',
      remarks TEXT,
      rating INTEGER,
      file_paths TEXT,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);
  // Create default admin user with hashed password
  const bcrypt = require('bcrypt');
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role) 
    VALUES ('admin', ?, 'admin')
  `);
  stmt.run(adminPassword);

  console.log('Database initialized with default admin user');
  console.log('Admin credentials: admin/admin123');
}
initDb();

module.exports = db;
