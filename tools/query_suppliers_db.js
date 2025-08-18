const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('DB path:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('\nPRAGMA table_info(suppliers);');
  db.each("PRAGMA table_info(suppliers);", (err, row) => {
    if (err) { console.error('PRAGMA error:', err); return; }
    console.log(row.cid, row.name, row.type, row.notnull, row.dflt_value);
  }, () => {
    console.log('\nFirst 50 suppliers (id | name | account_number):');
    db.all("SELECT id, name, account_number FROM suppliers ORDER BY id LIMIT 50;", (err, rows) => {
      if (err) { console.error('Select error:', err); db.close(); return; }
      rows.forEach(r => console.log(r.id, '|', r.name, '|', r.account_number));
      db.close();
    });
  });
});
