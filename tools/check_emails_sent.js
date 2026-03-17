const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Using DB:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(2);
  }
});

db.serialize(() => {
  db.all('SELECT pr_id, emails_sent FROM purchase_requests ORDER BY pr_id DESC LIMIT 200', [], (err, rows) => {
    if (err) {
      console.error('Query error:', err.message || err);
      process.exit(3);
    }
    console.log(`Found ${rows.length} purchase_requests (showing up to 200):`);
    rows.forEach(r => {
      console.log(`${r.pr_id} -> emails_sent=${r.emails_sent}`);
    });
    // Also show rows where emails_sent = 1
    db.all('SELECT pr_id FROM purchase_requests WHERE emails_sent=1 ORDER BY pr_id DESC LIMIT 200', [], (err2, sentRows) => {
      if (!err2) {
        console.log('\nPRs with emails_sent=1:');
        if (sentRows.length === 0) console.log('(none)');
        sentRows.forEach(r => console.log(' -', r.pr_id));
      }
      db.close(() => process.exit(0));
    });
  });
});
