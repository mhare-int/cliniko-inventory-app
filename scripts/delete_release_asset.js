const https = require('https');

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
      if (res.statusCode === 204) return resolve();
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => reject(new Error(`Status ${res.statusCode}: ${body}`)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const token = process.env.GH_TOKEN;
  if (!token) { console.error('GH_TOKEN required'); process.exit(2); }
  const [owner, repo, assetId] = process.argv.slice(2);
  if (!owner || !repo || !assetId) { console.error('Usage: node delete_release_asset.js owner repo assetId'); process.exit(3); }
  try {
    await deleteAsset(owner, repo, assetId, token);
    console.log('Deleted asset', assetId);
  } catch (e) {
    console.error('Error deleting asset:', e.message || e);
    process.exit(4);
  }
}

main();
