const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

function listTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

(async () => {
  try {
    const tables = await listTables();
    const results = {};
    for (const t of tables) {
      // get count safely
      const count = await new Promise((res) => {
        db.get(`SELECT COUNT(*) as c FROM \"${t}\"`, (err, row) => {
          if (err) return res({ error: err.message });
          res({ count: row.c });
        });
      });
      results[t] = count;
    }
    console.log('DB path:', dbPath);
    console.log('Table counts:');
    Object.keys(results).forEach(t => {
      const v = results[t];
      if (v && v.error) {
        console.log(` - ${t}: ERROR (${v.error})`);
      } else {
        console.log(` - ${t}: ${v.count}`);
      }
    });
  } catch (e) {
    console.error('Failed to list table counts:', e);
  } finally {
    db.close();
  }
})();
