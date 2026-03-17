const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/appdata.db');
const sql = `SELECT id, pr_id, comment, LENGTH(before_json) as before_len, LENGTH(after_json) as after_len, substr(before_json,1,800) as before_sample, substr(after_json,1,800) as after_sample, timestamp FROM po_change_log WHERE pr_id IN ('PO00009','PUR00009') ORDER BY timestamp DESC LIMIT 10`;
db.all(sql, (err, rows) => {
  if (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
