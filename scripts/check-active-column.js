const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';
console.log('🔍 Checking products table schema...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    return;
  }
  
  db.all('PRAGMA table_info(products)', (err, columns) => {
    if (err) {
      console.error('❌ Schema check error:', err);
    } else {
      console.log('📊 Products table columns:');
      columns.forEach(col => {
        console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
      });
      
      const hasActive = columns.find(col => col.name === 'active');
      console.log(`\n✅ Has 'active' column: ${hasActive ? 'YES' : 'NO'}`);
      
      if (hasActive) {
        console.log(`   Type: ${hasActive.type}, Default: ${hasActive.dflt_value || 'NULL'}`);
      }
    }
    db.close();
  });
});
