#!/usr/bin/env node

/**
 * Purchase Request Data Analyzer
 * 
 * This script analyzes what data flows through your purchase request system
 * and shows exactly what would be sent to APIs if enabled.
 */

const sqlite3 = require('sqlite3');
const path = require('path');

// Connect to your database
const dbPath = path.join(__dirname, 'backend', 'appdata.db');
const db = new sqlite3.Database(dbPath);

console.log("📊 PURCHASE REQUEST DATA ANALYZER");
console.log("====================================\n");

// Function to analyze recent purchase requests
function analyzeRecentPurchaseRequests() {
  return new Promise((resolve, reject) => {
    console.log("🔍 Analyzing Recent Purchase Requests...\n");
    
    // Get recent purchase requests
    db.all(`
      SELECT pr.*, 
             GROUP_CONCAT(pri.product_name || ' (Qty: ' || pri.no_to_order || ')') as items_summary
      FROM purchase_requests pr
      LEFT JOIN purchase_request_items pri ON pr.pr_id = pri.pr_id
      WHERE pr.date_created >= date('now', '-30 days')
      GROUP BY pr.pr_id
      ORDER BY pr.date_created DESC
      LIMIT 5
    `, [], (err, rows) => {
      if (err) {
        console.error("❌ Database error:", err);
        return reject(err);
      }
      
      console.log(`Found ${rows.length} recent purchase requests:\n`);
      
      rows.forEach((pr, index) => {
        console.log(`${index + 1}. Purchase Request: ${pr.pr_id}`);
        console.log(`   Date: ${pr.date_created}`);
        console.log(`   Status: ${pr.received ? 'Received' : 'Pending'}`);
        console.log(`   Items: ${pr.items_summary || 'No items'}`);
        console.log("");
      });
      
      resolve(rows);
    });
  });
}

// Function to show what would be sent to Cliniko for a specific PR
function analyzeSpecificPR(prId) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Analyzing Purchase Request: ${prId}\n`);
    
    // Get PR details with items
    db.all(`
      SELECT pri.*, p.cliniko_id, p.supplier_name as current_supplier
      FROM purchase_request_items pri
      LEFT JOIN products p ON pri.product_id = p.cliniko_id
      WHERE pri.pr_id = ?
    `, [prId], (err, items) => {
      if (err) {
        console.error("❌ Database error:", err);
        return reject(err);
      }
      
      console.log("Items in this Purchase Request:");
      console.log("================================");
      
      items.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.product_name}`);
        console.log(`   Product ID: ${item.product_id}`);
        console.log(`   Cliniko ID: ${item.cliniko_id || 'Not found'}`);
        console.log(`   Supplier: ${item.supplier_name}`);
        console.log(`   Quantity Ordered: ${item.no_to_order}`);
        console.log(`   Quantity Received: ${item.received_so_far || 0}`);
        console.log(`   Outstanding: ${item.no_to_order - (item.received_so_far || 0)}`);
        
        // Show what would be sent to Cliniko
        if (item.cliniko_id) {
          console.log(`\n   🔗 Cliniko API Call (if stock update enabled):`);
          console.log(`   PUT https://api.au1.cliniko.com/v1/products/${item.cliniko_id}`);
          console.log(`   Body: {`);
          console.log(`     "product": {`);
          console.log(`       "stock_level": "current_stock + ${item.no_to_order}"`);
          console.log(`     }`);
          console.log(`   }`);
        } else {
          console.log(`   ⚠️  No Cliniko ID found - would skip API update`);
        }
      });
      
      // Show summary of what would be sent
      console.log("\n" + "=".repeat(50));
      console.log("SUMMARY OF POTENTIAL API CALLS:");
      console.log("=".repeat(50));
      
      const validItems = items.filter(item => item.cliniko_id);
      const invalidItems = items.filter(item => !item.cliniko_id);
      
      console.log(`✅ Items that would update Cliniko: ${validItems.length}`);
      console.log(`❌ Items that would be skipped: ${invalidItems.length}`);
      
      if (validItems.length > 0) {
        console.log("\nValid API calls:");
        validItems.forEach(item => {
          console.log(`  - ${item.product_name}: Update stock by +${item.no_to_order}`);
        });
      }
      
      if (invalidItems.length > 0) {
        console.log("\nSkipped items (no Cliniko ID):");
        invalidItems.forEach(item => {
          console.log(`  - ${item.product_name}`);
        });
      }
      
      resolve({ validItems, invalidItems });
    });
  });
}

