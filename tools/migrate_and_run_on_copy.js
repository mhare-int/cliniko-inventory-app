const fs = require('fs');
const path = require('path');
const child = require('child_process');

(async function(){
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const src = path.join(repoRoot, 'backend', 'appdata.db');
    if (!fs.existsSync(src)) {
      console.error('Source DB not found at', src);
      process.exit(2);
    }
    const ts = new Date().toISOString().replace(/[:.]/g,'').replace(/T/,'_').split('Z')[0];
    const dst = path.join(path.dirname(src), `appdata.db.copy.${ts}.sqlite`);
    fs.copyFileSync(src, dst);
    console.log('Copied DB to:', dst);

    // Run migrations script against the copy
    const runner = path.join(repoRoot, 'tools', 'run_migrations_on_copy.js');
    console.log('Running migrations on copy using:', runner);
    const cmd = `node "${runner}" "${dst}"`;
    const out = child.execSync(cmd, { stdio: 'inherit' });
    console.log('Migration run completed');
    process.exit(0);
  } catch (e) {
    console.error('Error during copy or migration run:', e && e.message ? e.message : e);
    process.exit(3);
  }
})();
