/**
 * Database Migration System
 * Handles database schema updates between app versions
 */

const fs = require('fs');
const path = require('path');

// Current database version
const CURRENT_DB_VERSION = 1;

// Migration scripts - add new ones as you update the app
const migrations = [
  {
    version: 1,
    description: "Initial database setup",
    up: (db) => {
      return new Promise((resolve, reject) => {
        // Initial tables already created in db.js
        resolve();
      });
    }
  },
  // Example future migration:
  // {
  //   version: 2,
  //   description: "Add new column to products table",
  //   up: (db) => {
  //     return new Promise((resolve, reject) => {
  //       db.run('ALTER TABLE products ADD COLUMN new_field TEXT DEFAULT NULL', (err) => {
  //         if (err) reject(err);
  //         else resolve();
  //       });
  //     });
  //   }
  // }
];

/**
 * Get current database version
 */
function getCurrentVersion(db) {
  return new Promise((resolve, reject) => {
    // Create version table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return reject(err);
      
      db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.version : 0);
      });
    });
  });
}

/**
 * Run migrations to bring database up to current version
 */
async function runMigrations(db) {
  try {
    const currentVersion = await getCurrentVersion(db);
    console.log(`Current database version: ${currentVersion}`);
    
    // Run all migrations newer than current version
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.description}`);
        
        try {
          await migration.up(db);
          
          // Record that migration was applied
          await new Promise((resolve, reject) => {
            db.run('INSERT INTO schema_version (version) VALUES (?)', [migration.version], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          console.log(`✅ Migration ${migration.version} completed`);
        } catch (err) {
          console.error(`❌ Migration ${migration.version} failed:`, err);
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Backup database before migrations
 */
function backupDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.backup.${timestamp}`;
    
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        console.error('Failed to create database backup:', err);
        reject(err);
      } else {
        console.log(`✅ Database backed up to: ${backupPath}`);
        resolve(backupPath);
      }
    });
  });
}

module.exports = {
  runMigrations,
  getCurrentVersion,
  backupDatabase,
  CURRENT_DB_VERSION
};
