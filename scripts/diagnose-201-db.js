// Database Diagnostic Tool for 2.0.1 vs 3.0.4 Compatibility
// Analyzes the 2.0.1 database to find the reorder level update issue

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db201Path = "C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db";
const db304Path = "./backend/appdata.db";

console.log('🔍 Database Compatibility Diagnostic');
console.log('====================================\n');

console.log('📊 Analyzing 2.0.1 Database...');
const db201 = new sqlite3.Database(db201Path, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening 2.0.1 database:', err.message);
    return;
  }
  
  // Check database version
  db201.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('❌ Error checking 2.0.1 database version:', err.message);
    } else {
      console.log(`📋 2.0.1 Database Version: ${row ? row.version : 'No version found'}`);
    }
  });

  // Check products table structure
  db201.all("PRAGMA table_info(products)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking 2.0.1 products table:', err.message);
    } else {
      console.log('\n📋 2.0.1 Products Table Structure:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} ${col.pk ? '(PRIMARY KEY)' : ''} ${col.notnull ? '(NOT NULL)' : ''}`);
      });
    }
  });

  // Count products and check for data issues
  db201.get('SELECT COUNT(*) as total FROM products', (err, row) => {
    if (err) {
      console.error('❌ Error counting 2.0.1 products:', err.message);
    } else {
      console.log(`\n📦 2.0.1 Total Products: ${row.total}`);
    }
  });

  db201.get('SELECT COUNT(*) as empty_ids FROM products WHERE cliniko_id IS NULL OR cliniko_id = ""', (err, row) => {
    if (err) {
      console.error('❌ Error checking empty cliniko_ids in 2.0.1:', err.message);
    } else {
      console.log(`⚠️  2.0.1 Products with empty cliniko_id: ${row.empty_ids}`);
    }
  });

  // Show sample products from 2.0.1
  db201.all('SELECT cliniko_id, name, current_stock, reorder_level FROM products ORDER BY name LIMIT 10', (err, rows) => {
    if (err) {
      console.error('❌ Error fetching 2.0.1 sample products:', err.message);
    } else {
      console.log('\n📝 2.0.1 Sample Products:');
      if (rows.length === 0) {
        console.log('  No products found in 2.0.1 database');
      } else {
        rows.forEach((product, index) => {
          console.log(`  ${index + 1}. ID: "${product.cliniko_id}", Name: "${product.name}", Stock: ${product.current_stock}, Reorder: ${product.reorder_level}`);
        });
      }
    }

    // Check for specific data type issues
    db201.all('SELECT cliniko_id, typeof(cliniko_id) as id_type FROM products LIMIT 5', (err, rows) => {
      if (err) {
        console.error('❌ Error checking cliniko_id data types:', err.message);
      } else {
        console.log('\n🔍 2.0.1 Cliniko ID Data Types:');
        rows.forEach(row => {
          console.log(`  - ID: "${row.cliniko_id}" (Type: ${row.id_type})`);
        });
      }

      // Test the exact query that's failing
      console.log('\n🧪 Testing updateProductReorderLevel query...');
      if (rows.length > 0) {
        const testId = rows[0].cliniko_id;
        console.log(`Testing with ID: "${testId}"`);
        
        db201.get('SELECT reorder_level FROM products WHERE cliniko_id = ?', [testId], (err, row) => {
          if (err) {
            console.error('❌ Query failed:', err.message);
          } else if (!row) {
            console.log('❌ Product not found with test query - this is the issue!');
          } else {
            console.log(`✅ Query successful - found product with reorder_level: ${row.reorder_level}`);
          }
          
          db201.close(() => {
            console.log('\n✅ 2.0.1 Database analysis complete');
          });
        });
      } else {
        db201.close(() => {
          console.log('\n✅ 2.0.1 Database analysis complete (no products to test)');
        });
      }
    });
  });
});
