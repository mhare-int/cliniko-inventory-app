#!/usr/bin/env node
/**
 * Run migrations against a specified SQLite DB file.
 * Usage: node run_migrations_copy.js --db "C:\path\to\appdata.db"
 * Requirements: Node.js installed on target machine. Copy this file and the repo's backend/migrations.js next to it.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--db' || a === '-d') && args[i+1]) { out.db = args[++i]; }
    else if ((a === '--help' || a === '-h')) { out.help = true; }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (args.help || !args.db) {
    console.log('Usage: node run_migrations_copy.js --db "C:\\path\\to\\appdata.db"');
    process.exit(args.help ? 0 : 1);
  }

  const dbPath = path.resolve(args.db);
  if (!fs.existsSync(dbPath)) {
    console.error('DB file not found at:', dbPath);
    process.exit(2);
  }

  // Expect migrations.js to be in the same folder as this script or next to it
  const migrationsModulePath = path.join(__dirname, '..', 'backend', 'migrations.js');
  let migrationsRequirePath = migrationsModulePath;
  if (!fs.existsSync(migrationsRequirePath)) {
    // try local folder
    migrationsRequirePath = path.join(process.cwd(), 'migrations.js');
    if (!fs.existsSync(migrationsRequirePath)) {
      console.error('Could not find migrations.js. Please copy backend/migrations.js next to this script or run from repo root.');
      process.exit(3);
    }
  }

  const migrations = require(migrationsRequirePath);
  const { runMigrations, getCurrentVersion, backupDatabase, CURRENT_DB_VERSION } = migrations;

  console.log('Opening DB at', dbPath);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
    if (err) {
      console.error('Failed to open DB:', err);
      process.exit(4);
    }

    try {
      const current = await getCurrentVersion(db);
      console.log('Current DB version:', current, 'Expected:', CURRENT_DB_VERSION);
      if (typeof current === 'number' && current < CURRENT_DB_VERSION) {
        console.log('Backing up DB...');
        try { await backupDatabase(dbPath); } catch (e) { console.warn('Backup failed:', e); }
        console.log('Running migrations...');
        await runMigrations(db);
        console.log('Migrations completed');
      } else {
        console.log('No migrations needed');
      }
    } catch (e) {
      console.error('Migration runner error:', e);
      process.exit(5);
    } finally {
      db.close(() => process.exit(0));
    }
  });
}

main();
