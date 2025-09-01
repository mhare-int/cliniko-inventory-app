const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/appdata.db');

db.serialize(() => {
  db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
    if (err) { console.error('list tables error', err); process.exit(1); }
    console.log('Tables (' + rows.length + '):\n' + rows.map(r => r.name).join('\n'));
    rows.forEach(r => {
      console.log('\n-- ' + r.name + ' schema:\n' + (r.sql || '<no sql>'));
    });
    db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (e2, row) => {
      if (e2) { console.error('schema_version read error:', e2); process.exit(1); }
      console.log('\nCurrent schema_version:', row ? row.version : 0);
      db.close();
    });
  });
});
