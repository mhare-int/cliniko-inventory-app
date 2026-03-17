const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'backend', 'appdata.db');
console.log('Inspecting DB at', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

function run() {
  db.serialize(() => {
    db.all('SELECT version, applied_at FROM schema_version ORDER BY version ASC', (err, rows) => {
      if (err) {
        console.error('Error reading schema_version:', err.message);
      } else {
        console.log('\nschema_version rows:');
        if (!rows || rows.length === 0) console.log('  (none)');
        else rows.forEach(r => console.log(`  version=${r.version} applied_at=${r.applied_at}`));
      }
    });

    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
      if (err) {
        console.error('Error listing tables:', err.message);
      } else {
        console.log('\nTables (' + tables.length + '):');
        tables.forEach(t => console.log('  ' + t.name));
      }
    });

    db.all("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name", (err, idxs) => {
      if (!err) {
        console.log('\nIndexes (' + idxs.length + '):');
        idxs.forEach(i => console.log('  ' + i.name));
      }
    });
  });
}

run();

db.close();
