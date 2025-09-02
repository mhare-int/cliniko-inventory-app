#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

// Open the user's database
const dbPath = 'C:\\Users\\mhare\\Downloads\\appdata.db';
console.log('🔍 Checking purchase request table schemas...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to user database');
});

// Check purchase_request_items table schema
console.log('\n📋 Purchase Request Items Table Schema:');
db.all(`PRAGMA table_info(purchase_request_items)`, (err, columns) => {
  if (err) {
    console.error('❌ Schema check failed:', err.message);
  } else {
    console.log(`📊 purchase_request_items table has ${columns.length} columns:`);
    columns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}${col.notnull ? ' NOT NULL' : ''}`);
    });
  }

  // Check purchase_requests table schema
  console.log('\n📋 Purchase Requests Table Schema:');
  db.all(`PRAGMA table_info(purchase_requests)`, (err, columns) => {
    if (err) {
      console.error('❌ Schema check failed:', err.message);
    } else {
      console.log(`📊 purchase_requests table has ${columns.length} columns:`);
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}${col.notnull ? ' NOT NULL' : ''}`);
      });
    }

    // Try to get recent purchase request items with a simpler query
    console.log('\n🛒 Recent Purchase Request Items (simplified):');
    db.all(`SELECT 
      pr_id,
      product_id,
      product_name,
      supplier_name,
      supplier_id,
      CASE WHEN typeof(unit_cost) = 'null' THEN 'NULL' ELSE unit_cost END as unit_cost_display
    FROM purchase_request_items 
    ORDER BY rowid DESC
    LIMIT 10`, (err, rows) => {
      if (err) {
        console.error('❌ Purchase request items check failed:', err.message);
      } else {
        if (rows.length === 0) {
          console.log('📭 No purchase request items found');
        } else {
          console.log(`Found ${rows.length} recent purchase request items:`);
          rows.forEach((row, i) => {
            console.log(`  ${i+1}. PR: ${row.pr_id} | Product ID: ${row.product_id}`);
            console.log(`     Product: ${row.product_name}`);
            console.log(`     Supplier: "${row.supplier_name}" (ID: ${row.supplier_id})`);
            console.log(`     Unit Cost: ${row.unit_cost_display}`);
            console.log('');
          });
        }
      }

      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Schema analysis complete!');
        }
      });
    });
  });
});
