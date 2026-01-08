const sqlite3 = require('sqlite3');

// Check the failing packaged app database structure
const failingDbPath = "C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db";

console.log('🔍 Analyzing failing packaged app database...');
console.log('📂 Database path:', failingDbPath);

const db = new sqlite3.Database(failingDbPath);

// 1. Check table structure
db.all('SELECT sql FROM sqlite_master WHERE type="table" AND name="products"', (err, rows) => {
  if (err) {
    console.error('❌ Error getting table structure:', err);
  } else {
    console.log('\n📋 Products table SQL:');
    console.log(rows[0]?.sql || 'Table not found');
  }
  
  // 2. Check indexes and constraints
  db.all('SELECT sql FROM sqlite_master WHERE type="index" AND tbl_name="products"', (err2, indexes) => {
    if (err2) {
      console.error('❌ Error getting indexes:', err2);
    } else {
      console.log('\n🔗 Products table indexes:');
      indexes.forEach(idx => console.log(idx.sql));
    }
    
    // 3. Check column info
    db.all('PRAGMA table_info(products)', (err3, columns) => {
      if (err3) {
        console.error('❌ Error getting column info:', err3);
      } else {
        console.log('\n📊 Column details:');
        columns.forEach(col => {
          console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
      }
      
      // 4. Check product count
      db.get('SELECT COUNT(*) as count FROM products', (err4, row) => {
        if (err4) {
          console.error('❌ Error counting products:', err4);
        } else {
          console.log('\n📈 Current product count:', row.count);
        }
        
        // 5. Check schema version
        db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err5, versionRow) => {
          if (err5) {
            console.error('❌ Error getting schema version:', err5);
          } else {
            console.log('🔢 Schema version:', versionRow ? versionRow.version : 'none');
          }
          
          // 6. Test a simple INSERT to see if it works
          console.log('\n🧪 Testing INSERT capability...');
          const testClinikoId = '999999999999999999'; // 18-digit test ID
          const testName = 'Test Product';
          
          db.run('INSERT INTO products (cliniko_id, name, stock, reorder_level) VALUES (?, ?, ?, ?)', 
            [testClinikoId, testName, 10, 5], 
            function(insertErr) {
              if (insertErr) {
                console.error('❌ Test INSERT failed:', insertErr);
              } else {
                console.log('✅ Test INSERT successful, row ID:', this.lastID);
                
                // Clean up test data
                db.run('DELETE FROM products WHERE cliniko_id = ?', [testClinikoId], (deleteErr) => {
                  if (deleteErr) console.warn('⚠️ Test cleanup failed:', deleteErr);
                  else console.log('🧹 Test data cleaned up');
                  
                  db.close();
                });
              }
            }
          );
        });
      });
    });
  });
});
