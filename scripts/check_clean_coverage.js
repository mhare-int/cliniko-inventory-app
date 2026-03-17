const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
console.log('DB:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('DB not found');
  process.exit(2);
}

const intendedToClear = [
  'products',
  'product_sales',
  'purchase_requests',
  'purchase_request_items',
  'invoices',
  'invoice_items',
  'suppliers',
  'users',
  'user_sessions',
  'user_behavior_log',
  'user_preferences',
  'receipt_log',
  'product_change_log',
  'item_receipt_log',
  // additional
  'email_templates',
  'vendor_oft_files',
  'po_change_log',
  'generated_files',
  'vendor_files'
];

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error('open err', err); process.exit(3); }
});

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
  if (err) { console.error('query err', err); db.close(); process.exit(4); }
  const tables = rows.map(r => r.name);
  console.log('\nTables in DB (count=' + tables.length + '):');
  console.log(tables.join(', '));

  const toClearSet = new Set(intendedToClear);
  const presentToClear = tables.filter(t => toClearSet.has(t));
  const presentNotCleared = tables.filter(t => !toClearSet.has(t));

  console.log('\nTables that WILL be cleared (present):');
  console.log(presentToClear.length ? presentToClear.join(', ') : '(none)');

  console.log('\nTables that are PRESENT BUT NOT in clean list (candidates):');
  console.log(presentNotCleared.length ? presentNotCleared.join(', ') : '(none)');

  // Suggestion for each candidate
  const suggestions = {
    settings: 'Usually contains system settings; script already selectively removes some keys. Decide if full clear required.',
    migrations: 'Migration tracking table; usually keep.',
    schema_version: 'Versioning used by migrations; keep.',
    po_change_log: 'Audit table — we added this to clear list already.'
  };

  const candidates = presentNotCleared;
  console.log('\nQuick suggestions:');
  candidates.forEach(c => {
    if (suggestions[c]) console.log(`- ${c}: ${suggestions[c]}`);
    else console.log(`- ${c}: review if it contains user or sensitive data`);
  });

  db.close();
});
