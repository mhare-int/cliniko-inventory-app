const fs = require('fs');
const path = require('path');
const child = require('child_process');
const sqlite3 = require('sqlite3').verbose();

(async function(){
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const src = path.join(repoRoot, 'backend', 'appdata.db');
    if (!fs.existsSync(src)) {
      console.error('Source DB not found at', src);
      process.exit(2);
    }

    const ts = new Date().toISOString().replace(/[:.]/g,'').replace(/T/,'_').split('Z')[0];
    const dst = path.join(path.dirname(src), `appdata.db.dryrun.${ts}.sqlite`);
    fs.copyFileSync(src, dst);
    console.log('Copied DB to:', dst);

    // Read pre-run schema_version
    const getVersions = (dbPath) => new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return reject(err);
        db.all("SELECT version, applied_at FROM schema_version ORDER BY version ASC", (err2, rows) => {
          if (err2) {
            // If table missing, return empty
            if (String(err2.message || '').toLowerCase().includes('no such table')) {
              db.close();
              return resolve([]);
            }
            db.close();
            return reject(err2);
          }
          db.close();
          resolve(rows || []);
        });
      });
    });

    const beforeRows = await getVersions(dst).catch(e => { console.warn('Could not read schema_version before run:', e && e.message); return []; });
    const beforeVersion = beforeRows.length ? Math.max(...beforeRows.map(r=>r.version)) : 0;

    // Run migrations on the copy using the existing helper script
    const runner = path.join(repoRoot, 'tools', 'run_migrations_on_copy.js');
    console.log('Running migrations on copy using:', runner);

    let stdout = '';
    let stderr = '';
    try {
      const execOptions = { encoding: 'utf8' };
      // Use spawnSync to capture output and avoid shell quoting issues
      const res = child.spawnSync(process.execPath, [runner, dst], execOptions);
      stdout = res.stdout || '';
      stderr = res.stderr || '';
      if (res.error) throw res.error;
      if (res.status !== 0) {
        console.warn('Runner exited with status', res.status);
      }
    } catch (e) {
      stderr += '\n' + (e && e.message ? e.message : String(e));
      console.error('Error running migrations helper:', e && e.message ? e.message : e);
    }

    const afterRows = await getVersions(dst).catch(e => { console.warn('Could not read schema_version after run:', e && e.message); return []; });
    const afterVersion = afterRows.length ? Math.max(...afterRows.map(r=>r.version)) : 0;

    // Determine which versions applied during the dry run
    const beforeSet = new Set(beforeRows.map(r=>Number(r.version)));
    const applied = afterRows.filter(r => !beforeSet.has(Number(r.version))).map(r => ({ version: Number(r.version), applied_at: r.applied_at }));

    const report = {
      timestamp: new Date().toISOString(),
      copyPath: dst,
      beforeVersion,
      afterVersion,
      applied,
      stdout: stdout.slice(0, 20000),
      stderr: stderr.slice(0, 20000)
    };

    // Default output directory: prefer Electron userData, then Desktop, else repo tools/reports
    const os = require('os');
    let outDir = null;
    // 1) explicit env or arg (support passing an output dir as first arg)
    if (process.argv[2] && fs.existsSync(process.argv[2])) outDir = process.argv[2];
    if (!outDir && process.env.DRY_RUN_REPORT_DIR && fs.existsSync(process.env.DRY_RUN_REPORT_DIR)) outDir = process.env.DRY_RUN_REPORT_DIR;
    // 2) Electron userData when available
    if (!outDir) {
      try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
          outDir = app.getPath('userData');
        }
      } catch (e) {
        // not running under Electron
      }
    }
    // 3) Desktop folder
    if (!outDir) {
      const desktop = path.join(os.homedir() || '.', 'Desktop');
      if (fs.existsSync(desktop)) outDir = desktop;
    }
    // 4) Fallback to repo-local tools/reports
    const reportsDir = path.join(repoRoot, 'tools', 'reports');
    if (!outDir) outDir = reportsDir;

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const reportPath = path.join(outDir, `dry_run_migrations_report.${ts}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Also keep a repo-local copy for convenience
    try {
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
      const repoReportPath = path.join(reportsDir, `dry_run_migrations_report.${ts}.json`);
      fs.writeFileSync(repoReportPath, JSON.stringify(report, null, 2), 'utf8');
      // Copy DB copy into both locations
      try { fs.copyFileSync(dst, path.join(outDir, path.basename(dst))); } catch (e) { /* ignore */ }
      try { fs.copyFileSync(dst, path.join(reportsDir, path.basename(dst))); } catch (e) { /* ignore */ }
    } catch (e) {
      // non-fatal
    }

    console.log('Dry-run report written to:', reportPath);
    console.log('Summary: beforeVersion=', beforeVersion, 'afterVersion=', afterVersion, 'appliedCount=', applied.length);
    if (applied.length > 0) console.log('Applied versions:', applied.map(a=>a.version).join(', '));
    process.exit(0);
  } catch (e) {
    console.error('Dry run failed:', e && e.message ? e.message : e);
    process.exit(3);
  }
})();
