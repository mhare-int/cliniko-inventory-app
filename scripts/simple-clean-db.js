#!/usr/bin/env node

/**
 * Comprehensive Database Cleaner and Validator
 * 
 * This script removes all user data from the database and validates the result.
 * 
 * Usage: node simple-clean-db.js [database-path] [--keep-api-key]
 * 
 * Options:
 *   --keep-api-key    Keep the API key for testing setup flow
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Check for flags
const keepApiKey = process.argv.includes('--keep-api-key');

// Get database path from command line or use default (filter out flags)
const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const dbPath = args[0] || path.join(__dirname, 'backend', 'appdata.db');

console.log('🧹 Comprehensive Database Cleaner and Validator');
console.log('===============================================');
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

// Create backup
const backupPath = `${dbPath}.backup-clean-${new Date().toISOString().replace(/[:.]/g, '-')}`;
console.log(`💾 Creating backup: ${backupPath}`);

try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('✅ Backup created successfully');
} catch (err) {
  console.error('❌ Failed to create backup:', err.message);
  process.exit(1);
}

// Tables to clear
const CLEAR_COMMANDS = [
  "DELETE FROM products",
  "DELETE FROM product_sales", 
  "DELETE FROM purchase_requests",
  "DELETE FROM purchase_request_items",
  "DELETE FROM suppliers",
  "DELETE FROM users",
  "DELETE FROM user_sessions",
  "DELETE FROM user_behavior_log",
  "DELETE FROM user_preferences",
  "DELETE FROM receipt_log",
  "DELETE FROM product_change_log",
  "DELETE FROM item_receipt_log",
  "DELETE FROM sqlite_sequence"
];

// Settings cleanup - conditional based on keepApiKey flag
const SETTINGS_CLEANUP = keepApiKey ? 
  [] : // Don't remove API key when testing
  ["DELETE FROM settings WHERE key IN ('CLINIKO_API_KEY')"]; // Remove API key for production

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
  console.log('\n🧹 Cleaning user data...');
  
  // Combine all cleanup commands
  const allCommands = [...CLEAR_COMMANDS, ...SETTINGS_CLEANUP];
  
  let completed = 0;
  let failed = false;
  
  allCommands.forEach((command, index) => {
    db.run(command, function(err) {
      completed++;
      
      if (err) {
        console.error(`❌ Failed: ${command} - ${err.message}`);
        failed = true;
      } else {
        console.log(`✅ ${command} (${this.changes} rows affected)`);
      }
      
      if (completed === allCommands.length) {
        finishCleaning(failed);
      }
    });
  });
}

function finishCleaning(failed) {
  if (failed) {
    console.log('\n❌ Some operations failed');
    db.close();
    process.exit(1);
  } else {
    console.log('\n✅ All operations completed successfully');
    
    // Run VACUUM to clean up
    db.run('VACUUM', (err) => {
      if (err) {
        console.error('❌ VACUUM failed:', err.message);
      } else {
        console.log('✅ Database compacted');
      }
      
      const preservedTokens = keepApiKey ? 'GITHUB_TOKEN & API_KEY preserved' : 'GITHUB_TOKEN preserved';
      console.log(`\n🎉 Database cleaning completed! (${preservedTokens})`);
      console.log(`💾 Backup saved as: ${backupPath}`);
      
      // Run integrated validation
      validateDatabase();
    });
  }
}

function validateDatabase() {
  console.log('\n🔍 Validating cleaned database...');
  console.log('=================================');
  
  let validationErrors = 0;
  let checksCompleted = 0;
  const totalChecks = 6;
  
  // Check 1: Verify tables are empty
  const tablesToCheck = ['products', 'users', 'suppliers', 'product_sales', 'purchase_requests', 'user_sessions'];
  
  tablesToCheck.forEach(table => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      checksCompleted++;
      if (err) {
        console.error(`❌ Error checking ${table}: ${err.message}`);
        validationErrors++;
      } else if (row.count > 0) {
        console.error(`❌ Table ${table} contains ${row.count} records - should be empty!`);
        validationErrors++;
      } else {
        console.log(`✅ Table ${table} is empty (correct)`);
      }
      
      if (checksCompleted === tablesToCheck.length) {
        checkSettings();
      }
    });
  });
  
  function checkSettings() {
    // Check 2: Verify GitHub token is preserved
    db.get("SELECT value FROM settings WHERE key = 'GITHUB_TOKEN'", (err, row) => {
      checksCompleted++;
      if (err) {
        console.error(`❌ Error checking GitHub token: ${err.message}`);
        validationErrors++;
      } else if (!row || !row.value) {
        console.error(`❌ GitHub token missing - auto-updater will not work!`);
        validationErrors++;
      } else {
        console.log(`✅ GitHub token preserved (length: ${row.value.length})`);
      }
      
      checkApiKey();
    });
  }
  
  function checkApiKey() {
    // Check 3: Verify API key status matches expectation
    db.get("SELECT value FROM settings WHERE key = 'CLINIKO_API_KEY'", (err, row) => {
      checksCompleted++;
      if (err) {
        console.error(`❌ Error checking API key: ${err.message}`);
        validationErrors++;
      } else if (keepApiKey) {
        if (!row || !row.value) {
          console.error(`❌ API key missing but --keep-api-key was specified!`);
          validationErrors++;
        } else {
          console.log(`✅ API key preserved for testing (length: ${row.value.length})`);
        }
      } else {
        if (row && row.value) {
          console.error(`❌ API key still present but should be removed!`);
          validationErrors++;
        } else {
          console.log(`✅ API key removed (correct for distribution)`);
        }
      }
      
      checkSchemaIntegrity();
    });
  }
  
  function checkSchemaIntegrity() {
    // Check 4: Verify essential tables exist
    const essentialTables = ['products', 'users', 'settings', 'suppliers'];
    let tablesChecked = 0;
    
    essentialTables.forEach(table => {
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
        tablesChecked++;
        checksCompleted++;
        if (err) {
          console.error(`❌ Error checking table ${table}: ${err.message}`);
          validationErrors++;
        } else if (!row) {
          console.error(`❌ Essential table ${table} missing!`);
          validationErrors++;
        } else {
          console.log(`✅ Table ${table} exists`);
        }
        
        if (tablesChecked === essentialTables.length) {
          checkFirstTimeSetup();
        }
      });
    });
  }
  
  function checkFirstTimeSetup() {
    // Check 5: Verify first-time setup state
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      checksCompleted++;
      if (err) {
        console.error(`❌ Error checking user count: ${err.message}`);
        validationErrors++;
      } else if (row.count === 0) {
        console.log(`✅ No users found - will trigger first-time setup`);
      } else {
        console.error(`❌ Users still exist - first-time setup will not trigger!`);
        validationErrors++;
      }
      
      finalValidation();
    });
  }
  
  function finalValidation() {
    // Final summary
    console.log('\n=================================');
    console.log('🎯 VALIDATION SUMMARY');
    console.log('=================================');
    
    if (validationErrors === 0) {
      console.log('✅ ALL VALIDATION CHECKS PASSED!');
      console.log('🎉 Database is ready for distribution/testing');
      if (keepApiKey) {
        console.log('🔧 Setup will use existing API key for testing');
      } else {
        console.log('🔧 Setup will require API key entry');
      }
      console.log('🚀 First-time setup will be triggered');
      db.close();
      process.exit(0);
    } else {
      console.log(`❌ ${validationErrors} VALIDATION ERROR(S) FOUND!`);
      console.log('🚨 Database may not be safe for distribution');
      console.log('💡 Please review the errors above');
      db.close();
      process.exit(1);
    }
  }
}
