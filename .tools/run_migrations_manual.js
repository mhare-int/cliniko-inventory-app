const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { backupDatabase, runMigrations, CURRENT_DB_VERSION, getCurrentVersion } = require('../backend/migrations');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('Running migrations against', dbPath, ' (expected version:', CURRENT_DB_VERSION, ')');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(2);
  }

  try {
    const diskVersion = await getCurrentVersion(db);
    console.log('Current on-disk schema_version:', diskVersion);
    if (typeof diskVersion === 'number' && diskVersion < CURRENT_DB_VERSION) {
      console.log('Backing up DB...');
      const backupPath = await backupDatabase(dbPath);
      console.log('Backup created at', backupPath);
      console.log('Applying migrations...');
      await runMigrations(db);
      console.log('Migrations complete');
    } else if (diskVersion > CURRENT_DB_VERSION) {
      console.warn('On-disk DB is newer than code expects. Aborting to avoid downgrade.');
    } else {
      console.log('No migrations required.');
    }
  } catch (e) {
    console.error('Migration run failed:', e);
    process.exit(1);
  } finally {
    db.close();
  }
});
