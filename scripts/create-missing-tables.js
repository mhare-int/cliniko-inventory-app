const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';

async function createMissingTables() {
  const db = new sqlite3.Database(dbPath);
  
  console.log('🔧 Creating missing tables in real database...');
  
  try {
    // Create vendor_files table (should already exist from migration 14, but let's ensure it)
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS vendor_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id TEXT NOT NULL,
        vendor_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
        console.log('✅ vendor_files table created/verified');
        resolve();
      });
    });
    
    // Create po_templates table
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS po_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        html TEXT,
        subject TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
        console.log('✅ po_templates table created');
        resolve();
      });
    });
    
    // Create generated_files table (this seems to be an alias for vendor_files based on the code)
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS generated_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id TEXT NOT NULL,
        vendor_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
        console.log('✅ generated_files table created');
        resolve();
      });
    });
    
    // Create vendor_oft_files table (seems to be legacy, but let's create it for compatibility)
    await new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS vendor_oft_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id TEXT NOT NULL,
        vendor_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
        console.log('✅ vendor_oft_files table created');
        resolve();
      });
    });
    
    console.log('\n🎉 All missing tables created successfully!');
    
    // Verify final table count
    await new Promise((resolve, reject) => {
      db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
        if (err) return reject(err);
        console.log(`\n📊 Final table count: ${tables.length}`);
        console.log('Tables:', tables.map(t => t.name).sort());
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    db.close();
  }
}

createMissingTables();
