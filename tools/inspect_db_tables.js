const sqlite3 = require('sqlite3').verbose();
const dbPath = process.argv[2] || 'backend/appdata.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('DB OPEN ERROR', err); process.exit(1); }
  db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (e, rows) => {
    if (e) { console.error('SQLITE_MASTER ERROR', e); db.close(); process.exit(1); }
    console.log('TABLES:\n', rows.map(r => r.name).join('\n'));
    db.all('SELECT version, applied_at FROM schema_version ORDER BY version DESC', (e2, r2) => {
      if (e2) console.log('SCHEMA_VERSION QUERY ERROR', e2);
      else console.log('SCHEMA_VERSION:\n', r2 || []);
      db.get("SELECT sql FROM sqlite_master WHERE name='supplier_product_discounts'", (e3, r3) => {
        if (e3) console.log('SPD QUERY ERROR', e3);
        else console.log('SPD_TABLE_SQL:\n', r3 || null);
        db.close();
      });
    });
  });
});
