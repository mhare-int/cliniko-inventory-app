// Database Diagnostic Tool for Version Compatibility Issues
// Run this to check for product data issues between versions

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/appdata.db');

console.log('🔍 Database Product Diagnostic Tool');
console.log('=====================================\n');

// Check database version
db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
  if (err) {
    console.error('❌ Error checking database version:', err.message);
  } else {
    console.log(`📊 Current Database Version: ${row ? row.version : 'Unknown'}`);
    console.log(`📊 Expected Database Version: 22\n`);
  }
});

// Check products table structure
db.all("PRAGMA table_info(products)", (err, columns) => {
  if (err) {
    console.error('❌ Error checking products table:', err.message);
  } else {
    console.log('📋 Products Table Structure:');
    columns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.pk ? '(PRIMARY KEY)' : ''} ${col.notnull ? '(NOT NULL)' : ''}`);
    });
    console.log('');
  }
});

// Count products and check for missing cliniko_ids
db.get('SELECT COUNT(*) as total FROM products', (err, row) => {
  if (err) {
    console.error('❌ Error counting products:', err.message);
  } else {
    console.log(`📦 Total Products: ${row.total}`);
  }
});

db.get('SELECT COUNT(*) as empty_ids FROM products WHERE cliniko_id IS NULL OR cliniko_id = ""', (err, row) => {
  if (err) {
    console.error('❌ Error checking empty cliniko_ids:', err.message);
  } else {
    console.log(`⚠️  Products with empty cliniko_id: ${row.empty_ids}`);
  }
});

// Show sample products
db.all('SELECT cliniko_id, name, current_stock, reorder_level FROM products LIMIT 5', (err, rows) => {
  if (err) {
    console.error('❌ Error fetching sample products:', err.message);
  } else {
    console.log('\n📝 Sample Products:');
    if (rows.length === 0) {
      console.log('  No products found in database');
    } else {
      rows.forEach(product => {
        console.log(`  - ID: ${product.cliniko_id}, Name: ${product.name}, Stock: ${product.current_stock}, Reorder: ${product.reorder_level}`);
      });
    }
  }
  
  db.close(() => {
    console.log('\n✅ Diagnostic complete');
  });
});
