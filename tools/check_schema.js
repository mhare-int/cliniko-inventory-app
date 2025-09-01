#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const repoRoot = path.resolve(__dirname, '..');
const backendDb = path.join(repoRoot, 'backend', 'appdata.db');

function findLatestBackup() {
	const backendDir = path.join(repoRoot, 'backend');
	if (!fs.existsSync(backendDir)) return null;
	const files = fs.readdirSync(backendDir)
		.filter(f => f.startsWith('appdata.db.backup-before-clean-'))
		.map(f => ({ f, t: fs.statSync(path.join(backendDir, f)).mtime.getTime() }))
		.sort((a,b) => b.t - a.t);
	return files.length > 0 ? path.join(backendDir, files[0].f) : null;
}

function openDb(dbPath) {
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(dbPath)) return reject(new Error('DB file not found: ' + dbPath));
		const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => err ? reject(err) : resolve(db));
	});
}

function listTablesAndColumns(dbPath) {
	return openDb(dbPath).then(db => {
		return new Promise((resolve, reject) => {
			db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, rows) => {
				if (err) { db.close(); return reject(err); }
				const tables = rows.map(r => r.name);
				const result = {};
				let i = 0;
				function next() {
					if (i >= tables.length) { db.close(); return resolve(result); }
					const t = tables[i++];
					db.all('PRAGMA table_info("' + t + '")', (e, cols) => {
						result[t] = (cols || []).map(c => c.name);
						next();
					});
				}
				next();
			});
		});
	});
}

function compareSchemas(expectedMap, actualMap) {
	const expectedTables = Object.keys(expectedMap).sort();
	const actualTables = Object.keys(actualMap).sort();

	const missingTables = expectedTables.filter(t => !actualTables.includes(t));
	const extraTables = actualTables.filter(t => !expectedTables.includes(t));

	const tableColumnDiffs = {};
	expectedTables.forEach(t => {
		if (!actualMap[t]) return;
		const expCols = expectedMap[t];
		const actCols = actualMap[t];
		const missingCols = expCols.filter(c => !actCols.includes(c));
		const extraCols = actCols.filter(c => !expCols.includes(c));
		if (missingCols.length || extraCols.length) tableColumnDiffs[t] = { missingCols, extraCols };
	});

	return { missingTables, extraTables, tableColumnDiffs };
}

async function run() {
	try {
		const expectedArg = process.argv[2];
		const actualArg = process.argv[3];
		const expectedDb = expectedArg || findLatestBackup();
		const actualDb = actualArg || backendDb;

		if (!expectedDb) {
			console.error('No expected DB provided and no backup found in backend/ to compare against.');
			process.exit(2);
		}

		console.log('Comparing expected DB:', expectedDb);
		console.log('Against actual DB:', actualDb);

		const [expectedMap, actualMap] = await Promise.all([
			listTablesAndColumns(expectedDb),
			listTablesAndColumns(actualDb)
		]);

		const result = compareSchemas(expectedMap, actualMap);

		console.log('\nSummary:');
		console.log('Expected tables:', Object.keys(expectedMap).length);
		console.log('Actual tables:  ', Object.keys(actualMap).length);
		console.log('Missing tables in actual DB:', result.missingTables.length ? result.missingTables.join(', ') : '(none)');
		console.log('Extra tables in actual DB:  ', result.extraTables.length ? result.extraTables.join(', ') : '(none)');

		if (Object.keys(result.tableColumnDiffs).length) {
			console.log('\nPer-table column differences:');
			Object.entries(result.tableColumnDiffs).forEach(([t, d]) => {
				console.log(`- ${t}`);
				if (d.missingCols.length) console.log('  missing columns:', d.missingCols.join(', '));
				if (d.extraCols.length) console.log('  extra columns:  ', d.extraCols.join(', '));
			});
		} else {
			console.log('\nNo per-table column differences detected.');
		}

		const problems = result.missingTables.length + result.extraTables.length + Object.keys(result.tableColumnDiffs).length;
		if (problems === 0) {
			console.log('\n✅ Schema match: actual DB matches expected schema.');
			process.exit(0);
		} else {
			console.log(`\n⚠️  Schema mismatches detected: ${problems} problem area(s).`);
			process.exit(3);
		}

	} catch (err) {
		console.error('Error running schema check:', err && err.message ? err.message : err);
		process.exit(4);
	}
}

run();

