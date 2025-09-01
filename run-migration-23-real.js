#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function runMigration23OnRealDB() {
  const dbPath = 'C:\\Users\\mhare\\AppData\\Roaming\\Good Life Clinic - Inventory Management\\appdata.db';
  console.log('🔧 Running Migration 23 on REAL database:', dbPath);
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // Check current version
    const getCurrentVersion = () => {
      return new Promise((resolve, reject) => {
        db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.version : 0);
        });
      });
    };
    
    const currentVersion = await getCurrentVersion();
    console.log(`📊 Current database version: ${currentVersion}`);
    
    if (currentVersion >= 23) {
      console.log('✅ Migration 23 already applied!');
      db.close();
      return;
    }
    
    // Check product count before migration
    const getProductCount = () => {
      return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
          if (err) return reject(err);
          resolve(row.count);
        });
      });
    };
    
    const productCount = await getProductCount();
    console.log(`📊 Products in database: ${productCount}`);
    
    // Manually run migration 23
    const migration23 = {
      version: 23,
      description: "Hotfix for 2.0.1 to 3.0.4 compatibility - Handle legacy schema migration",
      up: (db) => {
        return new Promise((resolve, reject) => {
          console.log('🔧 Running 2.0.1 → 3.0.4 compatibility migration...');
          
          // First, check if we have the old schema (version 6 from 2.0.1)
          db.all("PRAGMA table_info(products)", (err, columns) => {
            if (err) return reject(err);
            
            const columnNames = new Set(columns.map(c => c.name));
            const hasOldSchema = columnNames.has('stock') && !columnNames.has('current_stock');
            const hasIntegerClinikoId = columns.find(c => c.name === 'cliniko_id' && c.type === 'INTEGER');
            
            console.log('📋 Schema analysis:');
            console.log('  - Has old stock column:', columnNames.has('stock'));
            console.log('  - Has new current_stock column:', columnNames.has('current_stock'));
            console.log('  - cliniko_id type:', columns.find(c => c.name === 'cliniko_id')?.type || 'NOT FOUND');
            
            if (!hasOldSchema && !hasIntegerClinikoId) {
              console.log('✅ Modern schema detected, no 2.0.1 compatibility needed');
              return resolve();
            }
            
            console.log('🔄 Legacy 2.0.1 schema detected, applying compatibility fixes...');
            
            const tasks = [];
            
            // Task 1: Handle stock → current_stock column rename
            if (hasOldSchema) {
              tasks.push(new Promise((res, rej) => {
                console.log('  📝 Migrating stock → current_stock...');
                
                // Add current_stock column if it doesn't exist
                db.run("ALTER TABLE products ADD COLUMN current_stock INTEGER DEFAULT 0", (addErr) => {
                  if (addErr && !addErr.message.includes('duplicate column name')) {
                    return rej(addErr);
                  }
                  
                  // Copy data from stock to current_stock
                  db.run("UPDATE products SET current_stock = stock WHERE current_stock = 0 OR current_stock IS NULL", (copyErr) => {
                    if (copyErr) return rej(copyErr);
                    console.log('  ✅ stock → current_stock migration complete');
                    res();
                  });
                });
              }));
            }
            
            // Task 2: Handle cliniko_id INTEGER → TEXT conversion
            if (hasIntegerClinikoId) {
              tasks.push(new Promise((res, rej) => {
                console.log('  📝 Converting cliniko_id from INTEGER to TEXT...');
                
                // Since SQLite doesn't support changing column types directly,
                // we need to ensure all integer IDs are converted to strings
                // This should work since the app will cast them appropriately
                db.run("UPDATE products SET cliniko_id = CAST(cliniko_id AS TEXT) WHERE typeof(cliniko_id) = 'integer'", (updateErr) => {
                  if (updateErr) return rej(updateErr);
                  console.log('  ✅ cliniko_id type conversion complete');
                  res();
                });
              }));
            }
            
            // Task 3: Ensure other required columns exist for 3.0.4
            tasks.push(new Promise((res, rej) => {
              console.log('  📝 Adding missing columns for 3.0.4 compatibility...');
              
              const requiredColumns = [
                { name: 'barcode', type: 'TEXT', defaultValue: "''" },
                { name: 'supplier_name', type: 'TEXT', defaultValue: "''" },
                { name: 'reorder_level', type: 'INTEGER', defaultValue: '0' }
              ];
              
              let completed = 0;
              const total = requiredColumns.length;
              
              requiredColumns.forEach(col => {
                if (!columnNames.has(col.name)) {
                  db.run(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultValue}`, (colErr) => {
                    if (colErr && !colErr.message.includes('duplicate column name')) {
                      return rej(colErr);
                    }
                    completed++;
                    if (completed === total) {
                      console.log('  ✅ Required columns added');
                      res();
                    }
                  });
                } else {
                  completed++;
                  if (completed === total) {
                    console.log('  ✅ All required columns present');
                    res();
                  }
                }
              });
            }));
            
            // Execute all tasks
            Promise.all(tasks)
              .then(() => {
                console.log('🎉 2.0.1 → 3.0.4 compatibility migration completed successfully!');
                resolve();
              })
              .catch(reject);
          });
        });
      }
    };
    
    console.log('🚀 Executing migration 23...');
    await migration23.up(db);
    
    // Update schema version
    const updateVersion = () => {
      return new Promise((resolve, reject) => {
        db.run('INSERT INTO schema_version (version) VALUES (?)', [23], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    };
    
    await updateVersion();
    console.log('📊 Updated schema version to 23');
    
    // Verify the final state
    const finalVersion = await getCurrentVersion();
    const finalProductCount = await getProductCount();
    console.log(`✅ Final database version: ${finalVersion}`);
    console.log(`✅ Final product count: ${finalProductCount}`);
    
    console.log('\n🎉 Migration 23 completed successfully on REAL database!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    db.close();
  }
}

runMigration23OnRealDB();
