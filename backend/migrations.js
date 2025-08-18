/**
 * Database Migration System
 * Handles database schema updates between app versions
 */

const fs = require('fs');
const path = require('path');

// Current database version
const CURRENT_DB_VERSION = 16;

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
  ,
  {
    version: 14,
    description: "Ensure suppliers/pr tables have required columns; create vendor_files and email_templates; add product_sales unique index",
    up: (db) => {
      return new Promise((resolve, reject) => {
        const tasks = [];

        // 1) Suppliers columns: source, special_instructions, active, account_number
        tasks.push(new Promise((res, rej) => {
          db.all("PRAGMA table_info(suppliers)", (err, cols) => {
            if (err) return rej(err);
            const names = new Set(cols.map(c => c.name));
            const alters = [];
            if (!names.has('source')) alters.push(["ALTER TABLE suppliers ADD COLUMN source TEXT DEFAULT 'Manual'"]);
            if (!names.has('special_instructions')) alters.push(["ALTER TABLE suppliers ADD COLUMN special_instructions TEXT"]);
            if (!names.has('active')) alters.push(["ALTER TABLE suppliers ADD COLUMN active INTEGER DEFAULT 1"]);
            if (!names.has('account_number')) alters.push(["ALTER TABLE suppliers ADD COLUMN account_number TEXT"]);

            // Execute ALTERs sequentially to avoid locked DB
            const runNext = () => {
              const next = alters.shift();
              if (!next) {
                // Post-alter fixups
                // Initialize active if NULL
                db.run("UPDATE suppliers SET active = 1 WHERE active IS NULL", () => {
                  // If a legacy 'comments' column exists, migrate to special_instructions
                  if (names.has('comments')) {
                    db.run("UPDATE suppliers SET special_instructions = comments WHERE comments IS NOT NULL AND comments != ''", () => res());
                  } else {
                    res();
                  }
                });
                return;
              }
              db.run(next[0], (e) => {
                // Ignore duplicate column errors to be idempotent
                if (e && !String(e.message || e).includes('duplicate column name')) return rej(e);
                runNext();
              });
            };
            runNext();
          });
        }));

        // 2) Purchase Requests: supplier_files_created, oft_files_created
        tasks.push(new Promise((res, rej) => {
          db.all("PRAGMA table_info(purchase_requests)", (err, cols) => {
            if (err) return rej(err);
            const names = new Set(cols.map(c => c.name));
            const alters = [];
            if (!names.has('supplier_files_created')) alters.push(["ALTER TABLE purchase_requests ADD COLUMN supplier_files_created INTEGER DEFAULT 0"]);
            if (!names.has('oft_files_created')) alters.push(["ALTER TABLE purchase_requests ADD COLUMN oft_files_created INTEGER DEFAULT 0"]);
            const runNext = () => {
              const next = alters.shift();
              if (!next) return res();
              db.run(next[0], (e) => {
                if (e && !String(e.message || e).includes('duplicate column name')) return rej(e);
                runNext();
              });
            };
            runNext();
          });
        }));

        // 3) Create vendor_files table if missing
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS vendor_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pr_id TEXT NOT NULL,
            vendor_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT,
            file_size INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => err ? rej(err) : res());
        }));

        // 4) Create email_templates table if missing
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS email_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            subject TEXT,
            body TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => err ? rej(err) : res());
        }));

        // 5) Ensure unique index on product_sales(invoice_id, product_id)
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_invoice_product ON product_sales (invoice_id, product_id)`, (err) => err ? rej(err) : res());
        }));

        Promise.all(tasks).then(() => resolve()).catch(reject);
      });
    }
  }
  ,
  {
    version: 15,
    description: "Backfill created_at columns and ensure email_templates.name exists with unique index",
    up: (db) => {
      return new Promise((resolve, reject) => {
        const tasks = [];

        // products.created_at
        tasks.push(new Promise((res, rej) => {
          db.all("PRAGMA table_info(products)", (err, cols) => {
            if (err) return rej(err);
            const names = new Set(cols.map(c => c.name));
            if (!names.has('created_at')) {
              db.run("ALTER TABLE products ADD COLUMN created_at TEXT", (e) => {
                if (e && !String(e.message||e).includes('duplicate column name')) return rej(e);
                // Backfill now
                db.run("UPDATE products SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL OR created_at = ''", () => res());
              });
            } else res();
          });
        }));

        // purchase_requests.created_at
        tasks.push(new Promise((res, rej) => {
          db.all("PRAGMA table_info(purchase_requests)", (err, cols) => {
            if (err) return rej(err);
            const names = new Set(cols.map(c => c.name));
            if (!names.has('created_at')) {
              db.run("ALTER TABLE purchase_requests ADD COLUMN created_at TEXT", (e) => {
                if (e && !String(e.message||e).includes('duplicate column name')) return rej(e);
                db.run("UPDATE purchase_requests SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL OR created_at = ''", () => res());
              });
            } else res();
          });
        }));

        // email_templates table and name column
        tasks.push(new Promise((res, rej) => {
          // Ensure table exists
          db.run(`CREATE TABLE IF NOT EXISTS email_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            subject TEXT,
            body TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => {
            if (err) return rej(err);
            // Ensure name column exists
            db.all("PRAGMA table_info(email_templates)", (e2, cols) => {
              if (e2) return rej(e2);
              const names = new Set(cols.map(c => c.name));
              if (!names.has('name')) {
                db.run("ALTER TABLE email_templates ADD COLUMN name TEXT", (e3) => {
                  if (e3 && !String(e3.message||e3).includes('duplicate column name')) return rej(e3);
                  // Backfill a default name if missing
                  db.run("UPDATE email_templates SET name = COALESCE(name, 'Default') WHERE name IS NULL OR name = ''", () => {
                    // Create unique index if not exists
                    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name)", () => res());
                  });
                });
              } else {
                db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name)", () => res());
              }
            });
          });
        }));

        Promise.all(tasks).then(() => resolve()).catch(reject);
      });
    }
  }
];

// Migration 16: add unit_price to products and backfill if possible
migrations.push({
  version: 16,
  description: "Add unit_price column to products and backfill from known price fields",
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(products)", (err, cols) => {
        if (err) return reject(err);
        const names = new Set(cols.map(c => c.name));
        if (!names.has('unit_price')) {
          db.run('ALTER TABLE products ADD COLUMN unit_price REAL DEFAULT 0', (e) => {
            if (e && !String(e.message||e).includes('duplicate column name')) return reject(e);
            // Try to backfill from any legacy price columns if they exist
            const candidates = ['cost_price', 'sell_price', 'price', 'unit_price', 'standard_price'];
            // If any of those columns exist, copy into unit_price where unit_price is NULL or 0
            // Most likely none exist in products table, so this is a noop
            db.run("UPDATE products SET unit_price = COALESCE(unit_price, 0) WHERE unit_price IS NULL", () => resolve());
          });
        } else resolve();
      });
    });
  }
});

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
