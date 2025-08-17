const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

db.all('SELECT key, value FROM settings ORDER BY key', (err, rows) => {
  if (err) {
    console.error('Error querying settings:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('DB path:', dbPath);
  console.log('Settings rows:');
  if (!rows || rows.length === 0) {
    console.log(' - (no settings)');
  } else {
    rows.forEach(r => {
      console.log(` - ${r.key}: ${r.value}`);
    });
  }
  db.close();
});
