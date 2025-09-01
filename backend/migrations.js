/**
 * Database Migration System
 * Handles database schema updates between app versions
 */

const fs = require('fs');
const path = require('path');

// Current database version
// NOTE: bump this when adding new migrations so the DB initialization runner will execute them.
const CURRENT_DB_VERSION = 24;

// Migration scripts - add new ones as you update the app
const migrations = [
  {
    version: 1,
    description: "Initial database setup and ensure core tables exist",
    up: (db) => {
      return new Promise((resolve, reject) => {
        const tasks = [];
        
        // Ensure core tables exist (for compatibility with very old versions)
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS products (
            cliniko_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            current_stock INTEGER DEFAULT 0,
            reorder_level INTEGER DEFAULT 0
          )`, (err) => err ? rej(err) : res());
        }));
        
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            email TEXT,
            phone TEXT
          )`, (err) => err ? rej(err) : res());
        }));
        
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS purchase_requests (
            pr_id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'Active',
            notes TEXT,
            items_json TEXT
          )`, (err) => err ? rej(err) : res());
        }));
        
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => err ? rej(err) : res());
        }));
        
        tasks.push(new Promise((res, rej) => {
          db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          )`, (err) => err ? rej(err) : res());
        }));
        
        Promise.all(tasks).then(() => {
          console.log('Core tables ensured');
          resolve();
        }).catch(reject);
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
          
          // Add the updated_at column without default (SQLite limitation)
          db.run('ALTER TABLE settings ADD COLUMN updated_at DATETIME', (err) => {
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
            if (!names.has('source')) alters.push(["ALTER TABLE suppliers ADD COLUMN source TEXT"]);
            if (!names.has('special_instructions')) alters.push(["ALTER TABLE suppliers ADD COLUMN special_instructions TEXT"]);
            if (!names.has('active')) alters.push(["ALTER TABLE suppliers ADD COLUMN active INTEGER"]);
            if (!names.has('account_number')) alters.push(["ALTER TABLE suppliers ADD COLUMN account_number TEXT"]);

            // Execute ALTERs sequentially to avoid locked DB
            const runNext = () => {
              const next = alters.shift();
              if (!next) {
                // Post-alter fixups
                // Initialize active if NULL and source to Manual
                db.run("UPDATE suppliers SET active = 1 WHERE active IS NULL", () => {
                  db.run("UPDATE suppliers SET source = 'Manual' WHERE source IS NULL", () => {
                    // If a legacy 'comments' column exists, migrate to special_instructions
                    if (names.has('comments')) {
                      db.run("UPDATE suppliers SET special_instructions = comments WHERE comments IS NOT NULL AND comments != ''", () => res());
                    } else {
                      res();
                    }
                  });
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
            if (!names.has('supplier_files_created')) alters.push(["ALTER TABLE purchase_requests ADD COLUMN supplier_files_created INTEGER"]);
            if (!names.has('oft_files_created')) alters.push(["ALTER TABLE purchase_requests ADD COLUMN oft_files_created INTEGER"]);
            const runNext = () => {
              const next = alters.shift();
              if (!next) {
                // Backfill defaults after adding columns
                db.run("UPDATE purchase_requests SET supplier_files_created = 0 WHERE supplier_files_created IS NULL", () => {
                  db.run("UPDATE purchase_requests SET oft_files_created = 0 WHERE oft_files_created IS NULL", () => res());
                });
                return;
              }
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

        // 5) Ensure unique index on product_sales(invoice_id, product_id) - only if table exists
        tasks.push(new Promise((res, rej) => {
          // First check if product_sales table exists
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='product_sales'", (err, row) => {
            if (err) return rej(err);
            if (!row) {
              console.log('product_sales table does not exist, skipping index creation');
              return res();
            }
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sales_invoice_product ON product_sales (invoice_id, product_id)`, (err) => err ? rej(err) : res());
          });
        }));

        Promise.all(tasks).then(() => resolve()).catch(reject);
      });
    }
  },
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
  ,
  {
    version: 20,
    description: "Add emails_sent column to purchase_requests",
    up: (db) => {
      return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(purchase_requests)", (err, cols) => {
          if (err) return reject(err);
          const names = new Set((cols || []).map(c => c.name));
          if (!names.has('emails_sent')) {
            db.run("ALTER TABLE purchase_requests ADD COLUMN emails_sent INTEGER", (e) => {
              if (e && !String(e.message || '').includes('duplicate column name')) return reject(e);
              // backfill to 0 where null
              db.run("UPDATE purchase_requests SET emails_sent = 0 WHERE emails_sent IS NULL", (uErr) => {
                if (uErr) console.warn('Migration 20 backfill warning:', uErr);
                resolve();
              });
            });
          } else resolve();
        });
      });
    }
  },
  {
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
          
          // Task 2: Handle cliniko_id INTEGER → TEXT conversion (proper table recreation)
          if (hasIntegerClinikoId) {
            tasks.push(new Promise((res, rej) => {
              console.log('  📝 Converting cliniko_id from INTEGER to TEXT (recreating table)...');
              
              // Step 1: Create backup table
              db.run("CREATE TABLE products_backup AS SELECT * FROM products", (backupErr) => {
                if (backupErr) return rej(backupErr);
                
                // Step 2: Drop original table
                db.run("DROP TABLE products", (dropErr) => {
                  if (dropErr) return rej(dropErr);
                  
                  // Step 3: Create new table with TEXT cliniko_id
                  db.run(`CREATE TABLE products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliniko_id TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    supplier_id INTEGER,
                    stock INTEGER DEFAULT 0,
                    reorder_level INTEGER DEFAULT 0,
                    barcode TEXT,
                    supplier_name TEXT,
                    created_at TEXT,
                    unit_price REAL,
                    current_stock INTEGER DEFAULT 0
                  )`, (createErr) => {
                    if (createErr) return rej(createErr);
                    
                    // Step 4: Copy data back with TEXT cliniko_id
                    db.run(`INSERT INTO products (id, cliniko_id, name, supplier_id, stock, reorder_level, barcode, supplier_name, created_at, unit_price, current_stock)
                             SELECT id, CAST(cliniko_id AS TEXT), name, supplier_id, stock, reorder_level, barcode, supplier_name, created_at, unit_price, current_stock 
                             FROM products_backup`, (copyErr) => {
                      if (copyErr) return rej(copyErr);
                      
                      // Step 5: Drop backup table
                      db.run("DROP TABLE products_backup", (cleanupErr) => {
                        if (cleanupErr) return rej(cleanupErr);
                        console.log('  ✅ cliniko_id precision fix complete (INTEGER → TEXT)');
                        res();
                      });
                    });
                  });
                });
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
  }
];

// Migration 17: rename existing stored PR identifiers from PUR##### to PO##### safely
migrations.push({
  version: 17,
  description: "Rename stored PR identifiers from PUR##### -> PO##### with backup and conflict checks",
  up: (db) => {
    return new Promise((resolve, reject) => {
      // Determine DB path and attempt backup next to the DB (non-fatal)
      const currentDbPath = process.env.DB_PATH || path.join(__dirname, 'appdata.db');
      const backupDir = path.dirname(currentDbPath) || __dirname;
      const backupPath = path.join(backupDir, `appdata.db.backup.migrate_pur_to_po.${Date.now()}.sqlite`);
      try {
        fs.copyFileSync(currentDbPath, backupPath);
        console.log('Created DB backup at', backupPath);
      } catch (copyErr) {
        console.warn('Migration 17: could not create DB backup (continuing):', copyErr && copyErr.message ? copyErr.message : copyErr);
      }

      db.serialize(() => {
        // Ensure purchase_requests exists
        db.all("PRAGMA table_info(purchase_requests)", (piErr, piCols) => {
          if (piErr) return reject(piErr);
          if (!piCols || piCols.length === 0) {
            console.log('Migration 17: purchase_requests table does not exist, skipping PR id rename');
            return resolve();
          }

          db.all("SELECT pr_id FROM purchase_requests WHERE pr_id LIKE 'PUR%'", (err, rows) => {
            if (err) return reject(err);
            const purRows = rows || [];
            if (purRows.length === 0) {
              console.log('Migration 17: no PUR... ids found; nothing to do');
              return resolve();
            }

            const conflicts = [];
            const renames = [];

            const checkNext = () => {
              if (purRows.length === 0) {
                if (conflicts.length > 0) {
                  console.error('Migration 17: conflicts detected, aborting. Conflicts:', conflicts);
                  return reject(new Error('Conflicts detected'));
                }

                // Apply renames inside a transaction
                db.run('BEGIN TRANSACTION', (beginErr) => {
                  if (beginErr) return reject(beginErr);

                  const applyNext = (idx) => {
                    if (idx >= renames.length) {
                      // Update referencing tables then commit
                      const updateTasks = [];
                      
                      // Check if purchase_request_items exists before updating
                      updateTasks.push(new Promise((ures, urej) => {
                        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_request_items'", (err, row) => {
                          if (err) return urej(err);
                          if (!row) {
                            console.log('purchase_request_items table does not exist, skipping PR id update');
                            return ures();
                          }
                          db.run("UPDATE purchase_request_items SET pr_id = REPLACE(pr_id, 'PUR', 'PO') WHERE pr_id LIKE 'PUR%'", (uErr) => {
                            if (uErr) return urej(uErr);
                            ures();
                          });
                        });
                      }));
                      
                      // Check if vendor_files exists before updating
                      updateTasks.push(new Promise((ures, urej) => {
                        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='vendor_files'", (err, row) => {
                          if (err) return urej(err);
                          if (!row) {
                            console.log('vendor_files table does not exist, skipping PR id update');
                            return ures();
                          }
                          db.run("UPDATE vendor_files SET pr_id = REPLACE(pr_id, 'PUR', 'PO') WHERE pr_id LIKE 'PUR%'", (uErr) => {
                            if (uErr) return urej(uErr);
                            ures();
                          });
                        });
                      }));
                      
                      Promise.all(updateTasks).then(() => {
                        db.run('COMMIT', (cErr) => {
                          if (cErr) return reject(cErr);
                          console.log('Migration 17: PR id rename complete');
                          return resolve();
                        });
                      }).catch(err => {
                        db.run('ROLLBACK', () => reject(err));
                      });
                      return;
                    }

                    const item = renames[idx];
                    db.run('UPDATE purchase_requests SET pr_id = ? WHERE pr_id = ?', [item.newId, item.oldId], (uErr) => {
                      if (uErr) {
                        db.run('ROLLBACK', () => reject(uErr));
                        return;
                      }
                      applyNext(idx + 1);
                    });
                  };

                  applyNext(0);
                });

                return;
              }

              const r = purRows.shift();
              const oldId = r.pr_id;
              const newId = 'PO' + oldId.slice(3);
              db.get('SELECT COUNT(*) as c FROM purchase_requests WHERE pr_id = ?', [newId], (qErr, row) => {
                if (qErr) return reject(qErr);
                if (row && row.c > 0) {
                  conflicts.push({ oldId, newId });
                } else {
                  renames.push({ oldId, newId });
                }
                // Continue checking
                checkNext();
              });
            };

            checkNext();
          });
        });
      });
    });
  }
});

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
          db.run('ALTER TABLE products ADD COLUMN unit_price REAL', (e) => {
            if (e && !String(e.message||e).includes('duplicate column name')) return reject(e);
            // Try to backfill from any legacy price columns if they exist
            const candidates = ['cost_price', 'sell_price', 'price', 'unit_price', 'standard_price'];
            // If any of those columns exist, copy into unit_price where unit_price is NULL or 0
            // Most likely none exist in products table, so this is a noop
            db.run("UPDATE products SET unit_price = 0 WHERE unit_price IS NULL", () => resolve());
          });
        } else resolve();
      });
    });
  }
});

// Migration 18: add po_change_log table and bookkeeping columns on purchase_requests
migrations.push({
  version: 18,
  description: "Add po_change_log audit table and bookkeeping columns for PO edits",
  up: (db) => {
    return new Promise((resolve, reject) => {
      const tasks = [];

      // 1) Create po_change_log table
      tasks.push(new Promise((res, rej) => {
        db.run(`CREATE TABLE IF NOT EXISTS po_change_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pr_id TEXT NOT NULL,
          changed_by TEXT,
          comment TEXT NOT NULL,
          before_json TEXT,
          after_json TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => err ? rej(err) : res());
      }));

      // 2) Add bookkeeping columns to purchase_requests if missing
      tasks.push(new Promise((res, rej) => {
        db.all("PRAGMA table_info(purchase_requests)", (err, cols) => {
          if (err) return rej(err);
          const names = new Set((cols || []).map(c => c.name));
          const alters = [];
          if (!names.has('last_modified_at')) alters.push('ALTER TABLE purchase_requests ADD COLUMN last_modified_at DATETIME');
          if (!names.has('last_modified_by')) alters.push('ALTER TABLE purchase_requests ADD COLUMN last_modified_by TEXT');
          if (!names.has('change_count')) alters.push('ALTER TABLE purchase_requests ADD COLUMN change_count INTEGER');

          const runNext = () => {
            const next = alters.shift();
            if (!next) {
              // Backfill defaults after adding columns
              db.run("UPDATE purchase_requests SET change_count = 0 WHERE change_count IS NULL", () => res());
              return;
            }
            db.run(next, (e) => {
              if (e && !String(e.message || '').includes('duplicate column name')) return rej(e);
              runNext();
            });
          };
          runNext();
        });
      }));

      Promise.all(tasks).then(() => resolve()).catch(reject);
    });
  }
});

