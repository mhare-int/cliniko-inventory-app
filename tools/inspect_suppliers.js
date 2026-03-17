const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
const db = new sqlite3.Database(dbPath);

console.log('PRAGMA table_info(suppliers):');
db.all("PRAGMA table_info('suppliers')", (err, cols) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  cols.forEach(c => console.log(`  ${c.cid}: ${c.name} (${c.type})`));

  console.log('\nRecent suppliers:');
  db.all('SELECT id, name, email, contact_name, account_number, special_instructions, lead_time_days, source, active, created_at, updated_at FROM suppliers ORDER BY id DESC LIMIT 20', (err2, rows) => {
    if (err2) {
      console.error('Error fetching suppliers:', err2);
    } else {
      rows.forEach(r => console.log(JSON.stringify(r)));
    }
    db.close();
  });
});