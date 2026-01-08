const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('packaged-app.db');

console.log('Checking packaged app database...');

// Check tables
db.all('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name', (err, rows) => {
  if (err) console.error('Tables Error:', err);
  else console.log('Tables:', rows.map(r => r.name).join(', '));
  
  // Check products table structure
  db.all('PRAGMA table_info(products)', (err2, cols) => {
    if (err2) console.error('Products table error:', err2);
    else {
      console.log('Products table columns:');
      cols.forEach(col => console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''}`));
    }
    
    // Check if products table exists and is empty
    db.get('SELECT COUNT(*) as count FROM products', (err3, row) => {
      if (err3) console.error('Products count error:', err3);
      else console.log('Products count:', row.count);
      
      // Check schema version
      db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err4, row2) => {
        if (err4) console.error('Version error:', err4);
        else console.log('Schema version:', row2 ? row2.version : 'none');
        
        db.close();
      });
    });
  });
});
