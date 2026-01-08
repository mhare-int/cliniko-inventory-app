#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();

console.log('🔍 Comparing dev vs user environment differences...');

// Check your local dev database
const devDbPath = 'backend/appdata.db';
const userDbPath = 'C:\\Users\\mhare\\Downloads\\appdata.db';

console.log('\n📊 Checking DEV database (your working environment):');
const devDb = new sqlite3.Database(devDbPath, (err) => {
  if (err) {
    console.error('❌ Error opening dev database:', err.message);
    return;
  }
  console.log('✅ Connected to dev database');
  
  // Check recent purchase request items in dev
  devDb.all(`SELECT 
    pr_id,
    product_id,
    product_name,
    supplier_name,
    supplier_id,
    unit_cost
  FROM purchase_request_items 
  ORDER BY rowid DESC
  LIMIT 5`, (err, devRows) => {
    if (err) {
      console.error('❌ Dev query failed:', err.message);
    } else {
      console.log(`📦 Recent DEV purchase request items (${devRows.length}):`);
      devRows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.pr_id}: ${row.product_name}`);
        console.log(`     Product ID: ${row.product_id}, Supplier: "${row.supplier_name}", Price: ${row.unit_cost}`);
      });
    }
    
    // Check a sample product in dev db to see ID structure
    devDb.all(`SELECT id, cliniko_id, name, supplier_name, supplier_id, unit_price 
              FROM products 
              WHERE supplier_name IS NOT NULL AND supplier_name != ''
              LIMIT 5`, (err, devProducts) => {
      if (err) {
        console.error('❌ Dev products query failed:', err.message);
      } else {
        console.log(`\n🛒 Sample DEV products (${devProducts.length}):`);
        devProducts.forEach((prod, i) => {
          console.log(`  ${i+1}. DB ID: ${prod.id} | Cliniko ID: ${prod.cliniko_id}`);
          console.log(`     Name: ${prod.name}`);
          console.log(`     Supplier: "${prod.supplier_name}" (ID: ${prod.supplier_id})`);
        });
      }
      
      devDb.close();
      
      // Now check user database for comparison
      console.log('\n📊 Checking USER database (broken environment):');
      const userDb = new sqlite3.Database(userDbPath, (err) => {
        if (err) {
          console.error('❌ Error opening user database:', err.message);
          return;
        }
        console.log('✅ Connected to user database');
        
        // Check same products in user db
        userDb.all(`SELECT id, cliniko_id, name, supplier_name, supplier_id, unit_price 
                   FROM products 
                   WHERE supplier_name IS NOT NULL AND supplier_name != ''
                   LIMIT 5`, (err, userProducts) => {
          if (err) {
            console.error('❌ User products query failed:', err.message);
          } else {
            console.log(`\n🛒 Sample USER products (${userProducts.length}):`);
            userProducts.forEach((prod, i) => {
              console.log(`  ${i+1}. DB ID: ${prod.id} | Cliniko ID: ${prod.cliniko_id}`);
              console.log(`     Name: ${prod.name}`);
              console.log(`     Supplier: "${prod.supplier_name}" (ID: ${prod.supplier_id})`);
            });
          }
          
          userDb.close();
          
          // Key insight questions:
          console.log('\n🤔 Key Questions:');
          console.log('1. Are the DB ID vs Cliniko ID patterns different?');
          console.log('2. Do you create purchase requests differently in dev?');
          console.log('3. Is there different data in your products table?');
          console.log('4. Are you using a different frontend flow?');
          console.log('\n💡 This suggests the issue might be:');
          console.log('- Different product data structure');
          console.log('- Different ID values being passed from frontend');
          console.log('- Different database content/migration state');
        });
      });
    });
  });
});
