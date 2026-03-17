const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');

console.log('Checking DB:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(2);
  }
});

db.get("SELECT name, sql FROM sqlite_master WHERE type='table' AND name='po_change_log'", (err, row) => {
  if (err) {
    console.error('Query error:', err.message);
    db.close();
    process.exit(3);
  }
  if (!row) {
    console.log('po_change_log: MISSING');
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (e, rows) => {
      if (!e) console.log('Tables in DB:', rows.map(r=>r.name).join(', '));
      db.close();
      process.exit(0);
    });
  } else {
    console.log('po_change_log: PRESENT');
    console.log('Schema:');
    console.log(row.sql);
    db.close();
    process.exit(0);
  }
});
