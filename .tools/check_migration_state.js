const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const migrations = require('../backend/migrations.js');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Inspecting DB at', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(2);
  }

  // Get current recorded version
  db.get("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1", (err, row) => {
    if (err) {
      console.log('schema_version table not present or error:', err.message || err);
    } else {
      console.log('Recorded schema_version:', row ? row.version : '(none)');
    }

    // PRAGMA table_info for products
    db.all("PRAGMA table_info(products)", (err2, cols) => {
      if (err2) {
        console.error('Failed to get products schema:', err2.message || err2);
      } else {
        const names = (cols || []).map(c => c.name);
        console.log('products columns:', names.join(', '));
        console.log('Has supplier_id column?', names.includes('supplier_id'));
      }

      // Count how many products have non-null supplier_id
      db.get("SELECT COUNT(1) as c FROM products WHERE supplier_id IS NOT NULL AND TRIM(COALESCE(supplier_id,'')) != ''", (err3, cnt) => {
        if (!err3) console.log('Products with supplier_id set:', cnt ? cnt.c : 0);

        // Check sample mapping: show first 10 products with supplier_name and supplier_id
        db.all("SELECT id, cliniko_id, name, supplier_name, supplier_id FROM products LIMIT 10", (err4, rows) => {
          if (!err4) {
            console.log('Sample products (up to 10):');
            console.table(rows);
          }

          // Also show suppliers count
          db.get('SELECT COUNT(1) as c FROM suppliers', (err5, sCnt) => {
            if (!err5) console.log('Suppliers total:', sCnt ? sCnt.c : 0);
            console.log('App CURRENT_DB_VERSION in code:', migrations.CURRENT_DB_VERSION);
            db.close();
          });
        });
      });
    });
  });
});
