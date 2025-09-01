const https = require('https');
const fs = require('fs');
const path = require('path');

function getRelease(owner, repo, tag, token) {
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: {
      'User-Agent': 'upload-script',
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

function createRelease(owner, repo, tag, token) {
  const data = JSON.stringify({ tag_name: tag, name: tag, body: `Release ${tag} created by upload script`, draft: false, prerelease: false });
  const opts = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'upload-script',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
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
          reject(new Error(`Create release failed: ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath, token) {
  const name = path.basename(filePath);
  const url = `${uploadUrl}?name=${encodeURIComponent(name)}`;
  const {hostname, pathname, protocol} = new URL(url);
  const stats = fs.statSync(filePath);
  const opts = {
    hostname,
    path: pathname + `?name=${encodeURIComponent(name)}`,
    method: 'POST',
    headers: {
      'User-Agent': 'upload-script',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size
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
          reject(new Error(`Upload failed: ${res.statusCode} ${body}`));
        }
      });
    });
    req.on('error', reject);
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.pipe(req);
  });
}

async function main() {
  const token = process.env.GH_TOKEN;
  if (!token) {
    console.error('GH_TOKEN env var required');
    process.exit(2);
  }
  const [owner, repo, tag, ...files] = process.argv.slice(2);
  if (!owner || !repo || !tag || files.length === 0) {
    console.error('Usage: node upload_release_assets.js owner repo tag file1 [file2 ...]');
    process.exit(3);
  }
  try {
    let rel;
    try {
      rel = await getRelease(owner, repo, tag, token);
    } catch (err) {
      if (err && /Status 404/.test(err.message)) {
        console.log('Release not found; creating...');
        rel = await createRelease(owner, repo, tag, token);
      } else {
        throw err;
      }
    }
    const uploadUrl = rel.upload_url.replace(/\{\?name,label\}$/, '');
    console.log('Found release:', rel.html_url);
    for (const f of files) {
      if (!fs.existsSync(f)) { console.error('Missing file:', f); process.exit(4); }
      console.log('Uploading', f);
      const res = await uploadAsset(uploadUrl, f, token);
      console.log('Uploaded:', res.name, 'id='+res.id);
    }
    console.log('All uploads complete');
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(5);
  }
}

main();
