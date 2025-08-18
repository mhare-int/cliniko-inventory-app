const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
const db = new sqlite3.Database(dbPath, (err) => { if (err) { console.error('Open DB error', err.message); process.exit(1); } });

const supplierId = 10; // Australian Clinical Labs as example
const newAccount = process.argv[2] || 'TEST-ACC-123';

db.serialize(() => {
  db.run('UPDATE suppliers SET account_number = ? WHERE id = ?', [newAccount, supplierId], function(err) {
    if (err) { console.error('Update error:', err); db.close(); return; }
    console.log('Updated rows:', this.changes);
    db.get('SELECT id, name, account_number FROM suppliers WHERE id = ?', [supplierId], (err, row) => {
      if (err) console.error('Select error:', err);
      else console.log('Row after update:', row);
      db.close();
    });
  });
});