// Migration 19: add supplier_id to products and backfill from suppliers table where possible
migrations.push({
  version: 19,
  description: "Add supplier_id to products and backfill from suppliers by matching supplier_name",
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(products)", (err, cols) => {
        if (err) return reject(err);
        const names = new Set((cols || []).map(c => c.name));
        if (names.has('supplier_id')) return resolve();

        db.run('ALTER TABLE products ADD COLUMN supplier_id INTEGER', (e) => {
          if (e && !String(e.message || '').includes('duplicate column name')) return reject(e);

          // Backfill supplier_id by matching suppliers.name (case-insensitive)
          try {
            db.run(`UPDATE products SET supplier_id = (
              SELECT id FROM suppliers WHERE LOWER(TRIM(suppliers.name)) = LOWER(TRIM(products.supplier_name)) LIMIT 1
            ) WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''`, (uErr) => {
              if (uErr) console.warn('Migration 19: supplier_id backfill encountered error:', uErr);
              else console.log('Migration 19: supplier_id backfill completed');
              resolve();
            });
          } catch (backErr) {
            // Non-fatal - resolve so migration doesn't block upgrades; log error
            console.warn('Migration 19: supplier_id backfill failed:', backErr);
            resolve();
          }
        });
      });
    });
  }
});

// Migration 21: add lead_time_days column to suppliers so lead-times can be stored and edited
migrations.push({
  version: 21,
  description: "Add lead_time_days INTEGER to suppliers for persisted supplier lead times",
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(suppliers)", (err, cols) => {
        if (err) return reject(err);
        const names = new Set((cols || []).map(c => c.name));
        if (names.has('lead_time_days')) return resolve();

        db.run('ALTER TABLE suppliers ADD COLUMN lead_time_days INTEGER', (e) => {
          // SQLite returns an error if column already exists in some cases; tolerate duplicate column errors
          if (e && !String(e.message || '').toLowerCase().includes('duplicate column')) return reject(e);
          // Backfill NULL lead times to a sensible default (7 days) so calculations can use a consistent value
          db.run("UPDATE suppliers SET lead_time_days = 7 WHERE lead_time_days IS NULL", (uErr) => {
            if (uErr) {
              console.warn('Migration 21 backfill warning:', uErr && uErr.message ? uErr.message : uErr);
            } else {
              console.log('Migration 21: backfilled lead_time_days to 7 for suppliers with NULL');
            }
            console.log('Migration 21: added lead_time_days column to suppliers');
            return resolve();
          });
        });
      });
    });
  }
});

