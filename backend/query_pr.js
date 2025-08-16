const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const prId = process.argv[2] || 'PUR00006';
const db = new sqlite3.Database(path.join(__dirname, 'appdata.db'));
console.log('Querying PR:', prId);
db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [prId], (err, rows) => {
  if (err) {
    console.error('DB ERR', err);
    process.exit(1);
  }
  console.log('Rows for', prId, JSON.stringify(rows, null, 2));
  db.close();
});
