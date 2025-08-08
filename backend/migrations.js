/**
 * Database Migration System
 * Handles database schema updates between app versions
 */

const fs = require('fs');
const path = require('path');

// Current database version
const CURRENT_DB_VERSION = 6;

// Migration scripts - add new ones as you update the app
const migrations = [
  {
    version: 1,
    description: "Initial database setup",
    up: (db) => {
      return new Promise((resolve, reject) => {
        // Initial tables already created in db.js
        resolve();
      });
    }
  },
  {
    version: 2,
    description: "Add updated_at column to settings table",
    up: (db) => {
      return new Promise((resolve, reject) => {
        // Check if the column already exists
        db.all("PRAGMA table_info(settings)", (err, columns) => {
          if (err) return reject(err);
          
          const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
          if (hasUpdatedAt) {
            console.log('updated_at column already exists in settings table');
            return resolve();
          }
          
          // Add the updated_at column
          db.run('ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP', (err) => {
            if (err) return reject(err);
            
            // Update existing rows to have a timestamp
            db.run('UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL', (err) => {
              if (err) return reject(err);
              console.log('Added updated_at column to settings table');
              resolve();
            });
          });
        });
      });
    }
  },
  {
    version: 3,
    description: "Ensure products table has correct stock column and supplier_name",
    up: (db) => {
      return new Promise((resolve, reject) => {
        // Check current products table schema
        db.all("PRAGMA table_info(products)", (err, columns) => {
          if (err) return reject(err);
          
          const hasStock = columns.some(col => col.name === 'stock');
          const hasSupplierName = columns.some(col => col.name === 'supplier_name');
          const hasCurrentStock = columns.some(col => col.name === 'current_stock');
          
          let promises = [];
          
          // Add stock column if it doesn't exist (but current_stock does)
          if (!hasStock && hasCurrentStock) {
            promises.push(new Promise((res, rej) => {
              db.run('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0', (err) => {
                if (err) return rej(err);
                // Copy current_stock to stock
                db.run('UPDATE products SET stock = current_stock', (err) => {
                  if (err) return rej(err);
                  console.log('Added stock column and copied from current_stock');
                  res();
                });
              });
            }));
          } else if (!hasStock) {
            promises.push(new Promise((res, rej) => {
              db.run('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0', (err) => {
                if (err) return rej(err);
                console.log('Added stock column');
                res();
              });
            }));
          }
          
          // Add supplier_name column if it doesn't exist
          if (!hasSupplierName) {
            promises.push(new Promise((res, rej) => {
              db.run('ALTER TABLE products ADD COLUMN supplier_name TEXT', (err) => {
                if (err) return rej(err);
                console.log('Added supplier_name column');
                res();
              });
            }));
          }
          
          if (promises.length === 0) {
            console.log('Products table schema already up to date');
            return resolve();
          }
          
          Promise.all(promises).then(() => resolve()).catch(reject);
        });
      });
    }
  },
  {
    version: 4,
    description: "Add missing receipt_log and product_change_log tables",
    up: (db) => {
      return new Promise((resolve, reject) => {
        const promises = [];
        
        // Create receipt_log table if it doesn't exist
        promises.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS receipt_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pr_id TEXT,
            timestamp TEXT,
            items_json TEXT,
            all_received INTEGER
          )`, (err) => {
            if (err) return rej(err);
            console.log('Created receipt_log table');
            res();
          });
        }));
        
        // Create product_change_log table if it doesn't exist
        promises.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS product_change_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            field_changed TEXT NOT NULL,
            before_value TEXT,
            after_value TEXT,
            timestamp TEXT NOT NULL
          )`, (err) => {
            if (err) return rej(err);
            console.log('Created product_change_log table');
            res();
          });
        }));
        
        Promise.all(promises).then(() => resolve()).catch(reject);
      });
    }
  },
  {
    version: 5,
    description: "Add user behavior tracking tables",
    up: (db) => {
      return new Promise((resolve, reject) => {
        const promises = [];
        
        // Create user_behavior_log table if it doesn't exist
        promises.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS user_behavior_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_id TEXT,
            action_type TEXT,
            feature_accessed TEXT,
            page_url TEXT,
            timestamp TEXT,
            duration_ms INTEGER,
            metadata_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`, (err) => {
            if (err) return rej(err);
            console.log('Created user_behavior_log table');
            res();
          });
        }));
        
        // Create user_sessions table if it doesn't exist
        promises.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_id TEXT UNIQUE,
            start_time TEXT,
            end_time TEXT,
            total_duration_ms INTEGER,
            page_views INTEGER,
            actions_count INTEGER,
            last_activity TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`, (err) => {
            if (err) return rej(err);
            console.log('Created user_sessions table');
            res();
          });
        }));
        
        // Create user_preferences table if it doesn't exist
        promises.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            preference_key TEXT,
            preference_value TEXT,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(user_id, preference_key),
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`, (err) => {
            if (err) return rej(err);
            console.log('Created user_preferences table');
            res();
          });
        }));
        
        Promise.all(promises).then(() => resolve()).catch(reject);
      });
    }
  },
  {
    version: 6,
    description: "Deduplicate products and enforce unique cliniko_id",
    up: (db) => {
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Delete duplicate rows keeping the lowest rowid for each non-null cliniko_id
          db.run(`DELETE FROM products
                  WHERE cliniko_id IS NOT NULL
                    AND rowid NOT IN (
                      SELECT MIN(rowid)
                      FROM products
                      WHERE cliniko_id IS NOT NULL
                      GROUP BY cliniko_id
                    )`, function (err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            // Add unique index on cliniko_id to prevent future duplicates
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_cliniko_id_unique ON products(cliniko_id)`, function (err2) {
              if (err2) {
                db.run('ROLLBACK');
                return reject(err2);
              }

              db.run('COMMIT', (err3) => {
                if (err3) return reject(err3);
                console.log('✅ Deduplicated products and added UNIQUE index on products.cliniko_id');
                resolve();
              });
            });
          });
        });
      });
    }
  }
  // Example future migration:
  // {
  //   version: 3,
  //   description: "Add new column to products table",
  //   up: (db) => {
  //     return new Promise((resolve, reject) => {
  //       db.run('ALTER TABLE products ADD COLUMN new_field TEXT DEFAULT NULL', (err) => {
  //         if (err) reject(err);
  //         else resolve();
  //       });
  //     });
  //   }
  // }
];

/**
 * Get current database version
 */
function getCurrentVersion(db) {
  return new Promise((resolve, reject) => {
    // Create version table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return reject(err);
      
      db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.version : 0);
      });
    });
  });
}

/**
 * Run migrations to bring database up to current version
 */
async function runMigrations(db) {
  try {
    const currentVersion = await getCurrentVersion(db);
    console.log(`Current database version: ${currentVersion}`);
    
    // Run all migrations newer than current version
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.description}`);
        
        try {
          await migration.up(db);
          
          // Record that migration was applied
          await new Promise((resolve, reject) => {
            db.run('INSERT INTO schema_version (version) VALUES (?)', [migration.version], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          console.log(`✅ Migration ${migration.version} completed`);
        } catch (err) {
          console.error(`❌ Migration ${migration.version} failed:`, err);
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Backup database before migrations
 */
function backupDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.backup.${timestamp}`;
    
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) {
        console.error('Failed to create database backup:', err);
        reject(err);
      } else {
        console.log(`✅ Database backed up to: ${backupPath}`);
        resolve(backupPath);
      }
    });
  });
}

module.exports = {
  runMigrations,
  getCurrentVersion,
  backupDatabase,
  CURRENT_DB_VERSION
};
