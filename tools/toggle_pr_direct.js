const sqlite3 = require('sqlite3').verbose();
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node toggle_pr_direct.js <PR_ID> <0|1>');
  process.exit(2);
}
const prId = process.argv[2];
const val = process.argv[3] === '1' ? 1 : 0;
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(3);
  }
});

db.serialize(() => {
  db.run('UPDATE purchase_requests SET emails_sent = ? WHERE pr_id = ?', [val, prId], function(err) {
    if (err) {
      console.error('Update error:', err.message || err);
      db.close();
      process.exit(4);
    }
    console.log('Rows changed:', this.changes);
    db.all('SELECT pr_id, emails_sent FROM purchase_requests WHERE pr_id = ?', [prId], (err2, rows) => {
      if (err2) console.error('Select error:', err2.message || err2);
      console.log('Row now:', rows);
      db.close();
    });
  });
});
