#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function main() {
  const arg = process.argv[2];
  const dbPath = arg || path.join(process.env.APPDATA || process.env.HOME || '.', 'Good Life Clinic - Inventory Management', 'appdata.db');
  console.log('Running migrations against DB:', dbPath);

  const migrationsPath = path.join(__dirname, '..', 'backend', 'migrations');
  let runMigrations;
  try {
    ({ runMigrations } = require(migrationsPath));
  } catch (e) {
    console.error('Failed to require migrations module:', e);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
      console.error('Failed to open DB:', err);
      process.exit(1);
    }
    try {
      await runMigrations(db);
      db.close();
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (e) {
      console.error('Migration run failed:', e);
      try { db.close(); } catch (ee) {}
      process.exit(2);
    }
  });
}

main();
