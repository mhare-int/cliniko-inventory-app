#!/usr/bin/env node
// Diagnostic tool: check vendor_files DB rows for a given file path or filename and test disk existence.
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/check_vendor_file.js "<absolute-or-relative-path-or-filename>"');
    process.exit(2);
  }

  const target = String(arg).trim();
  const dbPath = path.join(__dirname, '..', 'backend', 'appdata.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found at', dbPath);
    process.exit(3);
  }

  const db = new sqlite3.Database(dbPath);

  const basename = path.basename(target);
  const normTarget = path.normalize(target);

  const query = `SELECT id, pr_id, vendor_name, file_type, filename, file_path, file_size, created_at FROM vendor_files
    WHERE file_path = ? OR filename = ? OR filename = ? OR file_path LIKE ? OR filename LIKE ? ORDER BY created_at DESC`;
  const likePattern = '%' + basename.replace(/%/g, '') + '%';

  db.all(query, [normTarget, target, basename, likePattern, likePattern], (err, rows) => {
    if (err) {
      console.error('DB query failed:', err && err.message);
      process.exit(4);
    }
    if (!rows || rows.length === 0) {
      console.log('No vendor_files rows match the target.');
      process.exit(0);
    }

    console.log(`Found ${rows.length} matching vendor_files rows:`);
    rows.forEach((r, i) => {
      console.log('\n--- Row ' + (i+1) + ' ---');
      console.log('id:', r.id);
      console.log('pr_id:', r.pr_id);
      console.log('vendor_name:', r.vendor_name);
      console.log('file_type:', r.file_type);
      console.log('filename:', r.filename);
      console.log('file_path (db):', r.file_path);
      console.log('created_at:', r.created_at);

      // Build candidate paths to check
      const candidates = [];
      if (r.file_path) candidates.push(r.file_path);
      if (r.file_path && !path.isAbsolute(r.file_path)) candidates.push(path.join(process.cwd(), r.file_path));
      if (r.file_path) candidates.push(path.normalize(r.file_path));
      if (r.filename) candidates.push(r.filename);
      if (r.filename && process.cwd()) candidates.push(path.join(process.cwd(), r.filename));
      // Also check common output folder (Downloads) and backend test-output
      const downloads = path.join(process.env.USERPROFILE || process.cwd(), 'Downloads');
      if (r.filename) candidates.push(path.join(downloads, r.filename));
      candidates.push(path.join(__dirname, '..', 'backend', 'test-output', r.filename || ''));

      // Deduplicate
      const uniq = Array.from(new Set(candidates.map(p => p ? path.normalize(p) : p).filter(Boolean)));

      let exists = false;
      for (const c of uniq) {
        const e = fs.existsSync(c);
        console.log('  check:', c, '=>', e ? 'FOUND' : 'missing');
        if (e) exists = true;
      }

      if (!exists) {
        console.log('  => File exists in DB but not on disk (no candidate path was found).');
        console.log('  Suggestion: either regenerate the file for pr', r.pr_id, 'or remove/update this vendor_files DB row.');
      } else {
        console.log('  => At least one candidate path exists on disk.');
      }
    });

    db.close();
  });
}

main().catch(e => { console.error('Error:', e && e.message); process.exit(5); });
