const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const repoRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(repoRoot, 'backend', 'appdata.db'),
  path.join(repoRoot, 'dist', 'win-unpacked', 'backend', 'appdata.db'),
  path.join(repoRoot, 'backend', 'appdata.db.backup-before-clean-2025-08-15T10-59-46-205Z')
];

function inspect(dbPath) {
  return new Promise((resolve) => {
    const out = { path: dbPath, exists: fs.existsSync(dbPath), columns: null, error: null };
    if (!out.exists) return resolve(out);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        out.error = 'Failed to open DB: ' + err.message;
        return resolve(out);
      }
      db.all("PRAGMA table_info(purchase_requests)", (err2, rows) => {
        if (err2) {
          out.error = 'PRAGMA query failed: ' + err2.message;
          db.close(() => resolve(out));
          return;
        }
        out.columns = rows.map(r => ({ cid: r.cid, name: r.name, type: r.type, notnull: r.notnull, dflt_value: r.dflt_value }));
        db.close(() => resolve(out));
      });
    });
  });
}

(async function main(){
  for (const p of candidates) {
    const info = await inspect(p);
    console.log('DB Path:', info.path);
    console.log('  Exists:', info.exists);
    if (info.error) console.log('  Error:', info.error);
    if (info.columns) {
      console.log('  Columns:');
      info.columns.forEach(c => console.log('   -', c.name, c.type, 'default=', c.dflt_value));
      const has = info.columns.some(c => c.name === 'emails_sent');
      console.log('  => emails_sent present?', has);
    }
    console.log('-------------------------------------');
  }
})();
