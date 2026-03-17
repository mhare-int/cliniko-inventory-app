#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dbPath = args[0] || path.join(__dirname, '..', 'backend', 'appdata.db');

console.log('DB Inspect Script');
console.log('DB Path:', dbPath);
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(2);
}

const { getCurrentVersion, CURRENT_DB_VERSION } = require(path.join(__dirname, '..', 'backend', 'migrations'));

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, async (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }

  try {
    const diskVersion = await getCurrentVersion(db);
    console.log('\nSchema version (schema_version.latest):', diskVersion);
    console.log('App CURRENT_DB_VERSION:', CURRENT_DB_VERSION);

    // purchase_requests pragma
    db.all("PRAGMA table_info(purchase_requests)", (err, cols) => {
      if (err) {
        console.warn('purchase_requests table missing or error:', err.message);
      } else {
        console.log('\npurchase_requests columns:');
        cols.forEach(c => console.log(` - ${c.name} (${c.type})`));
      }

      // counts
      const tables = ['purchase_requests', 'purchase_request_items', 'products', 'suppliers', 'users', 'settings'];
      let idx = 0;
      const doCount = () => {
        if (idx >= tables.length) {
          // show settings values
          db.all("SELECT key, value FROM settings WHERE key IN ('GITHUB_TOKEN','CLINIKO_API_KEY')", (err, rows) => {
            if (err) console.warn('Could not query settings table:', err.message);
            else {
              console.log('\nSettings (GITHUB_TOKEN, CLINIKO_API_KEY):');
              if (!rows || rows.length === 0) console.log(' - none found');
              else rows.forEach(r => console.log(` - ${r.key}: ${r.value ? '[REDACTED]' : '[EMPTY]'}`));
            }

            // sample rows from purchase_requests
            db.all('SELECT pr_id, emails_sent, supplier_files_created, oft_files_created, total_cost FROM purchase_requests LIMIT 10', (err, rows) => {
              if (err) console.warn('Could not read sample purchase_requests:', err.message);
              else {
                console.log('\nSample purchase_requests rows (up to 10):');
                if (!rows || rows.length === 0) console.log(' - none');
                else rows.forEach(r => console.log(` - ${r.pr_id} emails_sent=${r.emails_sent} supplier_files=${r.supplier_files_created} oft_files=${r.oft_files_created} total_cost=${r.total_cost}`));
              }

              db.close();
            });
          });
          return;
        }

        const t = tables[idx++];
        db.get(`SELECT COUNT(*) as c FROM ${t}`, (err, row) => {
          if (err) console.log(` - ${t}: (missing or error)`);
          else console.log(` - ${t}: ${row.c}`);
          doCount();
        });
      };

      doCount();
    });

  } catch (e) {
    console.error('Error while inspecting DB:', e && e.message ? e.message : e);
    db.close();
  }
});
