#!/usr/bin/env node

/**
 * Clean Database for Distribution - FIXED VERSION
 * 
 * This script removes all user data from the database while preserving
 * the schema and essential system settings, making it ready for distribution.
 * 
 * WARNING: This will permanently delete all user data!
 * 
 * Usage: node clean-database-for-dist-fixed.js [database-path] [--keep-api-key]
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Check for flags
const keepApiKey = process.argv.includes('--keep-api-key');

// Get database path from command line or use default (filter out flags and script names)
const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const dbPath = args[0] || path.join(__dirname, 'backend', 'appdata.db');

console.log('🧹 Database Cleaning for Distribution (FIXED)');
console.log('================================================');
console.log(`📂 Database Path: ${dbPath}`);
if (keepApiKey) {
  console.log('🔑 Keep API Key: YES (for testing setup flow)');
} else {
  console.log('🔑 Keep API Key: NO (production distribution)');
}

// Check if database file exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found:', dbPath);
  process.exit(1);
}

// Create backup before cleaning
const backupPath = `${dbPath}.backup-before-clean-${new Date().toISOString().replace(/[:.]/g, '-')}`;
console.log(`💾 Creating backup: ${backupPath}`);

try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('✅ Backup created successfully');
} catch (err) {
  console.error('❌ Failed to create backup:', err.message);
  process.exit(1);
}

// Tables to completely clear
const TABLES_TO_CLEAR = [
  'products',
  'product_sales', 
  'purchase_requests',
  'purchase_request_items',
  'invoices',
  'invoice_items',
  'suppliers',
  'users',
  'user_sessions',
  'user_behavior_log',
  'user_preferences',
  'receipt_log',
  'product_change_log',
  'item_receipt_log'
];

// Settings keys to remove (keep only essential system settings)
const SETTINGS_TO_REMOVE = keepApiKey ? [
  // Keep API key when testing setup flow
  'last_sync_timestamp',
  'user_session_id',
  'last_backup_date'
] : [
  'CLINIKO_API_KEY',
  'last_sync_timestamp',
  'user_session_id',
  'last_backup_date'
];

// Database connection with synchronous operations using async/await
async function cleanDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Failed to connect to database:', err.message);
        reject(err);
        return;
      }
      console.log('✅ Connected to database successfully');
      
      // Use serialized mode to ensure operations happen in order
      db.serialize(async () => {
        try {
          console.log('\n🧹 Starting database cleaning...');
          
          // Clear tables synchronously
          console.log('\n🗑️  Clearing user data tables...');
          
          for (const tableName of TABLES_TO_CLEAR) {
            await new Promise((resolveTable, rejectTable) => {
              // First check if table exists
              db.get("SELECT name FROM sqlite_master WHERE type='table' AND name= ?", [tableName], (err, row) => {
                if (err) {
                  console.error(`❌ Error checking table ${tableName}:`, err.message);
                  rejectTable(err);
                  return;
                }
                
                if (!row) {
                  console.log(`ℹ️  Table ${tableName} doesn't exist (skipping)`);
                  resolveTable();
                  return;
                }
                
                // Table exists, clear it
                db.run(`DELETE FROM ${tableName}`, (err) => {
                  if (err) {
                    console.error(`❌ Error clearing table ${tableName}:`, err.message);
                    rejectTable(err);
                  } else {
                    console.log(`✅ Cleared table: ${tableName}`);
                    resolveTable();
                  }
                });
              });
            });
          }
          
          // Clean settings
          console.log('\n🔧 Cleaning sensitive settings...');
          
          const settings = await new Promise((resolveSettings, rejectSettings) => {
            db.all("SELECT key, value FROM settings", (err, rows) => {
              if (err) {
                console.error('❌ Error reading settings:', err.message);
                rejectSettings(err);
              } else {
                resolveSettings(rows || []);
              }
            });
          });
          
          const settingsToRemove = settings.filter(s => 
            SETTINGS_TO_REMOVE.includes(s.key) || 
            (!keepApiKey && s.key.toLowerCase().includes('api_key')) ||
            s.key.toLowerCase().includes('password')
          );
          
          // Never remove GITHUB_TOKEN
          const filtered = settingsToRemove.filter(s => s.key !== 'GITHUB_TOKEN');
          
          if (filtered.length === 0) {
            console.log('ℹ️  No sensitive settings found to remove (GITHUB_TOKEN preserved)');
          } else {
            console.log(`🗑️  Removing ${filtered.length} sensitive settings...`);
            
            for (const setting of filtered) {
              await new Promise((resolveSetting, rejectSetting) => {
                db.run("DELETE FROM settings WHERE key = ?", [setting.key], (err) => {
                  if (err) {
                    console.error(`❌ Error removing setting ${setting.key}:`, err.message);
                    rejectSetting(err);
                  } else {
                    console.log(`✅ Removed setting: ${setting.key}`);
                    resolveSetting();
                  }
                });
              });
            }
          }
          
          // Reset auto-increment counters
          console.log('\n🔄 Resetting auto-increment counters...');
          
          for (const tableName of TABLES_TO_CLEAR) {
            await new Promise((resolveSequence) => {
              db.run("DELETE FROM sqlite_sequence WHERE name = ?", [tableName], (err) => {
                if (err && !err.message.includes('no such table')) {
                  console.error(`❌ Error resetting sequence for ${tableName}:`, err.message);
                } else {
                  console.log(`✅ Reset sequence for: ${tableName}`);
                }
                resolveSequence(); // Always resolve to continue
              });
            });
          }
          
          // Vacuum database
          console.log('\n🗜️  Compacting database...');
          await new Promise((resolveVacuum, rejectVacuum) => {
            db.run('VACUUM', (err) => {
              if (err) {
                console.error('❌ Failed to vacuum database:', err.message);
                rejectVacuum(err);
              } else {
                console.log('✅ Database compacted');
                resolveVacuum();
              }
            });
          });
          
          console.log('\n🎉 Database cleaning completed! (GITHUB_TOKEN preserved)');
          console.log(`💾 Backup saved as: ${backupPath}`);
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err.message);
              reject(err);
            } else {
              resolve();
            }
          });
          
        } catch (error) {
          console.error('\n❌ Database cleaning failed:', error.message);
          console.log('💾 Original database preserved');
          console.log(`🔄 Restore from backup if needed: ${backupPath}`);
          
          db.close();
          reject(error);
        }
      });
    });
  });
}

// Run the cleaning
cleanDatabase()
  .then(() => {
    console.log('\n✅ Database cleaning process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database cleaning process failed:', error.message);
    process.exit(1);
  });
