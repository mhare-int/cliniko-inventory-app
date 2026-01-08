const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:\\Users\\mhare\\Downloads\\appdata.db';

console.log('🔍 Analyzing user database to find purchase order issue...');
console.log(`Database: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Cannot open database:', err.message);
    return;
  }
  
  console.log('✅ Connected to user database\n');
  
  // First, check migration version
  db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
    if (err) {
      console.log('❌ Migration version check failed:', err.message);
    } else {
      console.log(`📋 Migration version: ${row ? row.version : 'NONE'}`);
    }
    
    // Check products table structure
    db.all('PRAGMA table_info(products)', (err, columns) => {
      if (err) {
        console.log('❌ Products schema check failed:', err.message);
      } else {
        console.log(`📊 Products table has ${columns.length} columns:`);
        columns.forEach(col => {
          console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
      }
      
      // Check recent purchase requests and their items
      console.log('\n🛒 Recent Purchase Requests:');
      db.all(`SELECT 
        pr.pr_id, 
        pr.created_at,
        pr.status,
        COUNT(pri.item_id) as item_count
        FROM purchase_requests pr 
        LEFT JOIN purchase_request_items pri ON pr.pr_id = pri.pr_id 
        WHERE pr.created_at > datetime('now', '-30 days')
        GROUP BY pr.pr_id 
        ORDER BY pr.created_at DESC 
        LIMIT 5`, (err, prs) => {
        
        if (err) {
          console.log('❌ Purchase requests check failed:', err.message);
        } else if (prs.length === 0) {
          console.log('  No recent purchase requests found');
        } else {
          prs.forEach(pr => {
            console.log(`  PR ${pr.pr_id}: ${pr.created_at} (${pr.item_count} items, status: ${pr.status})`);
          });
        }
        
        // Check the most recent purchase request items in detail
        console.log('\n🔍 Recent Purchase Request Items Detail:');
        db.all(`SELECT 
          pri.item_id,
          pri.pr_id,
          pri.product_name,
          pri.supplier_name,
          pri.supplier_id,
          pri.unit_cost,
          pri.cliniko_id,
          pri.created_at
          FROM purchase_request_items pri 
          WHERE pri.created_at > datetime('now', '-30 days')
          ORDER BY pri.created_at DESC 
          LIMIT 10`, (err, items) => {
          
          if (err) {
            console.log('❌ Purchase request items check failed:', err.message);
          } else if (items.length === 0) {
            console.log('  No recent purchase request items found');
          } else {
            console.log(`  Found ${items.length} recent items:`);
            items.forEach(item => {
              console.log(`    Item ${item.item_id} (PR ${item.pr_id}): ${item.product_name}`);
              console.log(`      Supplier: "${item.supplier_name}" (ID: ${item.supplier_id})`);
              console.log(`      Unit Cost: ${item.unit_cost}`);
              console.log(`      Cliniko ID: ${item.cliniko_id}`);
              console.log(`      Created: ${item.created_at}`);
              console.log('');
            });
          }
          
          // Check products data quality
          console.log('📦 Products Data Analysis:');
          db.get(`SELECT 
            COUNT(*) as total_products,
            COUNT(CASE WHEN supplier_name IS NULL OR supplier_name = '' THEN 1 END) as missing_supplier_name,
            COUNT(CASE WHEN supplier_id IS NULL THEN 1 END) as missing_supplier_id,
            COUNT(CASE WHEN unit_price IS NULL OR unit_price = 0 THEN 1 END) as missing_unit_price,
            COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as has_supplier_name,
            COUNT(CASE WHEN supplier_id IS NOT NULL THEN 1 END) as has_supplier_id
            FROM products`, (err, stats) => {
            
            if (err) {
              console.log('❌ Product stats failed:', err.message);
            } else {
              console.log(`  Total products: ${stats.total_products}`);
              console.log(`  Has supplier_name: ${stats.has_supplier_name} (${(stats.has_supplier_name/stats.total_products*100).toFixed(1)}%)`);
              console.log(`  Has supplier_id: ${stats.has_supplier_id} (${(stats.has_supplier_id/stats.total_products*100).toFixed(1)}%)`);
              console.log(`  Missing supplier_name: ${stats.missing_supplier_name}`);
              console.log(`  Missing supplier_id: ${stats.missing_supplier_id}`);
              console.log(`  Missing unit_price: ${stats.missing_unit_price}`);
            }
            
            // Check suppliers table
            console.log('\n🏢 Suppliers Analysis:');
            db.all('SELECT id, name, active FROM suppliers ORDER BY name LIMIT 10', (err, suppliers) => {
              if (err) {
                console.log('❌ Suppliers check failed:', err.message);
              } else {
                console.log(`  Found ${suppliers.length} suppliers (showing first 10):`);
                suppliers.forEach(s => {
                  console.log(`    ID ${s.id}: ${s.name} (${s.active ? 'active' : 'inactive'})`);
                });
              }
              
              // Sample a few products to see their supplier data
              console.log('\n🔬 Sample Product Data:');
              db.all(`SELECT 
                cliniko_id, 
                name, 
                supplier_name, 
                supplier_id, 
                unit_price 
                FROM products 
                WHERE supplier_name IS NOT NULL AND supplier_name != ''
                LIMIT 5`, (err, sampleProducts) => {
                
                if (err) {
                  console.log('❌ Sample products failed:', err.message);
                } else {
                  console.log('  Products WITH supplier_name:');
                  sampleProducts.forEach(p => {
                    console.log(`    ${p.name}: supplier_name="${p.supplier_name}", supplier_id=${p.supplier_id}, price=${p.unit_price}`);
                  });
                }
                
                // Sample products without supplier_name
                db.all(`SELECT 
                  cliniko_id, 
                  name, 
                  supplier_name, 
                  supplier_id, 
                  unit_price 
                  FROM products 
                  WHERE supplier_name IS NULL OR supplier_name = ''
                  LIMIT 5`, (err, noSupplierProducts) => {
                  
                  if (err) {
                    console.log('❌ No supplier products failed:', err.message);
                  } else {
                    console.log('\n  Products WITHOUT supplier_name:');
                    noSupplierProducts.forEach(p => {
                      console.log(`    ${p.name}: supplier_name="${p.supplier_name}", supplier_id=${p.supplier_id}, price=${p.unit_price}`);
                    });
                  }
                  
                  db.close();
                  console.log('\n✅ Analysis complete!');
                });
              });
            });
          });
        });
      });
    });
  });
});
