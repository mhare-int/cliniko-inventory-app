const sqlite3 = require('sqlite3').verbose();

// Check both possible database locations
const dbPaths = [
  './backend/appdata.db',
  'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db'
];

async function checkDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Checking database: ${dbPath}`);
    
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.log(`❌ Cannot open database: ${err.message}`);
        return resolve(null);
      }
      
      console.log(`✅ Connected to database`);
      
      const checks = {};
      
      // Check migration version
      db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
        if (err) {
          checks.migration_version = `ERROR: ${err.message}`;
        } else {
          checks.migration_version = row ? row.version : 'NO VERSION TABLE';
        }
        
        // Check products table structure
        db.all('PRAGMA table_info(products)', (err, columns) => {
          if (err) {
            checks.products_schema = `ERROR: ${err.message}`;
          } else {
            const columnNames = columns.map(c => c.name);
            checks.products_schema = {
              total_columns: columns.length,
              has_active: columnNames.includes('active'),
              has_supplier_id: columnNames.includes('supplier_id'),
              has_supplier_name: columnNames.includes('supplier_name'),
              has_unit_price: columnNames.includes('unit_price'),
              has_unique_constraint: false // We'll check this separately
            };
          }
          
          // Check UNIQUE constraint
          db.get('SELECT sql FROM sqlite_master WHERE type="table" AND name="products"', (err, row) => {
            if (err) {
              checks.unique_constraint = `ERROR: ${err.message}`;
            } else {
              checks.unique_constraint = row && row.sql ? row.sql.includes('UNIQUE') : false;
              if (checks.products_schema && typeof checks.products_schema === 'object') {
                checks.products_schema.has_unique_constraint = checks.unique_constraint;
              }
            }
            
            // Check data counts
            db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
              if (err) {
                checks.product_count = `ERROR: ${err.message}`;
              } else {
                checks.product_count = row ? row.count : 0;
              }
              
              // Check suppliers table
              db.get('SELECT COUNT(*) as count FROM suppliers', (err, row) => {
                if (err) {
                  checks.supplier_count = `ERROR: ${err.message}`;
                } else {
                  checks.supplier_count = row ? row.count : 0;
                }
                
                // Check recent purchase requests
                db.get('SELECT COUNT(*) as count FROM purchase_requests WHERE created_at > datetime("now", "-7 days")', (err, row) => {
                  if (err) {
                    checks.recent_purchase_requests = `ERROR: ${err.message}`;
                  } else {
                    checks.recent_purchase_requests = row ? row.count : 0;
                  }
                  
                  // Check purchase request items with missing data
                  db.get(`SELECT 
                    COUNT(*) as total_items,
                    COUNT(CASE WHEN supplier_name IS NULL OR supplier_name = '' THEN 1 END) as missing_supplier,
                    COUNT(CASE WHEN unit_cost IS NULL OR unit_cost = 0 THEN 1 END) as missing_price
                    FROM purchase_request_items 
                    WHERE created_at > datetime("now", "-7 days")`, (err, row) => {
                    
                    if (err) {
                      checks.recent_pr_items = `ERROR: ${err.message}`;
                    } else {
                      checks.recent_pr_items = row || { total_items: 0, missing_supplier: 0, missing_price: 0 };
                    }
                    
                    // Check product data quality
                    db.get(`SELECT 
                      COUNT(*) as total_products,
                      COUNT(CASE WHEN supplier_name IS NULL OR supplier_name = '' THEN 1 END) as missing_supplier_name,
                      COUNT(CASE WHEN unit_price IS NULL OR unit_price = 0 THEN 1 END) as missing_unit_price,
                      COUNT(CASE WHEN supplier_id IS NULL THEN 1 END) as missing_supplier_id
                      FROM products`, (err, row) => {
                      
                      if (err) {
                        checks.product_data_quality = `ERROR: ${err.message}`;
                      } else {
                        checks.product_data_quality = row || {};
                      }
                      
                      db.close();
                      resolve(checks);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

async function main() {
  console.log('🚀 Database Migration & Data Integrity Check\n');
  console.log('This will help diagnose why purchase orders are missing supplier/price data.\n');
  
  for (const dbPath of dbPaths) {
    const result = await checkDatabase(dbPath);
    if (result) {
      console.log('\n📊 Database Check Results:');
      console.log('==========================================');
      console.log(`Migration Version: ${result.migration_version}`);
      console.log(`Product Count: ${result.product_count}`);
      console.log(`Supplier Count: ${result.supplier_count}`);
      console.log(`Recent Purchase Requests (7 days): ${result.recent_purchase_requests}`);
      
      if (typeof result.products_schema === 'object') {
        console.log('\n📋 Products Table Schema:');
        console.log(`  Total Columns: ${result.products_schema.total_columns}`);
        console.log(`  Has 'active' column: ${result.products_schema.has_active}`);
        console.log(`  Has 'supplier_id' column: ${result.products_schema.has_supplier_id}`);
        console.log(`  Has 'supplier_name' column: ${result.products_schema.has_supplier_name}`);
        console.log(`  Has 'unit_price' column: ${result.products_schema.has_unit_price}`);
        console.log(`  Has UNIQUE constraint: ${result.products_schema.has_unique_constraint}`);
      } else {
        console.log(`\n❌ Products Schema: ${result.products_schema}`);
      }
      
      if (typeof result.product_data_quality === 'object') {
        console.log('\n📈 Product Data Quality:');
        console.log(`  Total Products: ${result.product_data_quality.total_products}`);
        console.log(`  Missing supplier_name: ${result.product_data_quality.missing_supplier_name}`);
        console.log(`  Missing unit_price: ${result.product_data_quality.missing_unit_price}`);
        console.log(`  Missing supplier_id: ${result.product_data_quality.missing_supplier_id}`);
      }
      
      if (typeof result.recent_pr_items === 'object') {
        console.log('\n🛒 Recent Purchase Request Items (7 days):');
        console.log(`  Total Items: ${result.recent_pr_items.total_items}`);
        console.log(`  Missing Supplier: ${result.recent_pr_items.missing_supplier}`);
        console.log(`  Missing Price: ${result.recent_pr_items.missing_price}`);
      }
      
      // Recommendations
      console.log('\n💡 Recommendations:');
      if (result.migration_version !== 24) {
        console.log('⚠️  Migration version should be 24. Run app to trigger migrations.');
      }
      if (!result.products_schema.has_active) {
        console.log('⚠️  Missing "active" column - migration 24 may not have run.');
      }
      if (!result.products_schema.has_unique_constraint) {
        console.log('⚠️  Missing UNIQUE constraint - migration 23 may not have run properly.');
      }
      if (result.product_data_quality.missing_supplier_name > 0) {
        console.log(`⚠️  ${result.product_data_quality.missing_supplier_name} products missing supplier_name - run sync to fix.`);
      }
      if (result.product_data_quality.missing_unit_price > 0) {
        console.log(`⚠️  ${result.product_data_quality.missing_unit_price} products missing unit_price - run sync to fix.`);
      }
      
      break; // Found a working database
    }
  }
}

main().catch(console.error);
