const sqlite3 = require('sqlite3');

// Fix the missing UNIQUE constraint in the failing database
const failingDbPath = "C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db";

console.log('🔧 Fixing UNIQUE constraint in failing database...');
console.log('📂 Database path:', failingDbPath);

const db = new sqlite3.Database(failingDbPath);

db.serialize(() => {
  console.log('🚀 Starting table recreation with UNIQUE constraint...');
  
  db.run("BEGIN TRANSACTION", (beginErr) => {
    if (beginErr) {
      console.error('❌ Failed to begin transaction:', beginErr);
      return;
    }
    
    // Backup existing data
    db.run("CREATE TABLE products_backup AS SELECT * FROM products", (backupErr) => {
      if (backupErr) {
        console.error('❌ Failed to create backup:', backupErr);
        db.run("ROLLBACK");
        return;
      }
      console.log('✅ Created backup table');
      
      // Drop original table
      db.run("DROP TABLE products", (dropErr) => {
        if (dropErr) {
          console.error('❌ Failed to drop table:', dropErr);
          db.run("ROLLBACK");
          return;
        }
        console.log('✅ Dropped original table');
        
        // Recreate with UNIQUE constraint
        db.run(`CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliniko_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          supplier_id INTEGER,
          stock INTEGER DEFAULT 0,
          reorder_level INTEGER DEFAULT 0,
          barcode TEXT,
          supplier_name TEXT,
          created_at TEXT,
          unit_price REAL,
          current_stock INTEGER DEFAULT 0
        )`, (createErr) => {
          if (createErr) {
            console.error('❌ Failed to create new table:', createErr);
            db.run("ROLLBACK");
            return;
          }
          console.log('✅ Created new table with UNIQUE constraint');
          
          // Restore data
          db.run("INSERT INTO products SELECT * FROM products_backup", (restoreErr) => {
            if (restoreErr) {
              console.error('❌ Failed to restore data:', restoreErr);
              db.run("ROLLBACK");
              return;
            }
            console.log('✅ Restored data');
            
            // Clean up
            db.run("DROP TABLE products_backup", (cleanupErr) => {
              if (cleanupErr) {
                console.error('❌ Failed to cleanup backup:', cleanupErr);
                db.run("ROLLBACK");
                return;
              }
              console.log('✅ Cleaned up backup table');
              
              // Commit transaction
              db.run("COMMIT", (commitErr) => {
                if (commitErr) {
                  console.error('❌ Failed to commit:', commitErr);
                  db.run("ROLLBACK");
                  return;
                }
                
                console.log('🎉 Successfully fixed UNIQUE constraint!');
                
                // Verify the fix
                db.all('SELECT sql FROM sqlite_master WHERE type="table" AND name="products"', (verifyErr, rows) => {
                  if (verifyErr) {
                    console.error('❌ Verification failed:', verifyErr);
                  } else {
                    console.log('✅ Verification - New table structure:');
                    console.log(rows[0]?.sql);
                  }
                  
                  db.close();
                  console.log('🔧 Database fix completed!');
                });
              });
            });
          });
        });
      });
    });
  });
});
