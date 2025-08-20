#!/usr/bin/env node

/*
 Minimal database validator used by release.sh when packaging.
 Usage: node validate-database.js [path/to/appdata.db]
 Exits with 0 on success, non-zero on failure.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dbPath = args[0] || path.join(__dirname, 'backend', 'appdata.db');

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  fail(`Database not found at ${dbPath}`);
}

const requiredTables = [
  'settings',
  'purchase_requests',
  'purchase_request_items',
  'products'
];

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) fail(`Failed to open DB: ${err.message}`);
});

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      fail(`Failed to query schema: ${err.message}`);
    }
    const present = new Set(rows.map(r => r.name));
    const missing = requiredTables.filter(t => !present.has(t));
    if (missing.length > 0) {
      console.error('⚠️  Missing expected tables:', missing);
      process.exitCode = 2;
    } else {
      console.log('✅ Required tables present');
      process.exitCode = 0;
    }
    db.close(() => process.exit(process.exitCode || 0));
  });
});
