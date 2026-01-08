const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'appdata.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking for backorder items...\n');

// First, check the table structure
db.all(`PRAGMA table_info(purchase_request_items)`, (err, columns) => {
  if (err) {
    console.error('Error checking table structure:', err);
    db.close();
    return;
  }

  console.log('purchase_request_items table structure:');
  columns.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });

  // Simple check for backorder items
  db.all(`SELECT COUNT(*) as count FROM purchase_request_items WHERE backorder_qty > 0`, (err, result) => {
    if (err) {
      console.error('Error checking backorder count:', err);
    } else {
      console.log(`\nItems with backorder_qty > 0: ${result[0].count}`);
    }

    // Check for any purchase request items at all
    db.all(`SELECT COUNT(*) as total FROM purchase_request_items`, (err, total) => {
      if (err) {
        console.error('Error checking total items:', err);
      } else {
        console.log(`Total purchase request items: ${total[0].total}`);
        
        if (total[0].total === 0) {
          console.log('\nNo purchase request items found. To test backorder functionality:');
          console.log('1. Go to Master Stock List');
          console.log('2. Create a purchase order with some items');
          console.log('3. Go to Active Purchase Orders');
          console.log('4. Click on the Purchase Order ID to expand');
          console.log('5. Click "Edit PO"');
          console.log('6. Check the "Backorder" checkbox for any item');
          console.log('7. Add a reason and save');
          console.log('8. You should then see the yellow background and BACKORDER badge');
        }
      }

      db.close();
    });
  });
});
