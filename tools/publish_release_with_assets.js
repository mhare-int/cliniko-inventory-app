const fs = require('fs');
const path = require('path');
const https = require('https');

if (!process.env.GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const owner = 'mhare-int';
const repo = 'cliniko-inventory-app';
const tag = 'v3.0.2';
const releaseName = 'v3.0.2';
const body = fs.readFileSync(path.resolve(__dirname, '..', 'RELEASE_NOTES.md'), 'utf8');
const dist = path.resolve(__dirname, '..', 'dist');

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    opts.method = method;
    opts.headers = headers || {};
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({status: res.statusCode, body: JSON.parse(text)}); }
        catch (e) { resolve({status: res.statusCode, body: text}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const apiBase = 'https://api.github.com';
  const headers = { 'User-Agent': 'cli-publish', Authorization: `token ${token}`, 'Content-Type': 'application/json' };

  // Check existing releases by tag
  let release;
  console.log('Checking for existing release...');
  let resp = await request('GET', `${apiBase}/repos/${owner}/${repo}/releases/tags/${tag}`, headers);
  if (resp.status === 200) {
    release = resp.body;
    console.log('Found existing release id=', release.id);
  } else {
    console.log('Creating release...');
    const payload = JSON.stringify({ tag_name: tag, name: releaseName, body, draft: false, prerelease: false });
    resp = await request('POST', `${apiBase}/repos/${owner}/${repo}/releases`, headers, payload);
    if (resp.status >= 200 && resp.status < 300) {
      release = resp.body;
      console.log('Created release id=', release.id);
    } else {
      console.error('Failed to create release', resp.status, resp.body);
      process.exit(2);
    }
  }

  // Upload assets
  const assets = fs.readdirSync(dist).filter(f => f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'latest.yml');
  for (const name of assets) {
    const full = path.join(dist, name);
    const stat = fs.statSync(full);
    // Check if asset already exists
    const exists = (release.assets || []).find(a => a.name === name);
    if (exists) {
      console.log('Asset already exists on release, skipping:', name);
      continue;
    }
    console.log('Uploading asset:', name);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
    const uploadHeaders = { 'User-Agent': 'cli-publish', Authorization: `token ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size };
    await new Promise((resolve, reject) => {
      const opts = new URL(uploadUrl);
      opts.method = 'POST';
      opts.headers = uploadHeaders;
      const req = https.request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Uploaded', name);
            resolve();
          } else {
            console.error('Upload failed', res.statusCode, text);
            reject(new Error('upload failed'));
          }
        });
      });
      req.on('error', reject);
      const rs = fs.createReadStream(full);
      rs.pipe(req);
    });
  }
  console.log('Release assets upload complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
