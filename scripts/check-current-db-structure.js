const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';
console.log('🔍 Checking database structure...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    return;
  }
  console.log('✅ Connected to database:', dbPath);
  
  // Check table structure
  db.all('PRAGMA table_info(products)', (err, columns) => {
    if (err) {
      console.error('❌ Schema check error:', err);
      db.close();
      return;
    }
    
    console.log('📊 Products table structure:');
    columns.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Check for UNIQUE constraints
    db.all('SELECT sql FROM sqlite_master WHERE type="table" AND name="products"', (err, tables) => {
      if (err) {
        console.error('❌ Table definition error:', err);
      } else if (tables.length > 0) {
        console.log('📝 Table definition:');
        console.log(tables[0].sql);
        
        // Check if UNIQUE constraint exists
        if (tables[0].sql.includes('UNIQUE')) {
          console.log('✅ UNIQUE constraint found!');
        } else {
          console.log('❌ UNIQUE constraint missing!');
        }
      }
      
      // Count current products
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (err) {
          console.error('❌ Count error:', err);
        } else {
          console.log(`📦 Current products in database: ${row.count}`);
        }
        db.close();
      });
    });
  });
});
