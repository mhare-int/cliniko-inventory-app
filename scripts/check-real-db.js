const sqlite3 = require('sqlite3').verbose();
const dbPath = './backend/appdata.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('=== REAL DATABASE TABLE COUNT ===');
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Total tables:', tables.length);
    console.log('Tables:');
    tables.forEach((table, i) => {
      console.log(`  ${i+1}. ${table.name}`);
    });
  }
  
  console.log('\n=== DATABASE VERSION ===');
  db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err2, row) => {
    if (err2) {
      console.log('Version error:', err2.message);
    } else {
      console.log('Schema version:', row ? row.version : 'No version found');
    }
    
    console.log('\n=== PRODUCT COUNT ===');
    db.get('SELECT COUNT(*) as count FROM products', (err3, prow) => {
      if (err3) {
        console.log('Product count error:', err3.message);
      } else {
        console.log('Product count:', prow.count);
      }
      db.close();
    });
  });
});
