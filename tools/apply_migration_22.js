const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.argv[2] || path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Opening DB:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB OPEN ERROR', err); process.exit(1); }
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS supplier_product_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      product_cliniko_id TEXT,
      min_qty INTEGER DEFAULT 1,
      price_per_unit REAL DEFAULT NULL,
      percent_discount REAL DEFAULT NULL,
      currency TEXT DEFAULT NULL,
      effective_from DATE DEFAULT NULL,
      effective_to DATE DEFAULT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`, (err) => {
      if (err) return finishErr(err);
      db.run(`CREATE INDEX IF NOT EXISTS idx_spd_supplier_product ON supplier_product_discounts(supplier_id, product_cliniko_id)`, (e) => {
        if (e) return finishErr(e);
        db.run(`CREATE INDEX IF NOT EXISTS idx_spd_minqty ON supplier_product_discounts(min_qty)`, (e2) => {
          if (e2) return finishErr(e2);
          // Insert schema_version record for 22 if not present
          db.run(`CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (svErr) => {
            if (svErr) return finishErr(svErr);
            db.get('SELECT version FROM schema_version WHERE version = 22', (selErr, row) => {
              if (selErr) return finishErr(selErr);
              if (row && row.version === 22) {
                console.log('Migration 22 already recorded in schema_version');
                return finish();
              }
              db.run('INSERT INTO schema_version (version) VALUES (?)', [22], (insErr) => {
                if (insErr) return finishErr(insErr);
                console.log('Inserted schema_version 22');
                return finish();
              });
            });
          });
        });
      });
    });
  });
});
function finish() { console.log('Migration 22 applied (or already present)'); db.close(); }
function finishErr(err) { console.error('ERROR applying migration 22:', err); db.close(); process.exit(1); }
