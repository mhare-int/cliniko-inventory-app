const https = require('https');

function getRelease(owner, repo, tag, token) {
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: {
      'User-Agent': 'list-assets-script',
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

async function main() {
  const token = process.env.GH_TOKEN;
  if (!token) { console.error('GH_TOKEN required'); process.exit(2); }
  const [owner, repo, tag] = process.argv.slice(2);
  if (!owner || !repo || !tag) { console.error('Usage: node list_release_assets.js owner repo tag'); process.exit(3); }
  try {
    const rel = await getRelease(owner, repo, tag, token);
    console.log('Release:', rel.html_url);
    if (!rel.assets || rel.assets.length === 0) { console.log('No assets'); return; }
    for (const a of rel.assets) {
      console.log(`${a.id}\t${a.name}\t${a.size} bytes\t${a.browser_download_url}`);
    }
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(4);
  }
}

main();
