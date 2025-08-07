// Test script to connect to Cliniko API and print the raw response
const https = require('https');
const fs = require('fs');

// Read API key from settings table in SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'appdata.db');
const db = new sqlite3.Database(dbPath);

db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
  if (err || !row || !row.value) {
    console.error('No Cliniko API key set in DB');
    process.exit(1);
  }
  const apiKey = row.value.trim();
  // Cliniko expects Basic auth with the API key as the username and a blank password
  const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
  console.log('API Key from DB:', apiKey);
  console.log('Authorization header:', authHeader);
  const options = {
    hostname: 'api.au1.cliniko.com',
    path: '/v1/products',
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'User-Agent': 'MyAPP (mitch.hare34@gmail.com)'
    }
  };
  let data = '';
  const req = https.request(options, (res) => {
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', res.headers);
      try {
        const json = JSON.parse(data);
        console.log('Parsed JSON:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.error('Failed to parse JSON. Raw response:');
        fs.writeFileSync(path.join(__dirname, 'cliniko_raw_response.txt'), data, { encoding: 'utf8' });
        console.error(data);
      }
      process.exit(0);
    });
  });
  req.on('error', (e) => {
    console.error('Request error:', e);
    process.exit(1);
  });
  req.end();
});
