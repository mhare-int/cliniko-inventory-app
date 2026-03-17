const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./backend/appdata.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('📋 All tables in database:');
});

db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
  if (err) {
    console.error('Error querying tables:', err.message);
  } else {
    rows.forEach(row => {
      console.log('  -', row.name);
    });
  }
  db.close();
});
