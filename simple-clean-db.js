#!/usr/bin/env node

/**
 * Simple Database Cleaner for Distribution
 * 
 * This script removes all user data from the database using direct SQL commands.
 * 
 * Usage: node simple-clean-db.js [database-path]
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Get database path from command line or use default
const dbPath = process.argv[2] || path.join(__dirname, 'backend', 'appdata.db');

console.log('🧹 Simple Database Cleaning for Distribution');
console.log('============================================');
console.log(`📂 Database Path: ${dbPath}`);

// Check if database file exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found:', dbPath);
  process.exit(1);
}

// Create backup
const backupPath = `${dbPath}.backup-simple-clean-${new Date().toISOString().replace(/[:.]/g, '-')}`;
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
  "DELETE FROM users",
  "DELETE FROM user_sessions",
  "DELETE FROM user_behavior_log",
  "DELETE FROM user_preferences",
  "DELETE FROM receipt_log",
  "DELETE FROM product_change_log",
  "DELETE FROM item_receipt_log",
  // Preserve GITHUB_TOKEN so auto-updater continues to work
  "DELETE FROM settings WHERE key IN ('CLINIKO_API_KEY')",
  "DELETE FROM sqlite_sequence"
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
  console.log('\n🧹 Cleaning user data...');
  
  let completed = 0;
  let failed = false;
  
  CLEAR_COMMANDS.forEach((command, index) => {
    db.run(command, function(err) {
      completed++;
      
      if (err) {
        console.error(`❌ Failed: ${command} - ${err.message}`);
        failed = true;
      } else {
        console.log(`✅ ${command} (${this.changes} rows affected)`);
      }
      
      if (completed === CLEAR_COMMANDS.length) {
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
      
      console.log('\n🎉 Database cleaning completed! (GITHUB_TOKEN preserved)');
      console.log(`💾 Backup saved as: ${backupPath}`);
      
      db.close();
      
      // Validate the result
      console.log('\n🔍 Validating cleaned database...');
      const { spawn } = require('child_process');
      
      const validation = spawn('node', ['validate-database.js', dbPath], {
        stdio: 'inherit'
      });
      
      validation.on('close', (code) => {
        process.exit(code);
      });
    });
  }
}