// Migration 22: create supplier_product_discounts table to store volume/price discounts
migrations.push({
  version: 22,
  description: "Create supplier_product_discounts table for supplier- and product-level volume discounts",
  up: (db) => {
    return new Promise((resolve, reject) => {
      db.run(`CREATE TABLE IF NOT EXISTS supplier_product_discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER, -- nullable: when NULL it can represent global/product-only discounts
        product_cliniko_id TEXT, -- nullable: when NULL it represents supplier-wide discount
        min_qty INTEGER DEFAULT 1,
        price_per_unit REAL DEFAULT NULL,
        percent_discount REAL DEFAULT NULL,
        currency TEXT DEFAULT NULL,
        effective_from DATE DEFAULT NULL,
        effective_to DATE DEFAULT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )`, (err) => {
        if (err) return reject(err);
        // Indexes to speed up lookups by supplier and product
        db.run(`CREATE INDEX IF NOT EXISTS idx_spd_supplier_product ON supplier_product_discounts(supplier_id, product_cliniko_id)` , (iErr) => {
          if (iErr) return reject(iErr);
          db.run(`CREATE INDEX IF NOT EXISTS idx_spd_minqty ON supplier_product_discounts(min_qty)` , (iErr2) => {
            if (iErr2) return reject(iErr2);
            resolve();
          });
        });
      });
    });
  }
});

