const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve("C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('OPEN ERR', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.all("PRAGMA table_info(purchase_requests)", (e, cols) => {
    if (e) { console.error('PRAGMA ERR', e); db.close(); process.exit(1); }
    console.log('SCHEMA:', cols.map(c => c.name).join(','));

    db.all("SELECT pr_id, emails_sent FROM purchase_requests LIMIT 5", (err, rows) => {
      if (err) console.error('SELECT ERR', err);
      else console.log('ROWS:', JSON.stringify(rows));
      db.close();
    });
  });
});
