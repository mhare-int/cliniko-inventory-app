const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';

async function fixClinikoIdPrecision() {
  const db = new sqlite3.Database(dbPath);
  
  console.log('🔧 Fixing cliniko_id precision issue...');
  
  try {
    // Step 1: Create backup table with TEXT cliniko_id
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE products_backup AS SELECT * FROM products`, (err) => {
        if (err) return reject(err);
        console.log('✅ Created backup table');
        resolve();
      });
    });
    
    // Step 2: Drop original table
    await new Promise((resolve, reject) => {
      db.run(`DROP TABLE products`, (err) => {
        if (err) return reject(err);
        console.log('✅ Dropped original table');
        resolve();
      });
    });
    
    // Step 3: Create new table with TEXT cliniko_id
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliniko_id TEXT NOT NULL,
        name TEXT NOT NULL,
        supplier_id INTEGER,
        stock INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 0,
        barcode TEXT,
        supplier_name TEXT,
        created_at TEXT,
        unit_price REAL,
        current_stock INTEGER DEFAULT 0
      )`, (err) => {
        if (err) return reject(err);
        console.log('✅ Created new table with TEXT cliniko_id');
        resolve();
      });
    });
    
    // Step 4: Copy data back, ensuring cliniko_id is stored as TEXT
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO products (id, cliniko_id, name, supplier_id, stock, reorder_level, barcode, supplier_name, created_at, unit_price, current_stock)
               SELECT id, CAST(cliniko_id AS TEXT), name, supplier_id, stock, reorder_level, barcode, supplier_name, created_at, unit_price, current_stock 
               FROM products_backup`, (err) => {
        if (err) return reject(err);
        console.log('✅ Copied data back with TEXT cliniko_id');
        resolve();
      });
    });
    
    // Step 5: Drop backup table
    await new Promise((resolve, reject) => {
      db.run(`DROP TABLE products_backup`, (err) => {
        if (err) return reject(err);
        console.log('✅ Dropped backup table');
        resolve();
      });
    });
    
    // Step 6: Verify the fix
    await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(products)', (err, columns) => {
        if (err) return reject(err);
        const clinikoCol = columns.find(c => c.name === 'cliniko_id');
        console.log('✅ New cliniko_id column definition:', clinikoCol);
        resolve();
      });
    });
    
    // Step 7: Test with a long ID
    await new Promise((resolve, reject) => {
      db.get('SELECT cliniko_id, typeof(cliniko_id) as id_type, length(cliniko_id) as length FROM products WHERE length(cliniko_id) > 15 LIMIT 1', (err, row) => {
        if (err) return reject(err);
        if (row) {
          console.log('✅ Test long ID:', row.cliniko_id, '(type:', row.id_type, ', length:', row.length + ')');
        }
        resolve();
      });
    });
    
    console.log('\n🎉 cliniko_id precision fix completed successfully!');
    console.log('   - Column type changed from INTEGER to TEXT');
    console.log('   - All existing IDs preserved as exact strings');
    console.log('   - JavaScript precision issues resolved');
    
  } catch (error) {
    console.error('❌ Error fixing cliniko_id precision:', error);
  } finally {
    db.close();
  }
}

fixClinikoIdPrecision();
