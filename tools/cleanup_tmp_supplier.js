const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'backend/appdata.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB OPEN ERROR', err); process.exit(1); }
  db.serialize(() => {
    db.get("SELECT id FROM suppliers WHERE name = ?", ['TMP_DISCOUNT_TEST'], (e, row) => {
      if (e) { console.error('SELECT ERROR', e); db.close(); process.exit(1); }
      if (!row) { console.log('No TMP_DISCOUNT_TEST supplier found'); db.close(); return; }
      const id = row.id;
      console.log('Found supplier id', id, '- deleting discounts and supplier');
      db.run('DELETE FROM supplier_product_discounts WHERE supplier_id = ?', [id], function (dErr) {
        if (dErr) console.error('Error deleting discounts', dErr);
        else console.log('Deleted discounts count:', this.changes);
        db.run('DELETE FROM suppliers WHERE id = ?', [id], function (sErr) {
          if (sErr) console.error('Error deleting supplier', sErr);
          else console.log('Deleted supplier count:', this.changes);
          db.close();
        });
      });
    });
  });
});
