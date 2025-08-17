const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');

const required = {
  suppliers: ['id','name','email','contact_name','account_number','special_instructions','source','active','created_at','updated_at'],
  products: ['id','name','barcode','cliniko_id','reorder_level','stock','supplier_name','created_at'],
  purchase_requests: ['pr_id','date_created','date_received','received','supplier_files_created','oft_files_created','created_at','updated_at'],
  purchase_request_items: ['id','pr_id','product_id','product_name','supplier_name','supplier_id','no_to_order','quantity','received','received_so_far','created_at','updated_at'],
  product_sales: ['id','invoice_id','invoice_date','product_id','product_name','quantity'],
  vendor_files: ['id','pr_id','vendor_name','file_type','filename','file_path','file_size','created_at'],
  email_templates: ['id','name','subject','body','created_at','updated_at']
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

function getColumns(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

(async () => {
  try {
    console.log('Schema check for DB at', dbPath);
    for (const [table, cols] of Object.entries(required)) {
      const existing = await getColumns(table).catch(() => []);
      const missing = cols.filter(c => !existing.includes(c));
      if (existing.length === 0) {
        console.log(` - ${table}: MISSING TABLE`);
      } else if (missing.length) {
        console.log(` - ${table}: missing columns -> ${missing.join(', ')}`);
      } else {
        console.log(` - ${table}: OK`);
      }
    }
  } catch (e) {
    console.error('Schema check failed:', e.message);
  } finally {
    db.close();
  }
})();
