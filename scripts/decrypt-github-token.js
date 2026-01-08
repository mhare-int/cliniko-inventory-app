#!/usr/bin/env node

/**
 * Decrypt GitHub token stored by the app (AES-256-CBC + scrypt key derivation)
 *
 * Usage:
 *  - From JSON payload:
 *      node decrypt-github-token.js --json '{"encrypted":"<hex>","iv":"<hex>"}' [--secret YOUR_SECRET]
 *  - From a database file:
 *      node decrypt-github-token.js --db "/path/to/appdata.db" [--secret YOUR_SECRET]
 *
 * Notes:
 *  - If --secret is not provided, ENCRYPTION_SECRET env var is used.
 *  - If neither is set, defaults to 'default-app-secret-key' (same as app).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--secret') args.secret = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Decrypt GitHub token stored by the app\n\n` +
`From JSON:\n  node decrypt-github-token.js --json '{"encrypted":"<hex>","iv":"<hex>"}' [--secret YOUR_SECRET]\n\n` +
`From DB file:\n  node decrypt-github-token.js --db "/path/to/appdata.db" [--secret YOUR_SECRET]\n\n` +
`Env fallback:\n  ENCRYPTION_SECRET is used if --secret is omitted. Defaults to 'default-app-secret-key'.`);
}

function decryptToken(data, secret) {
  if (!data || typeof data !== 'object' || !data.encrypted || !data.iv) {
    throw new Error('Invalid encrypted payload. Expecting { encrypted: <hex>, iv: <hex> }');
  }
  const key = crypto.scryptSync(secret || 'default-app-secret-key', 'salt', 32);
  const iv = Buffer.from(data.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let out = decipher.update(data.encrypted, 'hex', 'utf8');
  out += decipher.final('utf8');
  return out;
}

async function readFromDb(dbPath) {
  const sqlite3 = require('sqlite3').verbose();
  await new Promise((resolve, reject) => fs.access(dbPath, fs.constants.R_OK, err => err ? reject(new Error(`Cannot read DB at ${dbPath}`)) : resolve()));
  const db = new sqlite3.Database(dbPath);
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['GITHUB_TOKEN'], (err, row) => {
      if (err) return reject(err);
      if (!row || !row.value) return reject(new Error('No GITHUB_TOKEN found in settings table'));
      try {
        // Try JSON first (encrypted), else legacy plaintext
        let parsed;
        try { parsed = JSON.parse(row.value); } catch { /* ignore */ }
        if (parsed && parsed.encrypted && parsed.iv) {
          resolve(parsed);
        } else {
          // Legacy plaintext token
          resolve({ plaintext: row.value });
        }
      } catch (e) {
        reject(e);
      }
    });
  }).finally(() => db.close());
}

(async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.json && !args.db)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const secret = args.secret || process.env.ENCRYPTION_SECRET || 'default-app-secret-key';

  try {
    if (args.json) {
      const payload = JSON.parse(args.json);
      const token = decryptToken(payload, secret);
      console.log(token);
      return;
    }

    if (args.db) {
      const payload = await readFromDb(path.resolve(args.db));
      if (payload.plaintext) {
        console.warn('Warning: token in DB is plaintext (legacy).');
        console.log(payload.plaintext);
        return;
      }
      const token = decryptToken(payload, secret);
      console.log(token);
      return;
    }
  } catch (err) {
    console.error('Decryption failed:', err.message || err);
    process.exit(1);
  }
})();
