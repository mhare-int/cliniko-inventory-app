#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing user database - correcting purchase request items...');

// Paths
const originalDbPath = 'C:\\Users\\mhare\\Downloads\\appdata.db';
const backupDbPath = 'C:\\Users\\mhare\\Downloads\\appdata-fixed.db';

// Create a backup copy to work on
console.log('📋 Creating backup copy...');
fs.copyFileSync(originalDbPath, backupDbPath);
console.log(`✅ Created: ${backupDbPath}`);

const db = new sqlite3.Database(backupDbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database copy');
});

// Step 1: Check current broken purchase request items
console.log('\n🔍 Checking broken purchase request items...');
db.all(`SELECT 
  rowid,
  pr_id,
  product_id,
  product_name,
  supplier_name,
  supplier_id,
  unit_cost
FROM purchase_request_items 
WHERE (supplier_name IS NULL OR supplier_name = 'null' OR supplier_name = '') 
   OR (unit_cost IS NULL OR unit_cost = 0)
ORDER BY pr_id, rowid`, (err, brokenItems) => {
  if (err) {
    console.error('❌ Error checking items:', err.message);
    db.close();
    return;
  }

  console.log(`📊 Found ${brokenItems.length} broken purchase request items`);
  if (brokenItems.length === 0) {
    console.log('✅ No items need fixing!');
    db.close();
    return;
  }

  // Show broken items
  brokenItems.forEach((item, i) => {
    console.log(`  ${i+1}. ${item.pr_id}: ${item.product_name}`);
    console.log(`     Product ID: ${item.product_id}, Supplier: "${item.supplier_name}", Price: ${item.unit_cost}`);
  });

  // Step 2: Fix each broken item by looking up correct data
  console.log('\n🔧 Fixing broken items...');
  let fixedCount = 0;
  let errorCount = 0;

  const fixItem = (itemIndex) => {
    if (itemIndex >= brokenItems.length) {
      console.log(`\n✅ Fixing complete! Fixed: ${fixedCount}, Errors: ${errorCount}`);
      
      // Step 3: Recalculate line totals and PR totals
      console.log('\n💰 Recalculating totals...');
      db.run(`UPDATE purchase_request_items 
              SET line_total = COALESCE(unit_cost * quantity, 0) 
              WHERE line_total != COALESCE(unit_cost * quantity, 0)`, (err) => {
        if (err) {
          console.error('❌ Error updating line totals:', err.message);
        } else {
          console.log('✅ Updated line totals');
        }

        // Update PR totals
        db.run(`UPDATE purchase_requests 
                SET total_cost = (
                  SELECT COALESCE(SUM(line_total), 0) 
                  FROM purchase_request_items 
                  WHERE purchase_request_items.pr_id = purchase_requests.pr_id
                )`, (err) => {
          if (err) {
            console.error('❌ Error updating PR totals:', err.message);
          } else {
            console.log('✅ Updated purchase request totals');
          }

          // Final verification
          console.log('\n🎉 Database fix complete!');
          console.log(`📁 Fixed database saved as: ${backupDbPath}`);
          console.log('\n📋 Instructions for user:');
          console.log('1. Close the Inventory Management app completely');
          console.log('2. Backup their current appdata.db file');
          console.log('3. Replace their appdata.db with this fixed version');
          console.log('4. Restart the app');
          console.log('5. Check that purchase orders now show supplier and price data');

          db.close();
        });
      });
      return;
    }

    const item = brokenItems[itemIndex];
    console.log(`\n  Fixing ${itemIndex + 1}/${brokenItems.length}: ${item.product_name}...`);

    // Try to find the product by name first (most reliable), then by product_id if available
    let query = '';
    let params = [];

    if (item.product_id) {
      query = `SELECT id, cliniko_id, supplier_name, supplier_id, unit_price 
               FROM products 
               WHERE id = ? OR cliniko_id = ? OR name = ? 
               LIMIT 1`;
      params = [item.product_id, item.product_id, item.product_name];
    } else {
      query = `SELECT id, cliniko_id, supplier_name, supplier_id, unit_price 
               FROM products 
               WHERE name = ? 
               LIMIT 1`;
      params = [item.product_name];
    }

    db.get(query, params, (err, product) => {
      if (err) {
        console.error(`    ❌ Error looking up product: ${err.message}`);
        errorCount++;
      } else if (!product) {
        console.log(`    ⚠️  Product not found in products table`);
        errorCount++;
      } else {
        // Update the broken item with correct data
        const newSupplierName = product.supplier_name || '';
        const newSupplierId = product.supplier_id || null;
        const newUnitCost = product.unit_price || 0;

        console.log(`    ✅ Found: supplier="${newSupplierName}", price=${newUnitCost}`);

        db.run(`UPDATE purchase_request_items 
                SET supplier_name = ?, supplier_id = ?, unit_cost = ?, product_id = ?
                WHERE rowid = ?`, 
               [newSupplierName, newSupplierId, newUnitCost, product.id, item.rowid], (err) => {
          if (err) {
            console.error(`    ❌ Error updating item: ${err.message}`);
            errorCount++;
          } else {
            fixedCount++;
          }
          
          // Continue to next item
          fixItem(itemIndex + 1);
        });
      }
    });
  };

  // Start fixing items
  fixItem(0);
});
