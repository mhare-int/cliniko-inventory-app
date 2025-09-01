const https = require('https');

function getRelease(owner, repo, tag, token) {
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: {
      'User-Agent': 'delete-asset-script',
      'Authorization': `token ${token}`
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function deleteAsset(owner, repo, assetId, token) {
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/assets/${assetId}`,
    method: 'DELETE',
    headers: {
      'User-Agent': 'delete-asset-script',
      'Authorization': `token ${token}`
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', d => body += d);
        res.on('end', () => reject(new Error(`Delete failed: ${res.statusCode}: ${body}`)));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const token = process.env.GH_TOKEN;
  if (!token) { console.error('GH_TOKEN env var required'); process.exit(2); }
  const [owner, repo, tag, name] = process.argv.slice(2);
  if (!owner || !repo || !tag || !name) {
    console.error('Usage: node delete_release_asset_by_name.js owner repo tag assetName');
    process.exit(3);
  }
  try {
    const rel = await getRelease(owner, repo, tag, token);
    if (!rel.assets || rel.assets.length === 0) { console.log('No assets on release'); return; }
    const toDelete = rel.assets.filter(a => a.name === name);
    if (toDelete.length === 0) { console.log(`No asset named '${name}' found`); return; }
    for (const a of toDelete) {
      console.log(`Deleting asset: ${a.id}\t${a.name}`);
      await deleteAsset(owner, repo, a.id, token);
      console.log(`Deleted ${a.name} (id=${a.id})`);
    }
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(4);
  }
}

main();
