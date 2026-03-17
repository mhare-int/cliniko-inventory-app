const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Inspecting DB:', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error('Failed to open DB:', err.message); process.exit(2); }
});

function run(q) {
  return new Promise((res, rej) => db.all(q, (e, rows) => e ? rej(e) : res(rows)));
}

(async () => {
  try {
    const tables = await run("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tables:');
    tables.forEach(t => console.log('-', t.name));

    // Look for likely tables
    const candidates = tables.map(t => t.name).filter(n => /file|generated|order|supplier/i.test(n));
    console.log('\nCandidate tables (matching file|generated|order|supplier):', candidates);

    for (const name of candidates) {
      console.log('\n--- Contents of table:', name, '---');
      try {
        const rows = await run(`SELECT * FROM ${name} ORDER BY id DESC LIMIT 50`);
        console.log('Row count (showing up to 50):', rows.length);
        if (rows.length > 0) console.log(JSON.stringify(rows.slice(0, 10), null, 2));
      } catch (e) {
        console.warn('Could not read table', name, e.message);
      }
    }

    // Also try a generic search for columns related to "file_path" or "file"
    console.log('\nSearching for columns named like file_path, path, filename, file...');
    for (const t of tables) {
      const sql = t.sql || '';
      if (/file_path|file_path|filename|file\)/i.test(sql)) {
        console.log(`\nTable ${t.name} schema:`, sql);
      }
    }

    db.close();
  } catch (err) {
    console.error('Error during inspection:', err.message);
    db.close();
    process.exit(3);
  }
})();
