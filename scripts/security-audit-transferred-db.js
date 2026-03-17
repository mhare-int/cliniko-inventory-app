#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

console.log('🔍 SECURITY AUDIT: Checking what sensitive data was in the transferred database...');

// Check the fixed database that was sent to user
const dbPath = 'C:\\Users\\mhare\\Downloads\\appdata-fixed.db';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to fixed database that was sent to user');
});

// Check for any sensitive data that might have been included
console.log('\n🔍 Checking for sensitive data...');

// 1. Check settings table for API keys or tokens
db.all(`SELECT * FROM settings`, (err, rows) => {
  if (err) {
    console.error('❌ Error checking settings:', err.message);
  } else {
    console.log(`\n📋 Settings table (${rows.length} entries):`);
    rows.forEach(row => {
      console.log(`  ${row.setting_name}: ${row.setting_value}`);
    });
  }

  // 2. Check users table for any user data
  db.all(`SELECT * FROM users`, (err, rows) => {
    if (err) {
      console.error('❌ Error checking users:', err.message);
    } else {
      console.log(`\n👥 Users table (${rows.length} entries):`);
      if (rows.length > 0) {
        rows.forEach(row => {
          console.log(`  User: ${row.username}, Admin: ${row.is_admin}, Password Hash: ${row.password_hash ? 'PRESENT' : 'NONE'}`);
        });
      } else {
        console.log(`  ✅ No users found`);
      }
    }

    // 3. Check for any session or token data
    db.all(`SELECT * FROM user_sessions`, (err, rows) => {
      if (err) {
        console.error('❌ Error checking sessions:', err.message);
      } else {
        console.log(`\n🔐 User sessions table (${rows.length} entries):`);
        if (rows.length > 0) {
          rows.forEach(row => {
            console.log(`  Session: ${row.session_token ? 'TOKEN_PRESENT' : 'NO_TOKEN'}, User: ${row.user_id}`);
          });
        } else {
          console.log(`  ✅ No sessions found`);
        }
      }

      // 4. Check all tables to see what data exists
      db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
        if (err) {
          console.error('❌ Error listing tables:', err.message);
        } else {
          console.log(`\n📊 All tables in database:`);
          tables.forEach(table => {
            console.log(`  - ${table.name}`);
          });
        }

        // 5. Critical check: Look for any Cliniko-related data that could trigger their system
        db.all(`SELECT * FROM products LIMIT 5`, (err, rows) => {
          if (err) {
            console.error('❌ Error checking products:', err.message);
          } else {
            console.log(`\n🛒 Sample products (${rows.length} shown):`);
            rows.forEach(row => {
              console.log(`  - ${row.name} (Cliniko ID: ${row.cliniko_id})`);
            });
          }

          db.close();
          
          console.log('\n⚠️  SECURITY ANALYSIS:');
          console.log('1. Check if any API keys or tokens were included');
          console.log('2. Product data with Cliniko IDs could potentially trigger something');
          console.log('3. Password change email timing is highly suspicious');
          console.log('4. Recommend immediate investigation with user');
        });
      });
    });
  });
});
