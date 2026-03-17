const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('=== VERIFICATION: LONG CLINIKO_IDs AFTER FIX ===');
db.all('SELECT cliniko_id, typeof(cliniko_id) as id_type, length(cliniko_id) as length, name FROM products WHERE length(cliniko_id) > 15 ORDER BY length DESC LIMIT 5', (err, rows) => {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Products with long cliniko_id values (now as TEXT):');
    rows.forEach((row, i) => {
      console.log(`  ${i+1}. ID: "${row.cliniko_id}" (type: ${row.id_type}, length: ${row.length})`);
      console.log(`      Product: ${row.name.substring(0, 60)}`);
    });
  }
  
  console.log('\n=== TESTING LOOKUP WITH LONG ID ===');
  if (rows.length > 0) {
    const testId = rows[0].cliniko_id;
    console.log('Testing lookup with ID:', testId);
    
    db.get('SELECT name FROM products WHERE cliniko_id = ?', [testId], (lookupErr, product) => {
      if (lookupErr) {
        console.log('Lookup error:', lookupErr.message);
      } else if (product) {
        console.log('✅ LOOKUP SUCCESS:', product.name);
      } else {
        console.log('❌ LOOKUP FAILED: Product not found');
      }
      db.close();
    });
  } else {
    console.log('No long IDs to test');
    db.close();
  }
});
