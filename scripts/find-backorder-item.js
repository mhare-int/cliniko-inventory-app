const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'appdata.db');
const db = new sqlite3.Database(dbPath);

console.log('Finding the backorder item...\n');

// Get details of the backorder item
db.all(`
  SELECT 
    id,
    pr_id,
    product_id,
    product_name,
    supplier_name,
    no_to_order,
    received_so_far,
    backorder_qty,
    unit_cost,
    created_at
  FROM purchase_request_items 
  WHERE backorder_qty > 0
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('Backorder item found:');
  rows.forEach((row, i) => {
    console.log(`${i + 1}. Item ID: ${row.id}`);
    console.log(`   Purchase Request: ${row.pr_id}`);
    console.log(`   Product: ${row.product_name}`);
    console.log(`   Supplier: ${row.supplier_name}`);
    console.log(`   Ordered: ${row.no_to_order}`);
    console.log(`   Received: ${row.received_so_far}`);
    console.log(`   Backorder Qty: ${row.backorder_qty}`);
    console.log(`   Unit Cost: $${row.unit_cost}`);
    console.log(`   Created: ${row.created_at}`);
    console.log('');
  });

  console.log('**How to see the backorder visual indicators:**');
  console.log('1. Go to "Active Purchase Orders" in the app');
  console.log(`2. Look for Purchase Order: ${rows[0]?.pr_id}`);
  console.log('3. Click on that Purchase Order ID to EXPAND it');
  console.log('4. You should see the item with:');
  console.log('   - YELLOW BACKGROUND (#fff3cd)');
  console.log(`   - Text showing "[BACKORDER: ${rows[0]?.backorder_qty}]" after the product name`);
  console.log('   - Item checkbox should be disabled');
  console.log('   - Outstanding quantity should show 0');

  db.close();
});
