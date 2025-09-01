// Comprehensive Database Schema Comparison: 2.0.1 vs 3.0.4
// This will identify ALL differences between the schemas

const sqlite3 = require('sqlite3').verbose();

const db201Path = "C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db";
const db304Path = "./backend/appdata.db";

console.log('🔍 Comprehensive Database Schema Comparison');
console.log('==========================================\n');

async function analyzeDatabase(dbPath, version) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const schema = {
        version: version,
        tables: {},
        dbVersion: null
      };

      // Get database version
      db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
        if (!err && row) {
          schema.dbVersion = row.version;
        }

        // Get all tables
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
          if (err) {
            reject(err);
            return;
          }

          let completed = 0;
          const totalTables = tables.length;

          if (totalTables === 0) {
            resolve(schema);
            return;
          }

          tables.forEach(table => {
            const tableName = table.name;
            
            // Get table structure
            db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
              if (err) {
                console.error(`❌ Error getting info for table ${tableName}:`, err.message);
              } else {
                schema.tables[tableName] = {
                  columns: columns.map(col => ({
                    name: col.name,
                    type: col.type,
                    notNull: col.notnull === 1,
                    primaryKey: col.pk === 1,
                    defaultValue: col.dflt_value
                  })),
                  rowCount: 0
                };

                // Get row count
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
                  if (!err && row) {
                    schema.tables[tableName].rowCount = row.count;
                  }
                  
                  completed++;
                  if (completed === totalTables) {
                    db.close();
                    resolve(schema);
                  }
                });
              }
            });
          });
        });
      });
    });
  });
}

async function compareSchemas() {
  try {
    console.log('📊 Analyzing 2.0.1 Database...');
    const schema201 = await analyzeDatabase(db201Path, '2.0.1');
    
    console.log('📊 Analyzing 3.0.4 Database...');
    const schema304 = await analyzeDatabase(db304Path, '3.0.4');

    console.log('\n🔍 COMPARISON RESULTS');
    console.log('=====================\n');

    console.log(`📋 Database Versions:`);
    console.log(`  - 2.0.1: ${schema201.dbVersion || 'Unknown'}`);
    console.log(`  - 3.0.4: ${schema304.dbVersion || 'Unknown'}\n`);

    // Find tables only in 2.0.1
    const tables201Only = Object.keys(schema201.tables).filter(name => !schema304.tables[name]);
    if (tables201Only.length > 0) {
      console.log('📋 Tables ONLY in 2.0.1:');
      tables201Only.forEach(table => {
        console.log(`  - ${table} (${schema201.tables[table].rowCount} rows)`);
      });
      console.log('');
    }

    // Find tables only in 3.0.4
    const tables304Only = Object.keys(schema304.tables).filter(name => !schema201.tables[name]);
    if (tables304Only.length > 0) {
      console.log('📋 Tables ONLY in 3.0.4:');
      tables304Only.forEach(table => {
        console.log(`  - ${table} (${schema304.tables[table].rowCount} rows)`);
      });
      console.log('');
    }

    // Find tables in both with schema differences
    const commonTables = Object.keys(schema201.tables).filter(name => schema304.tables[name]);
    console.log('🔍 Common Tables with Schema Differences:');
    console.log('========================================\n');

    commonTables.forEach(tableName => {
      const table201 = schema201.tables[tableName];
      const table304 = schema304.tables[tableName];
      
      const columns201 = table201.columns.map(c => c.name);
      const columns304 = table304.columns.map(c => c.name);
      
      const columns201Only = columns201.filter(name => !columns304.includes(name));
      const columns304Only = columns304.filter(name => !columns201.includes(name));
      
      // Check for type differences in common columns
      const commonColumns = columns201.filter(name => columns304.includes(name));
      const typeDifferences = [];
      
      commonColumns.forEach(colName => {
        const col201 = table201.columns.find(c => c.name === colName);
        const col304 = table304.columns.find(c => c.name === colName);
        
        if (col201.type !== col304.type || col201.primaryKey !== col304.primaryKey) {
          typeDifferences.push({
            name: colName,
            type201: col201.type,
            type304: col304.type,
            pk201: col201.primaryKey,
            pk304: col304.primaryKey
          });
        }
      });

      if (columns201Only.length > 0 || columns304Only.length > 0 || typeDifferences.length > 0) {
        console.log(`📋 Table: ${tableName}`);
        console.log(`   Rows: 2.0.1=${table201.rowCount}, 3.0.4=${table304.rowCount}`);
        
        if (columns201Only.length > 0) {
          console.log(`   Columns ONLY in 2.0.1: ${columns201Only.join(', ')}`);
        }
        
        if (columns304Only.length > 0) {
          console.log(`   Columns ONLY in 3.0.4: ${columns304Only.join(', ')}`);
        }
        
        if (typeDifferences.length > 0) {
          console.log(`   Type Differences:`);
          typeDifferences.forEach(diff => {
            console.log(`     - ${diff.name}: ${diff.type201} → ${diff.type304}${diff.pk201 !== diff.pk304 ? ' (PK changed)' : ''}`);
          });
        }
        console.log('');
      }
    });

    console.log('✅ Schema comparison complete!');

  } catch (error) {
    console.error('❌ Error during comparison:', error.message);
  }
}

compareSchemas();