// Migration 24: Add active column to products table for manual product activation/deactivation control
migrations.push({
  version: 24,
  description: "Add active column to products table to allow manual control of product activation during sync",
  up: (db) => {
    return new Promise((resolve, reject) => {
      console.log('🔧 Adding active column to products table...');
      
      // First check if column already exists
      db.all("PRAGMA table_info(products)", (err, columns) => {
        if (err) return reject(err);
        
        const hasActiveColumn = columns.some(col => col.name === 'active');
        if (hasActiveColumn) {
          console.log('✅ Active column already exists in products table');
          return resolve();
        }
        
        // Add active column with default value of 1 (active)
        // Note: SQLite doesn't allow non-constant defaults, so we use a constant then backfill
        db.run('ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1', (addErr) => {
          if (addErr && !addErr.message.includes('duplicate column name')) {
            return reject(addErr);
          }
          
          // Backfill existing products to be active by default
          db.run("UPDATE products SET active = 1 WHERE active IS NULL", (updateErr) => {
            if (updateErr) {
              console.warn('Migration 24 backfill warning:', updateErr.message || updateErr);
            } else {
              console.log('Migration 24: backfilled active = 1 for existing products');
            }
            
            console.log('✅ Migration 24: Added active column to products table');
            resolve();
          });
        });
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
    // Validate migration metadata: unique, numeric versions
    const seen = new Map();
    for (const m of migrations) {
      if (!m || typeof m.version !== 'number' || !Number.isInteger(m.version) || m.version <= 0) {
        throw new Error(`Invalid migration version detected: ${JSON.stringify(m && m.version)}`);
      }
      if (seen.has(m.version)) {
        throw new Error(`Duplicate migration version detected: ${m.version}`);
      }
      seen.set(m.version, true);
    }

    // Ensure migrations run in numeric order regardless of how they were added to the array
    const ordered = migrations.slice().sort((a, b) => (a.version || 0) - (b.version || 0));
    console.log('Migrations to consider (in order):', ordered.map(m => m.version).join(', '));
    for (const migration of ordered) {
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

