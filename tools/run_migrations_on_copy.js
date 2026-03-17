const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { runMigrations, getCurrentVersion, CURRENT_DB_VERSION } = require('../backend/migrations');

const dbPath = process.argv[2] || process.env.DB_PATH;
if (!dbPath) {
  console.error('Usage: node tools/run_migrations_on_copy.js <absolute-db-path>');
  process.exit(2);
}

console.log('Opening DB at', dbPath);
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(3);
  }
  try {
    const cur = await getCurrentVersion(db);
    console.log('Current DB version:', cur, 'Expected:', CURRENT_DB_VERSION);
    if (typeof cur === 'number' && cur < CURRENT_DB_VERSION) {
      console.log(`Running migrations up to ${CURRENT_DB_VERSION}...`);
      await runMigrations(db);
      console.log('Migrations finished');
    } else {
      console.log('No migrations needed');
    }
    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(4);
  }
});
