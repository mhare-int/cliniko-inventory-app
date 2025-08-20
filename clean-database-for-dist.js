#!/usr/bin/env node

/**
 * Clean Database for Distribution
 * 
 * This script removes all user data from the database while preserving
 * the schema and essential system settings, making it ready for distribution.
 * 
 * WARNING: This will permanently delete all user data!
 * 
 * Usage: node clean-database-for-dist.js [database-path] [--keep-api-key]
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Check for flags
const keepApiKey = process.argv.includes('--keep-api-key');

// Get database path from command line or use default (filter out flags and script names)
const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const dbPath = args[0] || path.join(__dirname, 'backend', 'appdata.db');

console.log('🧹 Database Cleaning for Distribution');
console.log('====================================');
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

// Additional tables created by the app that should be cleared for a distribution build
const ADDITIONAL_TABLES_TO_CLEAR = [
  'email_templates',
  'vendor_oft_files',
  'po_change_log',
  'po_templates',
  'generated_files',
  'vendor_files'
];

// Merge the lists for processing
const ALL_TABLES_TO_CLEAR = TABLES_TO_CLEAR.concat(ADDITIONAL_TABLES_TO_CLEAR);

// Settings keys to remove (keep only essential system settings)
// NOTE: Do NOT remove GITHUB_TOKEN so the auto-updater keeps working post-clean.
const SETTINGS_TO_REMOVE = keepApiKey ? [
  // Keep API key when testing setup flow
  // 'CLINIKO_API_KEY',  // intentionally preserved for testing
  'last_sync_timestamp',
  'user_session_id',
  'last_backup_date'
] : [
  'CLINIKO_API_KEY',
  // 'GITHUB_TOKEN',  // intentionally preserved
  'last_sync_timestamp',
  'user_session_id',
  'last_backup_date'
];

// Settings to keep (essential system settings)
const SETTINGS_TO_KEEP = keepApiKey ? [
  'database_version',
  'SESSION_TIMEOUT_HOURS',
  'smart_prompts_enabled',
  'GITHUB_TOKEN', // explicitly keep
  'CLINIKO_API_KEY' // keep for testing setup flow
] : [
  'database_version',
  'SESSION_TIMEOUT_HOURS',
  'smart_prompts_enabled',
  'GITHUB_TOKEN' // explicitly keep
];

// Database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database successfully');
  cleanDatabase();
});

function cleanDatabase() {
  console.log('\n🧹 Starting database cleaning...');
  
  // Begin transaction
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      console.error('❌ Failed to start transaction:', err.message);
      process.exit(1);
    }
    
    clearUserDataTables();
  });
}

function clearUserDataTables() {
  console.log('\n🗑️  Clearing user data tables...');
  // Build promises for each table clear operation so we can wait for them all
  const clearPromises = ALL_TABLES_TO_CLEAR.map(tableName => {
    return new Promise(resolve => {
      // Check if table exists
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name= ?", [tableName], (err, row) => {
        if (err) {
          console.error(`❌ Error checking table ${tableName}:`, err.message);
          return resolve({ table: tableName, error: err.message });
        }
        if (!row) {
          console.log(`ℹ️  Table ${tableName} doesn't exist (skipping)`);
          return resolve({ table: tableName, skipped: true });
        }

        // Table exists, delete rows
        db.run(`DELETE FROM ${tableName}`, (delErr) => {
          if (delErr) {
            console.error(`❌ Error clearing table ${tableName}:`, delErr.message);
            return resolve({ table: tableName, error: delErr.message });
          }
          console.log(`✅ Cleared table: ${tableName}`);
          return resolve({ table: tableName, cleared: true });
        });
      });
    });
  });

  Promise.all(clearPromises).then(results => {
    const hadError = results.some(r => r && r.error);
    if (hadError) {
      console.error('❌ One or more table clear operations failed. Rolling back.');
      return rollbackTransaction();
    }
    // Proceed to cleaning settings only after all clear operations finished
    cleanSettings();
  }).catch(e => {
    console.error('❌ Unexpected error while clearing tables:', e);
    rollbackTransaction();
  });
}

function cleanSettings() {
  console.log('\n🔧 Cleaning sensitive settings...');
  
  // Get all current settings
  db.all("SELECT key, value FROM settings", (err, settings) => {
    if (err) {
      console.error('❌ Error reading settings:', err.message);
      rollbackTransaction();
      return;
    }
    
  // Remove any setting not explicitly listed in SETTINGS_TO_KEEP
  const keepSet = new Set(SETTINGS_TO_KEEP);
  const settingsToRemove = settings.filter(s => !keepSet.has(s.key));
  // Never remove GITHUB_TOKEN even if not in keep list
  const filtered = settingsToRemove.filter(s => s.key !== 'GITHUB_TOKEN');
    
    if (filtered.length === 0) {
      console.log('ℹ️  No sensitive settings found to remove (GITHUB_TOKEN preserved)');
      resetAutoIncrementCounters();
      return;
    }
    
    console.log(`🗑️  Removing ${filtered.length} sensitive settings...`);
    
    let settingsRemoved = 0;
    let errorOccurred = false;
    
    filtered.forEach(setting => {
      db.run("DELETE FROM settings WHERE key = ?", [setting.key], (err) => {
        if (err) {
          console.error(`❌ Error removing setting ${setting.key}:`, err.message);
          errorOccurred = true;
        } else {
          console.log(`✅ Removed setting: ${setting.key}`);
        }
        
        settingsRemoved++;
        if (settingsRemoved === filtered.length) {
          if (errorOccurred) {
            rollbackTransaction();
          } else {
            resetAutoIncrementCounters();
          }
        }
      });
    });
  });
}

function resetAutoIncrementCounters() {
  console.log('\n🔄 Resetting auto-increment counters...');
  
  // Reset sqlite_sequence for all cleared tables
  const sequenceResets = ALL_TABLES_TO_CLEAR.map(tableName => 
    new Promise((resolve, reject) => {
      db.run("DELETE FROM sqlite_sequence WHERE name = ?", [tableName], (err) => {
        if (err && !err.message.includes('no such table')) {
          console.error(`❌ Error resetting sequence for ${tableName}:`, err.message);
          reject(err);
        } else {
          console.log(`✅ Reset sequence for: ${tableName}`);
          resolve();
        }
      });
    })
  );
  
  Promise.allSettled(sequenceResets).then(() => {
    commitTransaction();
  });
}

function commitTransaction() {
  console.log('\n💾 Committing changes...');
  
  db.run('COMMIT', (err) => {
    if (err) {
      console.error('❌ Failed to commit transaction:', err.message);
      rollbackTransaction();
    } else {
      console.log('✅ Transaction committed successfully');
      runVacuum();
    }
  });
}

function rollbackTransaction() {
  console.log('\n🔄 Rolling back changes...');
  
  db.run('ROLLBACK', (err) => {
    if (err) {
      console.error('❌ Failed to rollback transaction:', err.message);
    } else {
      console.log('✅ Transaction rolled back');
    }
    
    console.log('\n❌ Database cleaning failed');
    console.log('💾 Original database preserved');
    console.log(`🔄 Restore from backup if needed: ${backupPath}`);
    
    db.close();
    process.exit(1);
  });
}

function runVacuum() {
  console.log('\n🗜️  Compacting database...');
  
  db.run('VACUUM', (err) => {
    if (err) {
      console.error('❌ Failed to vacuum database:', err.message);
    } else {
      console.log('✅ Database compacted');
    }
    
    console.log('\n🎉 Database cleaning completed! (GITHUB_TOKEN preserved)');
    console.log(`💾 Backup saved as: ${backupPath}`);
    
    db.close();
  });
}
