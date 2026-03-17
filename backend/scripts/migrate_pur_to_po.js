const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'appdata.db');

function run() {
  (async () => {
    try {
      if (!fs.existsSync(dbPath)) {
        console.error('Database file not found at', dbPath);
        process.exit(1);
      }

      const backupPath = dbPath + `.backup.migrate_pur_to_po.${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.copyFileSync(dbPath, backupPath);
      console.log('Created DB backup at', backupPath);

      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          console.error('Failed to open DB:', err);
          process.exit(1);
        }
      });

      const all = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows)));
      const get = (sql, params=[]) => new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row)));
      const runSql = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(e) { if (e) rej(e); else res(this); }));

      const purRows = await all("SELECT pr_id FROM purchase_requests WHERE pr_id LIKE 'PUR%'");
      if (!purRows || purRows.length === 0) {
        console.log('No PUR... ids found in purchase_requests. Nothing to do.');
        db.close();
        process.exit(0);
      }

      // Build rename map and check conflicts
      const conflicts = [];
      const renames = [];
      for (const r of purRows) {
        const oldId = r.pr_id;
        const newId = 'PO' + oldId.slice(3);
        const existing = await get('SELECT COUNT(*) as c FROM purchase_requests WHERE pr_id = ?', [newId]);
        if (existing && existing.c > 0) {
          conflicts.push({ oldId, newId });
        } else {
          renames.push({ oldId, newId });
        }
      }

      if (conflicts.length > 0) {
        console.error('Conflicts detected: the following new PO ids already exist. Aborting migration.');
        console.error(conflicts);
        console.error('You can inspect the backup at', backupPath);
        db.close();
        process.exit(2);
      }

      if (renames.length === 0) {
        console.log('No renames required after conflict check.');
        db.close();
        process.exit(0);
      }

      console.log(`About to rename ${renames.length} PR ids (PUR->PO). Running inside a transaction...`);

      await runSql('BEGIN TRANSACTION');
      try {
        // Update purchase_requests one by one to preserve any references in triggers
        for (const item of renames) {
          await runSql('UPDATE purchase_requests SET pr_id = ? WHERE pr_id = ?', [item.newId, item.oldId]);
        }

        // Update referencing tables with REPLACE shortcut
        await runSql("UPDATE purchase_request_items SET pr_id = REPLACE(pr_id, 'PUR', 'PO') WHERE pr_id LIKE 'PUR%'");
        await runSql("UPDATE vendor_files SET pr_id = REPLACE(pr_id, 'PUR', 'PO') WHERE pr_id LIKE 'PUR%'");

        await runSql('COMMIT');
        console.log('Migration complete. Renamed', renames.length, 'ids.');
      } catch (e) {
        console.error('Error during migration, rolling back:', e.message || e);
        try { await runSql('ROLLBACK'); } catch (rErr) { console.error('Rollback failed:', rErr); }
        console.error('DB left in original state; backup at', backupPath);
        db.close();
        process.exit(3);
      }

      // Optional verification
      const remaining = await all("SELECT pr_id FROM purchase_requests WHERE pr_id LIKE 'PUR%'");
      if (remaining.length === 0) {
        console.log('Verification: no PUR... ids remain in purchase_requests.');
      } else {
        console.warn('Verification: some PUR... ids remain (unexpected):', remaining.map(r=>r.pr_id));
      }

      db.close();
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err && err.message ? err.message : err);
      process.exit(4);
    }
  })();
}

run();
