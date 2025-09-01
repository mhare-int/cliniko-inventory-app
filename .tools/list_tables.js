const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Inspecting DB at', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error('OPEN ERR', err); process.exit(2); }
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (e, rows) => {
    if (e) { console.error(e); process.exit(2); }
    console.log('Tables found:', rows.length);
    rows.forEach(r => console.log(' -', r.name));
    (function next(i){
      if (i >= rows.length) { db.close(); return; }
      const t = rows[i].name;
      db.all('PRAGMA table_info("'+t+'")', (err2, cols) => {
        if (!err2) console.log(`Table ${t}: columns (${cols.length}):`, cols.map(c => c.name).join(', '));
        else console.log('PRAGMA error for', t, err2);
        next(i+1);
      });
    })(0);
  });
});
