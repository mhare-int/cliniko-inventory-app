const sqlite3 = require('sqlite3').verbose();

const dbPath = './backend/appdata.db';

console.log('🔍 Diagnosing Purchase Order data issues...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    return;
  }
  
  console.log('✅ Connected to database');
  
  // Check products data completeness
  console.log('\n📊 Product Data Completeness Analysis:');
  
  db.get('SELECT COUNT(*) as total FROM products', (err, totalRow) => {
    if (err) {
      console.error('❌ Total count error:', err);
      return;
    }
    
    console.log(`Total products: ${totalRow.total}`);
    
    // Check missing supplier_name
    db.get('SELECT COUNT(*) as count FROM products WHERE supplier_name IS NULL OR supplier_name = ""', (err, row1) => {
      if (err) {
        console.error('❌ Supplier name check error:', err);
      } else {
        console.log(`❌ Products missing supplier_name: ${row1.count} (${(row1.count/totalRow.total*100).toFixed(1)}%)`);
      }
      
      // Check missing unit_price  
      db.get('SELECT COUNT(*) as count FROM products WHERE unit_price IS NULL OR unit_price = 0', (err, row2) => {
        if (err) {
          console.error('❌ Unit price check error:', err);
        } else {
          console.log(`❌ Products missing unit_price: ${row2.count} (${(row2.count/totalRow.total*100).toFixed(1)}%)`);
        }
        
        // Check missing supplier_id
        db.get('SELECT COUNT(*) as count FROM products WHERE supplier_id IS NULL', (err, row3) => {
          if (err) {
            console.error('❌ Supplier ID check error:', err);
          } else {
            console.log(`❌ Products missing supplier_id: ${row3.count} (${(row3.count/totalRow.total*100).toFixed(1)}%)`);
          }
          
          // Sample products showing the issue
          console.log('\n📦 Sample products with missing data:');
          db.all(`SELECT cliniko_id, name, supplier_name, supplier_id, unit_price 
                  FROM products 
                  WHERE (supplier_name IS NULL OR supplier_name = '') 
                     OR (unit_price IS NULL OR unit_price = 0) 
                  LIMIT 5`, (err, samples) => {
            if (err) {
              console.error('❌ Sample query error:', err);
            } else {
              samples.forEach((product, index) => {
                console.log(`  ${index + 1}. ${product.name}`);
                console.log(`     ID: ${product.cliniko_id}`);
                console.log(`     Supplier Name: "${product.supplier_name || 'MISSING'}"`);
                console.log(`     Supplier ID: ${product.supplier_id || 'MISSING'}`);
                console.log(`     Unit Price: ${product.unit_price || 'MISSING'}`);
                console.log('');
              });
            }
            
            // Check suppliers table for mapping
            console.log('\n🏢 Suppliers table check:');
            db.get('SELECT COUNT(*) as count FROM suppliers', (err, supRow) => {
              if (err) {
                console.error('❌ Suppliers count error:', err);
              } else {
                console.log(`Total suppliers: ${supRow.count}`);
              }
              
              // Check recent purchase requests and items
              console.log('\n📋 Recent Purchase Request Items (to see the issue):');
              db.all(`SELECT 
                        pri.pr_id, 
                        pri.product_name, 
                        pri.supplier_name, 
                        pri.unit_cost, 
                        pri.created_at,
                        p.supplier_name as product_supplier_name,
                        p.unit_price as product_unit_price
                      FROM purchase_request_items pri
                      LEFT JOIN products p ON pri.product_id = p.cliniko_id
                      ORDER BY pri.created_at DESC 
                      LIMIT 3`, (err, items) => {
                if (err) {
                  console.error('❌ Purchase items query error:', err);
                } else {
                  if (items.length === 0) {
                    console.log('   No purchase request items found');
                  } else {
                    items.forEach((item, index) => {
                      console.log(`   ${index + 1}. ${item.product_name}`);
                      console.log(`      PR ID: ${item.pr_id}`);
                      console.log(`      PRI Supplier: "${item.supplier_name || 'MISSING'}"`);
                      console.log(`      PRI Unit Cost: ${item.unit_cost || 'MISSING'}`);
                      console.log(`      Product Supplier: "${item.product_supplier_name || 'MISSING'}"`);
                      console.log(`      Product Unit Price: ${item.product_unit_price || 'MISSING'}`);
                      console.log(`      Created: ${item.created_at}`);
                      console.log('');
                    });
                  }
                }
                
                db.close();
                console.log('✅ PO Diagnostic completed!');
              });
            });
          });
        });
      });
    });
  });
});