// Function to check current API settings
function checkAPISettings() {
  return new Promise((resolve, reject) => {
    console.log("\n🔧 Checking API Settings...\n");
    
    db.all(`
      SELECT key, value 
      FROM settings 
      WHERE key IN ('CLINIKO_API_KEY', 'cliniko_stock_update_enabled', 'smart_prompts_enabled')
    `, [], (err, settings) => {
      if (err) {
        console.error("❌ Database error:", err);
        return reject(err);
      }
      
      const settingsMap = {};
      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
      
      console.log("Current Settings:");
      console.log("=================");
      console.log(`API Key Set: ${settingsMap.CLINIKO_API_KEY ? 'Yes (masked)' : 'No'}`);
      console.log(`Stock Updates Enabled: ${settingsMap.cliniko_stock_update_enabled || 'No'}`);
      console.log(`Smart Prompts Enabled: ${settingsMap.smart_prompts_enabled || 'No'}`);
      
      if (settingsMap.CLINIKO_API_KEY) {
        console.log(`API Key Preview: ${settingsMap.CLINIKO_API_KEY.substring(0, 10)}...`);
      }
      
      resolve(settingsMap);
    });
  });
}

// Function to simulate what your app would send when creating a PR
function simulateCreatePurchaseRequest() {
  console.log("\n🎯 SIMULATING CREATE PURCHASE REQUEST");
  console.log("=====================================\n");
  
  // This mimics what your React app sends to the backend
  const simulatedData = {
    items: [
      {
        "Id": "1957057",
        "Product Name": "Metagenics Metazinc 60T", 
        "Supplier Name": "Health World Limited  (Metagenics)",
        "Stock": 5,
        "Reorder Level": 20,
        "No. to Order": 15
      },
      {
        "Id": "1957058",
        "Product Name": "Blackmores Vitamin D3 1000IU 200C",
        "Supplier Name": "Oborne Health Supplies", 
        "Stock": 3,
        "Reorder Level": 10,
        "No. to Order": 7
      }
    ]
  };
  
  console.log("Data sent from React frontend:");
  console.log(JSON.stringify(simulatedData, null, 2));
  
  console.log("\nWhat happens in the backend:");
  console.log("1. Generate PR ID (e.g., PUR00123)");
  console.log("2. Insert into purchase_requests table");
  console.log("3. Insert each item into purchase_request_items table");
  console.log("4. Return success message");
  console.log("5. NO CLINIKO API CALLS (currently disabled for safety)");
  
  console.log("\nWhat WOULD happen if Cliniko integration was enabled:");
  simulatedData.items.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item["Product Name"]}`);
    console.log(`   Would POST to: https://api.au1.cliniko.com/v1/purchase_orders`);
    console.log(`   OR would update stock when received`);
    console.log(`   Data: Quantity ${item["No. to Order"]} from ${item["Supplier Name"]}`);
  });
}

// Main function to run all analysis
async function runAnalysis() {
  try {
    await checkAPISettings();
    await analyzeRecentPurchaseRequests();
    
    // Get the most recent PR to analyze in detail
    const recentPRs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT pr_id FROM purchase_requests 
        ORDER BY date_created DESC 
        LIMIT 1
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (recentPRs.length > 0) {
      await analyzeSpecificPR(recentPRs[0].pr_id);
    }
    
    simulateCreatePurchaseRequest();
    
    console.log("\n🛡️  SAFETY RECOMMENDATIONS:");
    console.log("============================");
    console.log("1. Currently NO API writes are happening (safe)");
    console.log("2. Test with 1-2 products first when ready");
    console.log("3. Use Cliniko's test/sandbox environment if available");
    console.log("4. Always backup before enabling API writes");
    console.log("5. Monitor the first few API calls carefully");
    
  } catch (error) {
    console.error("❌ Error during analysis:", error);
  } finally {
    db.close();
  }
}

// Run the analysis
if (require.main === module) {
  runAnalysis();
}
