const sqlite3 = require('sqlite3');
const path = require('path');

// Fix for 3.1.0 - Add missing UNIQUE constraint on cliniko_id
async function fixClinikoIdConstraint() {
  const dbPath = path.join(__dirname, 'backend', 'appdata.db');
  console.log('🔧 Fixing cliniko_id UNIQUE constraint...');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    // Check if UNIQUE constraint exists
    db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'", (err, rows) => {
      if (err) return reject(err);
      
      const tableSQL = rows[0]?.sql || '';
      console.log('Current products table SQL:', tableSQL);
      
      if (tableSQL.includes('cliniko_id TEXT NOT NULL UNIQUE')) {
        console.log('✅ UNIQUE constraint already exists');
        db.close();
        return resolve('Already has UNIQUE constraint');
      }
      
      if (!tableSQL.includes('cliniko_id TEXT NOT NULL')) {
        console.log('❌ Table structure is unexpected');
        db.close();
        return reject('Unexpected table structure');
      }
      
      console.log('🔄 Adding UNIQUE constraint to cliniko_id...');
      
      // Need to recreate table to add UNIQUE constraint
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        db.run("CREATE TABLE products_temp AS SELECT * FROM products", (backupErr) => {
          if (backupErr) {
            db.run("ROLLBACK");
            db.close();
            return reject(backupErr);
          }
          
          db.run("DROP TABLE products", (dropErr) => {
            if (dropErr) {
              db.run("ROLLBACK");
              db.close();
              return reject(dropErr);
            }
            
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
                db.run("ROLLBACK");
                db.close();
                return reject(createErr);
              }
              
              db.run(`INSERT INTO products SELECT * FROM products_temp`, (copyErr) => {
                if (copyErr) {
                  db.run("ROLLBACK");
                  db.close();
                  return reject(copyErr);
                }
                
                db.run("DROP TABLE products_temp", (cleanupErr) => {
                  if (cleanupErr) {
                    db.run("ROLLBACK");
                    db.close();
                    return reject(cleanupErr);
                  }
                  
                  db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                      db.run("ROLLBACK");
                      db.close();
                      return reject(commitErr);
                    }
                    
                    console.log('✅ UNIQUE constraint added successfully');
                    db.close();
                    resolve('UNIQUE constraint added');
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

if (require.main === module) {
  fixClinikoIdConstraint()
    .then(result => {
      console.log('Fix completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClinikoIdConstraint };
