const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { runMigrations, getCurrentVersion, backupDatabase, CURRENT_DB_VERSION } = require('../backend/migrations');

(async function(){
  const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
  console.log('Opening DB at', dbPath);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
    if (err) {
      console.error('Failed to open DB:', err);
      process.exit(1);
    }
    try {
      const current = await getCurrentVersion(db);
      console.log('Current DB version:', current, 'Expected:', CURRENT_DB_VERSION);
      if (typeof current === 'number' && current < CURRENT_DB_VERSION) {
        console.log('Backing up DB...');
        await backupDatabase(dbPath);
        console.log('Running migrations...');
        await runMigrations(db);
        console.log('Migrations completed');
      } else {
        console.log('No migrations needed');
      }
    } catch (e) {
      console.error('Migration runner error:', e);
    } finally {
      db.close(() => process.exit(0));
    }
  });
})();
