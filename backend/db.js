// --- Get active PURs for a barcode ---
/**
 * Given a barcode, returns the product info and all active purchase requests (PURs) with outstanding quantity for that item.
 * @param {string} barcode
 * @returns {Promise<{item: object|null, purs: Array}>}
 */
function getActivePURsForBarcode(barcode) {
  return new Promise((resolve, reject) => {
    if (!barcode) return reject({ error: 'Missing barcode' });
    // Find the product by barcode (assume barcode is stored in products.barcode or products.cliniko_id or similar)
    db.get('SELECT * FROM products WHERE barcode = ? OR cliniko_id = ? OR name = ?', [barcode, barcode, barcode], (err, product) => {
      if (err) return reject({ error: 'DB error', details: err.message || err });
      if (!product) return resolve({ item: null, purs: [] });
      // Now find all active purchase requests with this product and outstanding quantity
      db.all('SELECT * FROM purchase_requests WHERE received = 0', [], (err2, prs) => {
        if (err2) return reject({ error: 'DB error', details: err2.message || err2 });
        if (!prs || prs.length === 0) return resolve({ item: product, purs: [] });
        // For each PR, check if it has this product with outstanding qty
        const prIds = prs.map(pr => pr.pr_id);
        if (prIds.length === 0) return resolve({ item: product, purs: [] });
        db.all('SELECT * FROM purchase_request_items WHERE product_id = ? OR product_name = ?', [product.cliniko_id, product.name], (err3, items) => {
          if (err3) return reject({ error: 'DB error', details: err3.message || err3 });
          // Only keep items in active PRs and with outstanding qty
          const itemsByPR = items.filter(item => prIds.includes(item.pr_id) && (item.no_to_order - (item.received_so_far || 0) > 0));
          // Map to PUR info with individual item IDs
          const purs = itemsByPR.map(item => {
            const pr = prs.find(pr => pr.pr_id === item.pr_id);
            return {
              id: item.id, // Use item ID instead of PR ID
              pr_id: pr.pr_id, // Also include PR ID for reference
              supplier: item.supplier_name,
              qty_ordered: item.no_to_order,
              qty_outstanding: item.no_to_order - (item.received_so_far || 0),
              date_created: pr.date_created,
              product_name: item.product_name
            };
          });
          resolve({ item: product, purs });
        });
      });
    });
  });
}

// --- Delete User ---
function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    if (!userId) return reject({ error: 'Missing user ID' });
    db.run('DELETE FROM users WHERE id=?', [userId], function (err) {
      if (err) return reject({ error: 'DB error', details: err.message || err });
      if (this.changes === 0) return reject({ error: 'User not found' });
      resolve({ message: 'User deleted' });
    });
  });
}

const bcrypt = require('bcryptjs');
const fs = require('fs');
// Import the supplier order file creation utility
const createSupplierOrderFiles = require('./createSupplierOrderFiles');
// --- Supplier Order File Creation ---
/**
 * Creates supplier order files (Excel) grouped by supplier, in the specified output folder.
 * @param {Array} items - Array of purchase request items (must include at least Product Name, Supplier Name, No. to Order)
 * @param {string} outputFolder - Absolute path to the folder where supplier subfolders/files will be created
 * @returns {Promise<{message: string, files: string[]}>}
 */
function createSupplierOrderFilesForVendors(items, outputFolder, opts = { format: 'html' }) {
  return new Promise(async (resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) {
      return reject({ error: 'No items provided' });
    }
    // Allow preview-only mode where no output folder is required
    const isPreview = opts && opts.previewOnly === true;
    if (!isPreview) {
      if (!outputFolder || typeof outputFolder !== 'string') {
        return reject({ error: 'No output folder specified' });
      }
    }
    try {
  // Log invocation for debugging
  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] createSupplierOrderFilesForVendors called with items=${items.length}, outputFolder=${outputFolder}, opts=${JSON.stringify(opts)}\n`); } catch (e) {}
      // Ensure output folder exists
      if (!isPreview) {
        if (!fs.existsSync(outputFolder)) {
          fs.mkdirSync(outputFolder, { recursive: true });
        }
      }

      // If we have a PR identifier (either explicitly in opts.prId or embedded in the incoming items
      // as a 'PUR Number' field), prefer to load the authoritative item rows from the DB so we
      // include fields like unit_cost and line_total that the renderer may not have passed through.
      try {
        let prIdCandidate = null;
        if (opts && opts.prId) prIdCandidate = String(opts.prId);
        else if (Array.isArray(items) && items.length > 0) {
          const first = items[0];
          if (first && (first['PUR Number'] || first.pr_id || first.prId || first.PRNumber)) {
            prIdCandidate = String(first['PUR Number'] || first.pr_id || first.prId || first.PRNumber);
          }
        }

        if (prIdCandidate) {
          try {
            // load purchase_request_items for this PR and map them into the shape expected by the generator
            const dbItems = await new Promise((res, rej) => {
              db.all('SELECT * FROM purchase_request_items WHERE pr_id = ? ORDER BY id', [prIdCandidate], (err, rows) => {
                if (err) return rej(err);
                return res(rows || []);
              });
            });
            if (Array.isArray(dbItems) && dbItems.length > 0) {
              // map DB rows to generator-friendly objects
              items = dbItems.map(r => ({
                'PUR Number': prIdCandidate,
                'Product Name': r.product_name || r.productName || r.name || '',
                'Supplier Name': r.supplier_name || r.supplierName || r.vendor || '',
                'No. to Order': r.no_to_order ?? r.quantity ?? r.qty ?? 0,
                'Quantity': r.quantity ?? r.no_to_order ?? r.qty ?? 0,
                'unit_cost': r.unit_cost ?? r.unitprice ?? r.unit_price ?? r.unitPrice ?? 0,
                'line_total': r.line_total ?? r.lineTotal ?? r.total ?? 0,
                // preserve any original fields where useful
                original_row: r
              }));
              try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] Loaded ${items.length} items for prId=${prIdCandidate} from DB before generating files\n`); } catch (e) {}
            }
          } catch (e) {
            try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] Could not load PR items for ${prIdCandidate}: ${e && e.message ? e.message : e}\n`); } catch (e) {}
          }
        }
      } catch (e) {
        // swallow - we'll attempt generation with whatever items we have
      }

      // Call the utility (assumed to return a Promise)
  // Attempt to enrich items with supplier account numbers (SupplierAccountNumber) so the PO renderer
  // can include account numbers in the generated documents.
  try {
    const supplierNames = Array.from(new Set((items || []).map(it => (it['Supplier Name'] || it.supplier_name || it.SupplierName || '').toString().trim()).filter(Boolean)));
    if (supplierNames.length > 0) {
      // Use case-insensitive match by comparing LOWER(name)
      const lowerNames = supplierNames.map(s => s.toLowerCase());
      const placeholders = lowerNames.map(() => '?').join(',');
      try {
        const rows = await new Promise((res, rej) => {
          db.all(`SELECT name, account_number FROM suppliers WHERE LOWER(name) IN (${placeholders})`, lowerNames, (err, rows) => {
            if (err) return rej(err);
            return res(rows || []);
          });
        });
        const acctMap = {};
        (rows || []).forEach(r => { if (r && r.name) acctMap[String(r.name).toLowerCase()] = r.account_number || null; });
        // Attach account number to each item under key SupplierAccountNumber (and supplier_account_number for compatibility)
        items = (items || []).map(it => {
          const rawName = (it['Supplier Name'] || it.supplier_name || it.SupplierName || '').toString().trim();
          const acct = rawName ? (acctMap[rawName.toLowerCase()] || null) : null;
          return Object.assign({}, it, { SupplierAccountNumber: acct, supplier_account_number: acct });
        });
        try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] Enriched items with supplier account numbers for ${Object.keys(acctMap).length} suppliers\n`); } catch (e) {}
      } catch (e) {
        try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] Failed to lookup supplier account numbers: ${e && e.message ? e.message : e}\n`); } catch (e) {}
      }
    }
  } catch (e) {
    // non-fatal - continue without account numbers
  }

  // createSupplierOrderFiles should support previewOnly and return a string/html when previewOnly=true
  const result = await createSupplierOrderFiles(items, outputFolder, opts);
      if (isPreview) {
        // In preview mode, return whatever the generator returns directly
        return resolve(result);
      }
  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] createSupplierOrderFiles generated ${Array.isArray(result)?result.length:'?'} files\n`); } catch (e) {}

      // If a purchase request ID (prId) was provided by the caller and this is not a preview run,
      // automatically mark the generated files in the vendor_files table so dev-server (non-Electron)
      // workflows still have their generated files recorded.
      try {
        if (opts && opts.prId && !isPreview) {
          const prId = String(opts.prId);
          const createdArray = Array.isArray(result) ? result : (result && Array.isArray(result.files) ? result.files : []);
          if (createdArray.length > 0) {
            for (const entry of createdArray) {
              try {
                // entry may be an object like { supplier, path, file, pdfPath } or a string path
                const rawCandidate = (entry && (entry.path || entry.pdfPath || entry.file || entry.filename)) || (typeof entry === 'string' ? entry : null);
                // Resolve relative paths against the outputFolder so we get a normalized absolute path when possible
                let absPath = null;
                if (rawCandidate) {
                  try {
                    if (path.isAbsolute(rawCandidate)) {
                      absPath = path.normalize(rawCandidate);
                    } else if (outputFolder) {
                      absPath = path.normalize(path.join(outputFolder, rawCandidate));
                    } else {
                      absPath = path.normalize(path.resolve(rawCandidate));
                    }
                  } catch (e) {
                    absPath = path.normalize(String(rawCandidate));
                  }
                }

                // Prefer supplier explicitly returned by generator; fall back to vendor/vendorName or derive from filename
                const rawSupplier = (entry && (entry.supplier || entry.vendor || entry.vendorName || entry.supplierName)) || null;
                let supplierName = rawSupplier ? String(rawSupplier).trim() : null;

                const filename = absPath ? path.basename(absPath) : ((entry && (entry.file || entry.filename)) || (typeof entry === 'string' ? path.basename(entry) : null)) || null;
                if (!supplierName) {
                  if (filename && filename.indexOf('_') !== -1) {
                    supplierName = filename.split('_')[0];
                  } else {
                    supplierName = 'Unknown Supplier';
                  }
                }
                const ext = (filename && path.extname(filename).toLowerCase()) || '';
                let fileType = 'other';
                if (ext === '.pdf') fileType = 'pdf';
                else if (ext === '.html' || ext === '.htm') fileType = 'html';
                else if (ext === '.oft') fileType = 'oft';
                else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') fileType = 'excel';

                // Try to get file size if possible
                let size = 0;
                try {
                  const stats = absPath ? await getFileStats(absPath) : null;
                  if (stats && stats.size) size = stats.size;
                } catch (e) {
                  // ignore stat errors
                }

                // Mark in DB (uses existing helper)
                try {
                  // Always pass normalized absolute path (or null) to DB helper to avoid mismatches later
                  const storedPath = absPath ? path.normalize(absPath) : null;
                  const storedFilename = filename ? path.basename(filename) : null;
                  await markVendorFilesCreated(prId, supplierName, fileType, storedFilename, storedPath, size);
                  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] auto-marked vendor file for prId=${prId}, vendor=${supplierName}, filename=${storedFilename}\n`); } catch (e) {}
                } catch (e) {
                  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] auto-mark vendor file ERROR: ${e && e.message ? e.message : e}\n`); } catch (e) {}
                }
              } catch (e) {
                try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] auto-mark inner loop ERROR: ${e && e.message ? e.message : e}\n`); } catch (e) {}
              }
            }
          }
        }
      } catch (e) {
        try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] auto-mark vendor files batch error: ${e && e.message ? e.message : e}\n`); } catch (e) {}
      }

  resolve({ message: 'Supplier order files created', files: result });
    } catch (err) {
  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] createSupplierOrderFilesForVendors ERROR: ${err && err.message ? err.message : err}\n`); } catch (e) {}
  reject({ error: 'Failed to create supplier order files', details: err.message || err });
    }
  });
}

// --- Change User Password ---
function changeUserPassword(userId, newPassword) {
  return new Promise(async (resolve, reject) => {
    if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
      return reject({ error: 'Invalid user ID or password (min 4 chars)' });
    }
    try {
      const hash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, userId], async function (err) {
        if (err) return reject({ error: 'DB error', details: err.message || err });
        if (this.changes === 0) return reject({ error: 'User not found' });
        
        // Clear default password warning if this was a password change from default
        try {
          await clearDefaultPasswordWarning();
        } catch (warningErr) {
          console.log('Note: Could not clear password warning (may not exist):', warningErr.message);
        }
        
        resolve({ message: 'Password updated successfully' });
      });
    } catch (e) {
      reject({ error: 'Hashing error', details: e.message || e });
    }
  });
}

// --- Session Timeout Management ---
function getSessionTimeout() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['SESSION_TIMEOUT_HOURS'], (err, row) => {
      if (err) return reject(err);
      // Default to 12 hours if not set or invalid
      const hours = row && row.value && !isNaN(Number(row.value)) ? Number(row.value) : 12;
      resolve({ hours });
    });
  });
}

function setSessionTimeout(hours) {
  return new Promise((resolve, reject) => {
    if (!hours || isNaN(Number(hours)) || Number(hours) <= 0) {
      return reject({ error: 'Invalid session timeout value' });
    }
    db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', ['SESSION_TIMEOUT_HOURS', String(Number(hours))], function (err) {
      if (err) return reject(err);
      resolve({ message: 'Session timeout updated', hours: Number(hours) });
    });
  });
}

// --- Generic App Settings ---
function getAppSetting(key) {
  return new Promise((resolve, reject) => {
    if (!key) return reject({ error: 'Missing key' });
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject({ error: 'DB error', details: err.message || err });
      resolve({ key, value: row ? row.value : null });
    });
  });
}

function setAppSetting(key, value) {
  return new Promise((resolve, reject) => {
    if (!key) return reject({ error: 'Missing key' });
    try {
      const ts = new Date().toISOString();
      db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(value), ts], function (err) {
        if (err) return reject({ error: 'DB error', details: err.message || err });
        resolve({ success: true, key });
      });
    } catch (e) {
      reject({ error: 'Failed to set setting', details: e.message });
    }
  });
}

// Gather PO template options: company profile and saved PO/email template
function gatherPoTemplateOptions() {
  return new Promise(async (resolve) => {
    try {
  const keys = ['company.name','company.address','company.phone','company.email','company.logo','company.special_instructions'];
      const results = {};
      for (const k of keys) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const r = await getAppSetting(k);
          results[k] = r && r.value ? r.value : null;
        } catch (e) {
          results[k] = null;
        }
      }
      // Get saved template (if any). Prefer an explicit active template saved in settings (po.activeTemplate)
      let template = null;
      try {
        const activeTpl = await getAppSetting('po.activeTemplate');
        if (activeTpl && activeTpl.value) {
          try {
            template = JSON.parse(activeTpl.value);
          } catch (e) {
            template = null;
          }
        }
      } catch (e) {
        // ignore
      }
          // Prefer a dedicated PO template stored in the DB
          if (!template) {
            try {
              // eslint-disable-next-line no-await-in-loop
              template = await getPoTemplate();
            } catch (e) {
              template = null;
            }
          }

          // Fallback to generic email template (for backward compatibility)
          if (!template) {
            try {
              // eslint-disable-next-line no-await-in-loop
              template = await getEmailTemplate();
            } catch (e) {
              template = null;
            }
          }

          // Ignore known placeholder templates that came from older versions or accidental saves
          try {
            if (template && (typeof template.body === 'string')) {
              const b = template.body.trim();
              if (b === '...PO body...' || b === '...PO body...\n' || b.length === 0) {
                template = null;
              }
            }
            // Also ignore when the template HTML field contains the placeholder
            if (template && template.html && typeof template.html === 'string' && template.html.indexOf('...PO body...') !== -1) {
              template = null;
            }
          } catch (e) {
            // ignore any issues while sanitizing template
            template = template;
          }

      resolve({ company: {
        name: results['company.name'] || null,
        address: results['company.address'] || null,
        phone: results['company.phone'] || null,
        email: results['company.email'] || null,
        logo: results['company.logo'] || null,
        special_instructions: results['company.special_instructions'] || null
      }, template });
    } catch (e) {
      resolve({ company: {}, template: null });
    }
  });
}
// --- Update stock from Cliniko API ---
const https = require('https');
const { URL } = require('url');
const { https: httpsFollowRedirects } = require('follow-redirects');

// Use follow-redirects https for API calls that might redirect
const httpOrHttps = httpsFollowRedirects;

// --- Sync Products from Cliniko API (Create/Insert) ---
function syncProductsFromCliniko() {
  return new Promise((resolve, reject) => {
    getActualApiKey().then(apiKey => {
      const allProducts = [];
      let nextUrl = 'https://api.au1.cliniko.com/v1/products';
      // Format as Basic Auth: 'Basic ' + base64(token + ':')
      const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
      const headers = {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'User-Agent': 'StockProcurementApp'
      };

      function fetchPage(url) {
        let data = '';
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers
        };
        const req = httpOrHttps.request(options, (res) => {
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            let json;
            try {
              json = JSON.parse(data);
            } catch (e) {
              // Log the raw response to a file for debugging
              const fs = require('fs');
              const logPath = require('path').join(__dirname, 'cliniko_products_error.log');
              fs.writeFileSync(logPath, data, { encoding: 'utf8' });
              return reject({ error: 'Failed to parse Cliniko response', details: data });
            }
            if (!json.products) return reject({ error: 'No products in Cliniko response', details: data });
            // Filter out archived products from this page
            const pageProducts = Array.isArray(json.products) ? json.products.filter(p => !p.archived_at) : [];
            allProducts.push(...pageProducts);
            const next = json.links && json.links.next;
            if (next) {
              setTimeout(() => fetchPage(next), 2000); // 2 seconds delay between pages
            } else {
              // De-duplicate by Cliniko ID across all pages
              const uniqueById = new Map();
              for (const p of allProducts) {
                const id = String(p.id);
                if (!uniqueById.has(id)) uniqueById.set(id, p);
              }
              const productsToProcess = Array.from(uniqueById.values());

              // Collect unique supplier names for auto-population
              const uniqueSuppliers = new Set();
              productsToProcess.forEach(product => {
                const supplier_name = product.product_supplier_name;
                if (supplier_name && supplier_name.trim() !== '') {
                  uniqueSuppliers.add(supplier_name.trim());
                }
              });
              
              console.log(`Found ${uniqueSuppliers.size} unique suppliers from Cliniko products`);

              // Check products table schema before inserting
              db.all('PRAGMA table_info(products)', (schemaErr, columns) => {
                if (schemaErr) {
                  console.error('Schema check error:', schemaErr);
                } else {
                  console.log('Products table schema:');
                  columns.forEach(col => {
                    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
                  });
                }
              });

              // Insert/Update products in local DB
              let processed = 0;
              let total = productsToProcess.length;
              let inserted = 0;
              let updated = 0;
              
              console.log(`Processing ${total} products from Cliniko (after filtering archived and de-duplication)...`);
              
              if (total === 0) return resolve({ message: 'No products to sync', products_synced: 0 });
              
              productsToProcess.forEach(product => {
                const cliniko_id = String(product.id);
                const name = product.name || 'Unknown Product';
                
                // Debug logging for packaged app issues
                if (!product.id) {
                  console.error('ERROR: Product has no ID:', product);
                  return; // Skip this product
                }
                if (!cliniko_id || cliniko_id === 'undefined' || cliniko_id === 'null') {
                  console.error('ERROR: Invalid cliniko_id after conversion:', cliniko_id, 'from product.id:', product.id);
                  return; // Skip this product
                }
                
                const stock = product.stock_level || 0;
                // Check for serial_number first, then barcode, then empty string
                const barcode = product.serial_number || product.barcode || '';
                // Use the correct Cliniko field for supplier name
                const supplier_name = product.product_supplier_name || '';

                // Derive unit price from likely Cliniko fields (prefer cost_price)
                const unit_price = (product.cost_price || product.sell_price || product.price || product.unit_price || product.standard_price || 0);

                // Use UPSERT to avoid duplicates and correctly update existing rows
                // Preserve existing active status if product already exists, default to 1 (active) for new products
                db.run(`INSERT INTO products (cliniko_id, name, barcode, stock, supplier_name, reorder_level, unit_price, active)
                        VALUES (?, ?, ?, ?, ?, COALESCE((SELECT reorder_level FROM products WHERE cliniko_id = ?), 0), ?, 1)
                        ON CONFLICT(cliniko_id) DO UPDATE SET
                          name=excluded.name,
                          barcode=excluded.barcode,
                          stock=excluded.stock,
                          supplier_name=excluded.supplier_name,
                          reorder_level=COALESCE(products.reorder_level, excluded.reorder_level),
                          unit_price=excluded.unit_price,
                          active=COALESCE(products.active, excluded.active)`,
                  [cliniko_id, name, barcode, stock, supplier_name, cliniko_id, unit_price], 
                  function(err) {
                    if (err) {
                      console.error('Error upserting product:', err);
                      console.error('Failed product data:', {
                        cliniko_id, name, barcode, stock, supplier_name, unit_price,
                        original_product_id: product.id
                      });
                    } else {
                      // changes === 1 when insert, 2 when update in SQLite UPSERT
                      if (this.changes === 1) inserted++;
                      else if (this.changes === 2) updated++;
                    }
                    
                    processed++;
                    if (processed === total) {
                      console.log(`Product sync completed: ${inserted} inserted, ${updated} updated`);
                      
                      // Auto-populate suppliers table with unique supplier names
                      getAutoDeactivateClinikoSuppliers()
                        .then(setting => {
                          const opts = { deactivateMissing: setting && setting.enabled === true };
                          return autoPopulateSuppliersFromCliniko(uniqueSuppliers, opts);
                        })
                        .then((supplierResult) => {
                          console.log(`Supplier auto-population completed: ${supplierResult.inserted} new suppliers added`);
                          // Post-auto-populate backfill: set products.supplier_id where supplier_name now matches suppliers.name
                          try {
                            db.run(`UPDATE products SET supplier_id = (
                              SELECT id FROM suppliers WHERE LOWER(TRIM(suppliers.name)) = LOWER(TRIM(products.supplier_name)) LIMIT 1
                            ) WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''`, (uErr) => {
                              if (uErr) console.warn('Post-sync supplier_id backfill error (products):', uErr);
                              else console.log('Post-sync supplier_id backfill (products) completed');
                              resolve({ 
                                message: 'Products synced from Cliniko', 
                                products_synced: total,
                                inserted: inserted,
                                updated: updated,
                                suppliers_added: supplierResult.inserted,
                                suppliers_reactivated: supplierResult.reactivated || 0,
                                suppliers_deactivated: supplierResult.deactivated || 0
                              });
                            });
                          } catch (e) {
                            console.warn('Failed to run post-sync supplier_id backfill:', e);
                            resolve({ 
                              message: 'Products synced from Cliniko', 
                              products_synced: total,
                              inserted: inserted,
                              updated: updated,
                              suppliers_added: supplierResult.inserted,
                              suppliers_reactivated: supplierResult.reactivated || 0,
                              suppliers_deactivated: supplierResult.deactivated || 0
                            });
                          }
                        })
                        .catch((supplierError) => {
                          console.error('Error auto-populating suppliers:', supplierError);
                          // Still resolve with product sync success, just log supplier error
                          resolve({ 
                            message: 'Products synced from Cliniko (supplier auto-population failed)', 
                            products_synced: total,
                            inserted: inserted,
                            updated: updated,
                            supplier_error: supplierError.message
                          });
                        });
                    }
                  }
                );
              });
            }
          });
        });
        req.on('error', (e) => reject({ error: e.message }));
        req.setTimeout(30000, () => {
          req.destroy();
          reject({ error: 'Request timeout' });
        });
        req.end();
      }
      fetchPage(nextUrl);
    }).catch(error => {
      reject(error);
    });
  });
}

function updateStockFromCliniko() {
  return new Promise((resolve, reject) => {
    getActualApiKey().then(apiKey => {
      const allProducts = [];
      let nextUrl = 'https://api.au1.cliniko.com/v1/products';
      // Format as Basic Auth: 'Basic ' + base64(token + ':')
      const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
      const headers = {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'MyAPP (mitch.hare34@gmail.com)'
      };

      function fetchPage(url) {
        let data = '';
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers
        };
        const req = httpOrHttps.request(options, (res) => {
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            let json;
            try {
              json = JSON.parse(data);
            } catch (e) {
              // Log the raw response to a file for debugging
              const fs = require('fs');
              const logPath = require('path').join(__dirname, 'cliniko_response_error.log');
              fs.writeFileSync(logPath, data, { encoding: 'utf8' });
              return reject({ error: 'Failed to parse Cliniko response', details: data });
            }
            if (!json.products) return reject({ error: 'No products in Cliniko response', details: data });
            allProducts.push(...json.products);
            const next = json.links && json.links.next;
            if (next) {
              fetchPage(next);
            } else {
              // Map to cliniko_list schema and include barcode info
              const cliniko_list = allProducts.map(item => ({
                'Id': String(item.id),
                'Stock': item.stock_level,
                'Reorder Level': 0,
                'Product Name': item.name,
                'Supplier Name': item.product_supplier_name,
                'Barcode': item.serial_number || item.barcode || ''
              }));

              // Collect unique supplier names for possible auto-population
              const uniqueSuppliers = new Set();
              cliniko_list.forEach(item => {
                const s = item['Supplier Name'];
                if (s && String(s).trim() !== '') uniqueSuppliers.add(String(s).trim());
              });

              // Update local DB stock, barcode and unit_price for each product
              let updated = 0;
              let total = cliniko_list.length;
              if (total === 0) return resolve({ message: 'No products to update', total: 0, suppliers_updated: 0 });
              cliniko_list.forEach(prod => {
                const cliniko_id = prod['Id'];
                const stock = prod['Stock'] || 0;
                const barcode = prod['Barcode'] || '';
                // Attempt to find unit price from the original allProducts array by id
                let unit_price = 0;
                try {
                  const orig = allProducts.find(p => String(p.id) === String(cliniko_id));
                  if (orig) unit_price = (orig.cost_price || orig.sell_price || orig.price || orig.unit_price || orig.standard_price || 0);
                } catch (e) {
                  unit_price = 0;
                }

                db.run('UPDATE products SET stock=?, barcode=?, unit_price=? WHERE cliniko_id=?', [stock, barcode, unit_price, cliniko_id], (err2) => {
                  updated++;
                  if (updated === total) {
                    // After updating all products, attempt to auto-populate suppliers (respect admin setting)
                    getAutoDeactivateClinikoSuppliers()
                      .then(setting => {
                        const opts = { deactivateMissing: setting && setting.enabled === true };
                        return autoPopulateSuppliersFromCliniko(uniqueSuppliers, opts);
                      })
                      .then(supplierResult => {
                        const inserted = supplierResult && supplierResult.inserted ? supplierResult.inserted : 0;
                        const reactivated = supplierResult && supplierResult.reactivated ? supplierResult.reactivated : 0;
                        const deactivated = supplierResult && supplierResult.deactivated ? supplierResult.deactivated : 0;
                        // Post-auto-populate backfill for products.supplier_id after suppliers inserted/reactivated
                        try {
                          db.run(`UPDATE products SET supplier_id = (
                            SELECT id FROM suppliers WHERE LOWER(TRIM(suppliers.name)) = LOWER(TRIM(products.supplier_name)) LIMIT 1
                          ) WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''`, (uErr) => {
                            if (uErr) console.warn('Post-update supplier_id backfill error (products):', uErr);
                            else console.log('Post-update supplier_id backfill (products) completed');
                            const suppliersUpdatedTotal = inserted + reactivated;
                            resolve({ message: 'Stock and barcode updated from Cliniko', total, suppliers_updated: suppliersUpdatedTotal, suppliers_inserted: inserted, suppliers_reactivated: reactivated, suppliers_deactivated: deactivated });
                          });
                        } catch (e) {
                          console.warn('Failed to run post-update supplier_id backfill:', e);
                          const suppliersUpdatedTotal = inserted + reactivated;
                          resolve({ message: 'Stock and barcode updated from Cliniko', total, suppliers_updated: suppliersUpdatedTotal, suppliers_inserted: inserted, suppliers_reactivated: reactivated, suppliers_deactivated: deactivated });
                        }
                      })
                      .catch(supplierErr => {
                        console.error('Error auto-populating suppliers from updateStockFromCliniko:', supplierErr);
                        // If the supplierErr contains counts, try to surface them; otherwise default to 0
                        const insertedFromErr = supplierErr && (supplierErr.inserted || supplierErr.inserted === 0) ? supplierErr.inserted : 0;
                        const reactivatedFromErr = supplierErr && (supplierErr.reactivated || supplierErr.reactivated === 0) ? supplierErr.reactivated : 0;
                        const suppliersUpdatedFromErr = insertedFromErr + reactivatedFromErr;
                        // Still resolve success for stock update but include supplier error and counts if available
                        resolve({ message: 'Stock and barcode updated from Cliniko (supplier auto-population failed)', total, suppliers_updated: suppliersUpdatedFromErr, suppliers_inserted: insertedFromErr, suppliers_reactivated: reactivatedFromErr, supplier_error: supplierErr.message || supplierErr });
                      });
                  }
                });
              });
            }
          });
        });
        req.on('error', (e) => reject({ error: e.message }));
        req.end();
      }
      fetchPage(nextUrl);
    }).catch(error => {
      reject(error);
    });
  });
}
const path = require('path');

// Helper function to get the correct log path for both dev and production
function getLogPath() {
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) {
      return path.join(app.getPath('userData'), 'backend.log');
    } else {
      return path.join(__dirname, 'backend.log');
    }
  } catch (e) {
    // Fallback to __dirname if electron is not available
    return path.join(__dirname, 'backend.log');
  }
}

// --- Preview Sales Data Count from Cliniko ---
function previewSalesDataCount(startDate = null, endDate = null, providedApiKey = null) {
  return new Promise((resolve, reject) => {
    console.log('🔍 previewSalesDataCount called with:');
    console.log('  - startDate:', startDate);
    console.log('  - endDate:', endDate);
    console.log('  - providedApiKey:', providedApiKey ? 'PROVIDED (length: ' + providedApiKey.length + ')' : 'NOT PROVIDED');
    
    // Use provided API key if available, otherwise get from database
    const keyPromise = providedApiKey ? Promise.resolve(providedApiKey) : getActualApiKey();
    
    keyPromise.then(apiKey => {
      
      // Use provided startDate or default to 2 years ago
      if (!startDate) {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        startDate = twoYearsAgo.toISOString();
      }
      
      // Use provided endDate or default to now
      if (!endDate) {
        endDate = new Date().toISOString();
      }
      
      console.log(`Previewing invoice count from ${startDate} to ${endDate}...`);
      
      // Query Cliniko API to get total count of invoices in date range
      const previewUrl = `https://api.au1.cliniko.com/v1/invoices?per_page=1&q[]=created_at:>${startDate}&q[]=created_at:<${endDate}`;
      const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
      const headers = {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'StockProcurementApp'
      };
      
      const urlObj = new URL(previewUrl);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers
      };
      
      const req = httpOrHttps.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            // Check if there are any invoices in the response
            const hasInvoices = json.invoices && json.invoices.length > 0;
            const totalEntries = json.total_entries || 0;
            
            console.log(`Preview API response:`, { 
              hasInvoices, 
              invoiceCount: json.invoices ? json.invoices.length : 0,
              totalEntries: totalEntries,
              hasLinks: !!json.links 
            });
            
            console.log(`Preview found ${totalEntries} total invoices in date range`);
            
            // Calculate estimated number of sales records and total time.
            // We estimate ~3 sales records per invoice by default (line items),
            // and approximate 3 seconds per sale record to input.
            const estimatedSalesRecords = totalEntries * 3; // rough average
            const secondsPerSale = 3; // seconds per sale record (user-specified)
            const estimatedTimeSeconds = Math.round(estimatedSalesRecords * secondsPerSale);
            const estimatedTimeMinutes = Math.round(estimatedTimeSeconds / 60 * 10) / 10; // Round to 1 decimal

            // Format time estimate
            let timeEstimate = '';
            if (estimatedTimeSeconds < 60) {
              timeEstimate = `${estimatedTimeSeconds} seconds`;
            } else if (estimatedTimeMinutes < 60) {
              timeEstimate = `${estimatedTimeMinutes} minutes`;
            } else {
              const hours = Math.floor(estimatedTimeMinutes / 60);
              const minutes = Math.round(estimatedTimeMinutes % 60);
              timeEstimate = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
            }

            console.log(`Estimated sync time: ${timeEstimate} (approx ${secondsPerSale}s per sale record, ${estimatedSalesRecords} estimated sales)`);

            resolve({
              success: true,
              totalInvoices: totalEntries,
              estimatedSalesRecords: estimatedSalesRecords,
              estimatedTimeSeconds: estimatedTimeSeconds,
              estimatedTimeMinutes: estimatedTimeMinutes,
              estimatedTimeFormatted: timeEstimate,
              dateRange: {
                start: startDate.split('T')[0],
                end: endDate.split('T')[0]
              }
            });
          } catch (parseErr) {
            console.error('Error parsing preview response:', parseErr);
            reject({ error: 'Failed to parse Cliniko API response', details: parseErr.message });
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('Preview request error:', err);
        reject({ error: 'Failed to connect to Cliniko API', details: err.message });
      });
      
      req.end();
      
    }).catch(apiErr => {
      console.error('API key error during preview:', apiErr);
      reject({ error: 'Failed to get API key', details: apiErr.message || apiErr });
    });
  });
}

// --- Update Sales Data from Cliniko ---
function updateSalesDataFromCliniko(startDate = null, endDate = null) {
  return new Promise((resolve, reject) => {
    getActualApiKey().then(apiKey => {
      
      // Check latest date in database if no dates provided
      if (!startDate) {
        db.get('SELECT MAX(invoice_date) as latest_date FROM product_sales', (err, result) => {
          if (err) {
            console.error('Error checking latest date:', err);
            // Default to 2 years ago if can't check
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            startDate = twoYearsAgo.toISOString();
          } else if (result && result.latest_date) {
            // Start from the latest date we have
            startDate = result.latest_date;
            // Start from the latest date we have
            startDate = result.latest_date;
            console.log(`Resuming sync from latest date in DB: ${startDate}`);
            
            // Check if there are actually any new invoices since our latest date
            // Use created_at instead of updated_at for more reliable checking
            const checkUrl = `https://api.au1.cliniko.com/v1/invoices?per_page=5&q[]=created_at:>${startDate}&sort=created_at:desc`;
            // Format as Basic Auth: 'Basic ' + base64(token + ':')
            const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
            const headers = {
              'Authorization': authHeader,
              'Accept': 'application/json',
              'User-Agent': 'StockProcurementApp'
            };
            
            // Quick check for new data
            const urlObj = new URL(checkUrl);
            const options = {
              hostname: urlObj.hostname,
              path: urlObj.pathname + urlObj.search,
              method: 'GET',
              headers
            };
            
            console.log(`Checking for new invoices since last sync: ${startDate}...`);
            const req = httpOrHttps.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                try {
                  const json = JSON.parse(data);
                  if (!json.invoices || json.invoices.length === 0) {
                    console.log('No new invoices found - skipping sync');
                    return resolve({ 
                      message: 'No new invoices to sync', 
                      invoicesProcessed: 0, 
                      salesRecordsInserted: 0,
                      skipped: true 
                    });
                  }
                  
                  // Check if any of these invoices are actually newer than our latest date
                  const newerInvoices = json.invoices.filter(invoice => 
                    new Date(invoice.created_at) > new Date(startDate)
                  );
                  
                  if (newerInvoices.length === 0) {
                    console.log('All returned invoices are older than or equal to latest sync date - skipping');
                    return resolve({ 
                      message: 'No new invoices to sync', 
                      invoicesProcessed: 0, 
                      salesRecordsInserted: 0,
                      skipped: true 
                    });
                  }
                  
                  console.log(`Found ${newerInvoices.length} new invoice(s) since ${startDate} - proceeding with sync`);
                  performSyncWithDates();
                } catch (e) {
                  console.error('Error checking for new invoices:', e);
                  // If check fails, proceed with sync anyway
                  performSyncWithDates();
                }
              });
            });
            
            req.on('error', (e) => {
              console.error('Error checking for new invoices:', e);
              // If check fails, proceed with sync anyway
              performSyncWithDates();
            });
            
            req.end();
            return;
          } else {
            // No data in DB, start from 2 years ago
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            startDate = twoYearsAgo.toISOString();
            console.log(`No existing data, starting from: ${startDate}`);
          }
          
          performSyncWithDates();
        });
        return;
      }
      
      function performSyncWithDates() {
        if (!endDate) {
          endDate = new Date().toISOString();
        }
        performSync();
      }
      
      // Convert dates to ISO format if provided
      if (!endDate) {
        endDate = new Date().toISOString();
      } else {
        endDate = new Date(endDate).toISOString();
      }
      startDate = new Date(startDate).toISOString();
      
      performSync();
      
      function performSync() {
        // Use created_at instead of updated_at for more reliable sync
        let nextUrl = `https://api.au1.cliniko.com/v1/invoices?per_page=100&q[]=created_at:>${startDate}&sort=created_at:desc`;
        
        // Format as Basic Auth: 'Basic ' + base64(token + ':')
        const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
        const headers = {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'User-Agent': 'StockProcurementApp'
        };

        let fetchedSales = 0;
        let fetchedInvoices = 0;
        const insertStmt = db.prepare('INSERT OR IGNORE INTO product_sales (invoice_id, invoice_date, product_id, product_name, quantity) VALUES (?, ?, ?, ?, ?)');

        function extractProductId(productLinks) {
          const url = productLinks.self || '';
          if (url) {
            return url.replace(/\/$/, '').split('/').pop();
          }
          return null;
        }

        function fetchPage(url) {
          let data = '';
          const urlObj = new URL(url);
          const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers
          };
          
          console.log(`Fetching invoices from: ${url}`);
          
          const req = httpOrHttps.request(options, (res) => {
            // Check for HTTP errors
            if (res.statusCode !== 200) {
              console.error(`HTTP ${res.statusCode} for invoice list: ${res.statusMessage}`);
              return reject({ error: `HTTP ${res.statusCode}: ${res.statusMessage}` });
            }
            
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              // Validate response before parsing
              if (!data || data.trim().length === 0) {
                console.error('Empty response for invoice list');
                return reject({ error: 'Empty response from Cliniko API' });
              }
              
              // Check if response looks like JSON
              if (!data.trim().startsWith('{') && !data.trim().startsWith('[')) {
                console.error(`Non-JSON response for invoice list: ${data.substring(0, 100)}...`);
                return reject({ error: 'Invalid response format from Cliniko API' });
              }
              
              let json;
              try {
                json = JSON.parse(data);
              } catch (e) {
                console.error('Failed to parse invoice list JSON:', e);
                console.error(`Response length: ${data.length} chars`);
                console.error(`Response start: ${data.substring(0, 200)}...`);
                console.error(`Response end: ...${data.substring(Math.max(0, data.length - 200))}`);
                const fs = require('fs');
                const logPath = require('path').join(__dirname, 'cliniko_invoices_error.log');
                fs.writeFileSync(logPath, data, { encoding: 'utf8' });
                return reject({ error: 'Failed to parse Cliniko invoices response', details: data });
              }
              
              if (!json.invoices) {
                console.log('No invoices in response:', json);
                return finishSync();
              }
              
              const invoices = json.invoices;
              if (invoices.length === 0) {
                console.log('No more invoices found.');
                return finishSync();
              }
              
              processInvoices(invoices, () => {
                const next = json.links && json.links.next;
                if (next) {
                  setTimeout(() => fetchPage(next), 2000); // 2 seconds delay between pages
                } else {
                  finishSync();
                }
              });
            });
          });
          
          // Set request timeout
          req.setTimeout(30000, () => {
            req.destroy();
            console.error('Request timeout for main invoice list');
            reject({ error: 'Request timeout for main invoice list' });
          });

          req.on('error', (e) => {
            console.error('Request error for main invoice list:', e.message);
            reject({ error: e.message });
          });
          req.end();
        }

        function processInvoices(invoices, callback) {
          let processed = 0;
          
          invoices.forEach((invoice, index) => {
            // Add staggered delays to prevent hitting rate limits
            setTimeout(() => {
              const invoiceId = invoice.id;
              const createdAt = invoice.created_at;
              
              fetchedInvoices++;
              console.log(`Processing Invoice ID: ${invoiceId}, Created At: ${createdAt} (${index + 1}/${invoices.length})`);
              
              // Fetch invoice items using the same pattern as your working code
              const itemsUrl = `https://api.au1.cliniko.com/v1/invoices/${invoiceId}/invoice_items`;
              const itemsUrlObj = new URL(itemsUrl);
              const itemsOptions = {
                hostname: itemsUrlObj.hostname,
                path: itemsUrlObj.pathname,
                method: 'GET',
                headers
              };
              
              const itemsReq = httpOrHttps.request(itemsOptions, (itemsRes) => {
                let itemsData = ''; // Fresh data buffer for each request
              
              // Check for HTTP errors
              if (itemsRes.statusCode !== 200) {
                console.error(`HTTP ${itemsRes.statusCode} for invoice ${invoiceId}: ${itemsRes.statusMessage}`);
                processed++;
                if (processed === invoices.length) {
                  setTimeout(callback, 2000); // 2 second delay on HTTP error (rate limit recovery)
                }
                return;
              }
              
              itemsRes.on('data', (chunk) => { itemsData += chunk; });
              itemsRes.on('end', () => {
                // Validate response before parsing
                if (!itemsData || itemsData.trim().length === 0) {
                  console.error(`Empty response for invoice ${invoiceId}`);
                  processed++;
                  if (processed === invoices.length) {
                    setTimeout(callback, 1500); // 1.5 second delay on empty response
                  }
                  return;
                }
                
                // Check if response looks like JSON
                if (!itemsData.trim().startsWith('{') && !itemsData.trim().startsWith('[')) {
                  console.error(`Non-JSON response for invoice ${invoiceId}: ${itemsData.substring(0, 100)}...`);
                  processed++;
                  if (processed === invoices.length) {
                    setTimeout(callback, 1500); // 1.5 second delay on invalid JSON
                  }
                  return;
                }
                
                try {
                  const itemsJson = JSON.parse(itemsData);
                  const invoiceItems = itemsJson.invoice_items || [];
                  
                  invoiceItems.forEach(item => {
                    const productLinks = (item.product && item.product.links) || {};
                    const productId = extractProductId(productLinks);
                    const productName = item.name || 'Unknown product';
                    const quantity = parseFloat(item.quantity || 0);
                    
                    if (productId) {
                      insertStmt.run([invoiceId, createdAt, productId, productName, quantity], (insertErr) => {
                        if (insertErr) {
                          console.error('Error inserting sales record:', insertErr);
                        } else {
                          fetchedSales++;
                          console.log(`  Inserted sale: Product ID ${productId}, Name '${productName}', Quantity ${quantity}`);
                        }
                      });
                    }
                  });
                  
                  processed++;
                  if (processed === invoices.length) {
                    setTimeout(callback, 1000); // 1 second delay after processing all invoices in page
                  }
                } catch (e) {
                  console.error(`Failed to parse items for invoice ${invoiceId}:`, e);
                  console.error(`Response length: ${itemsData.length} chars`);
                  console.error(`Response start: ${itemsData.substring(0, 200)}...`);
                  console.error(`Response end: ...${itemsData.substring(Math.max(0, itemsData.length - 200))}`);
                  processed++;
                  if (processed === invoices.length) {
                    setTimeout(callback, 1500); // Extra delay on error
                  }
                }
              });
            });
            
            // Set request timeout (10 seconds)
            itemsReq.setTimeout(10000, () => {
              console.error(`Request timeout for invoice ${invoiceId}`);
              itemsReq.abort();
              processed++;
              if (processed === invoices.length) {
                setTimeout(callback, 1500);
              }
            });
            
            itemsReq.on('error', (e) => {
              console.error(`Failed to fetch items for invoice ${invoiceId}:`, e);
              processed++;
              if (processed === invoices.length) {
                setTimeout(callback, 2000); // 2 second delay on network error
              }
            });
            
            itemsReq.end();
            }, index * 1200); // 1.2 seconds delay between each invoice request (50 requests/minute)
          });
        }

        function finishSync() {
          insertStmt.finalize();
          console.log(`Done! Processed ${fetchedInvoices} invoices and inserted ${fetchedSales} product sales.`);
          
          resolve({ 
            message: 'Sales data updated from Cliniko', 
            invoicesProcessed: fetchedInvoices,
            salesRecordsInserted: fetchedSales,
            dateRange: { startDate, endDate }
          });
        }
        
        fetchPage(nextUrl);
      }
    }).catch(error => {
      reject(error);
    });
  });
}

// --- Product Sales ---
function getProductSales(start_date, end_date) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM product_sales';
    let params = [];
    if (start_date && end_date) {
      query += ' WHERE invoice_date BETWEEN ? AND ?';
      params = [start_date, end_date];
    } else if (start_date) {
      query += ' WHERE invoice_date >= ?';
      params = [start_date];
    } else if (end_date) {
      query += ' WHERE invoice_date <= ?';
      params = [end_date];
    }
    db.all(query, params, (err, rows) => {
      if (err) return reject({ error: 'DB error' });
      resolve(rows);
    });
  });
}

// --- Sales Insights ---
function getSalesInsights(limit = 500, offset = 0) {
  return new Promise((resolve, reject) => {
    // Get proper log path - use helper function that handles electron availability
    const logPath = getLogPath();
    
    const logMsg = `[${new Date().toISOString()}] getSalesInsights called with limit: ${limit}, offset: ${offset}\n`;
    fs.appendFileSync(logPath, logMsg);
    
    const today = new Date();
    // Show last 12 months of data instead of complex "next month last year" calculation
    const start_date = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const end_date = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const start_date_str = start_date.toISOString().slice(0, 10);
    const end_date_str = end_date.toISOString().slice(0, 10);
    
    // Last month for comparison
    const last_month_start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last_month_end = new Date(today.getFullYear(), today.getMonth(), 1);
    const last_month_start_str = last_month_start.toISOString().slice(0, 10);
    const last_month_end_str = last_month_end.toISOString().slice(0, 10);
    
    const dateLogMsg = `[${new Date().toISOString()}] Date ranges - Main: ${start_date_str} to ${end_date_str}, Last month: ${last_month_start_str} to ${last_month_end_str}\n`;
    fs.appendFileSync(logPath, dateLogMsg);
    const query = `
        SELECT ps.product_name,
               SUM(ps.quantity) as total_quantity,
               COALESCE(p.stock, 0) as current_stock,
               (
                   SELECT SUM(ps2.quantity)
                   FROM product_sales ps2
                   WHERE ps2.product_name = ps.product_name
                     AND ps2.invoice_date >= ?
                     AND ps2.invoice_date < ?
               ) as last_month_sales,
               (
                   SELECT SUM(pri.no_to_order - pri.received_so_far)
                   FROM purchase_request_items pri
                   WHERE pri.product_name = ps.product_name
                     AND (pri.no_to_order - pri.received_so_far) > 0
               ) as currently_ordered
        FROM product_sales ps
        LEFT JOIN products p ON ps.product_id = p.cliniko_id
        WHERE ps.invoice_date >= ? AND ps.invoice_date < ?
        GROUP BY ps.product_name
        ORDER BY total_quantity DESC
        LIMIT ? OFFSET ?
    `;
    const params = [
      last_month_start_str, last_month_end_str,
      start_date_str, end_date_str,
      limit, offset
    ];
    
    const paramsLogMsg = `[${new Date().toISOString()}] getSalesInsights query params: ${JSON.stringify(params)}\n`;
    fs.appendFileSync(logPath, paramsLogMsg);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        const errorLogMsg = `[${new Date().toISOString()}] getSalesInsights DB ERROR: ${err.message || err}\nStack: ${err.stack || 'No stack trace'}\n`;
        fs.appendFileSync(logPath, errorLogMsg);
        return reject({ error: 'DB error', details: err.message || err });
      }
      
      const resultLogMsg = `[${new Date().toISOString()}] getSalesInsights query returned ${rows ? rows.length : 0} rows\n`;
      fs.appendFileSync(logPath, resultLogMsg);
      
      const insights = rows.map(row => ({
        product_name: row.product_name,
        total_quantity: row.total_quantity,
        current_stock: row.current_stock,
        last_month_sales: row.last_month_sales || 0,
        currently_ordered: row.currently_ordered || 0
      }));
      
      const successLogMsg = `[${new Date().toISOString()}] getSalesInsights processed ${insights.length} insights successfully\n`;
      fs.appendFileSync(logPath, successLogMsg);
      resolve(insights);
    });
  });
}

function getSalesInsightsWithCustomRanges(customRanges = [], limit = 500, offset = 0) {
  return new Promise((resolve, reject) => {
    const logPath = getLogPath();
    
    const logMsg = `[${new Date().toISOString()}] getSalesInsightsWithCustomRanges called with customRanges: ${JSON.stringify(customRanges)}, limit: ${limit}, offset: ${offset}\n`;
    fs.appendFileSync(logPath, logMsg);
    
    const today = new Date();
    // Show last 12 months of data instead of complex "next month last year" calculation
    const start_date = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const end_date = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const start_date_str = start_date.toISOString().slice(0, 10);
    const end_date_str = end_date.toISOString().slice(0, 10);
    
    // Last month for comparison
    const last_month_start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last_month_end = new Date(today.getFullYear(), today.getMonth(), 1);
    const last_month_start_str = last_month_start.toISOString().slice(0, 10);
    const last_month_end_str = last_month_end.toISOString().slice(0, 10);
    
    const dateLogMsg = `[${new Date().toISOString()}] Date ranges - Main: ${start_date_str} to ${end_date_str}, Last month: ${last_month_start_str} to ${last_month_end_str}\n`;
    fs.appendFileSync(logPath, dateLogMsg);
    
    // Build custom range subqueries
    const customRangeSelects = customRanges.map((range, index) => `
               (
                   SELECT SUM(ps${index + 3}.quantity)
                   FROM product_sales ps${index + 3}
                   WHERE ps${index + 3}.product_name = ps.product_name
                     AND ps${index + 3}.invoice_date >= ?
                     AND ps${index + 3}.invoice_date <= ?
               ) as custom_range_${index}`).join(',');
    
    const customRangeLogMsg = `[${new Date().toISOString()}] Built custom range selects: ${customRangeSelects}\n`;
    fs.appendFileSync(logPath, customRangeLogMsg);
    
    const query = `
        SELECT ps.product_name,
               SUM(ps.quantity) as total_quantity,
               COALESCE(p.stock, 0) as current_stock,
               (
                   SELECT SUM(ps2.quantity)
                   FROM product_sales ps2
                   WHERE ps2.product_name = ps.product_name
                     AND ps2.invoice_date >= ?
                     AND ps2.invoice_date < ?
               ) as last_month_sales,
               (
                   SELECT SUM(pri.no_to_order - pri.received_so_far)
                   FROM purchase_request_items pri
                   WHERE pri.product_name = ps.product_name
                     AND (pri.no_to_order - pri.received_so_far) > 0
               ) as currently_ordered${customRangeSelects ? ',' + customRangeSelects : ''}
        FROM product_sales ps
        LEFT JOIN products p ON ps.product_id = p.cliniko_id
        WHERE ps.invoice_date >= ? AND ps.invoice_date < ?
        GROUP BY ps.product_name
        ORDER BY total_quantity DESC
        LIMIT ? OFFSET ?
    `;
    
    const params = [
      last_month_start_str, last_month_end_str,
      ...customRanges.flatMap(range => [range.startDate, range.endDate]),
      start_date_str, end_date_str,
      limit, offset
    ];
    
    const paramsLogMsg = `[${new Date().toISOString()}] getSalesInsightsWithCustomRanges query params: ${JSON.stringify(params)}\n`;
    const queryLogMsg = `[${new Date().toISOString()}] Query structure: ${query.substring(0, 300)}...\n`;
    fs.appendFileSync(logPath, paramsLogMsg + queryLogMsg);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        const errorLogMsg = `[${new Date().toISOString()}] getSalesInsightsWithCustomRanges DB ERROR: ${err.message || err}\nStack: ${err.stack || 'No stack trace'}\n`;
        fs.appendFileSync(logPath, errorLogMsg);
        return reject({ error: 'DB error', details: err.message || err });
      }
      
      const resultLogMsg = `[${new Date().toISOString()}] getSalesInsightsWithCustomRanges query returned ${rows ? rows.length : 0} rows\n`;
      fs.appendFileSync(logPath, resultLogMsg);
      
      const insights = rows.map(row => {
        const result = {
          product_name: row.product_name,
          total_quantity: row.total_quantity,
          current_stock: row.current_stock,
          last_month_sales: row.last_month_sales || 0,
          currently_ordered: row.currently_ordered || 0
        };
        
        // Add custom range data
        customRanges.forEach((range, index) => {
          result[`custom_range_${index}`] = row[`custom_range_${index}`] || 0;
        });
        
        return result;
      });
      
      const successLogMsg = `[${new Date().toISOString()}] getSalesInsightsWithCustomRanges processed ${insights.length} insights successfully\n`;
      if (insights.length > 0) {
        const sampleLogMsg = `[${new Date().toISOString()}] Sample insight: ${JSON.stringify(insights[0])}\n`;
        fs.appendFileSync(logPath, successLogMsg + sampleLogMsg);
      } else {
        fs.appendFileSync(logPath, successLogMsg);
      }
      
      resolve(insights);
    });
  });
}

// --- Product Options ---
function getProductOptions(term) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM products WHERE LOWER(name) LIKE ? LIMIT 20', [`%${(term || '').toLowerCase()}%`], (err, rows) => {
      if (err) return reject({ error: 'DB error' });
      const results = rows.map(row => ({
        label: row.name,
        value: row.cliniko_id,
        data: row
      }));
      resolve(results);
    });
  });
}

// --- File Download ---
const uploadDir = path.join(__dirname, 'uploads');
function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    try {
      if (!filename) return reject({ error: 'Missing filename' });

      // If an absolute path was provided, check it directly
      if (path.isAbsolute(filename)) {
        fs.access(filename, fs.constants.F_OK, (err) => {
          if (err) return reject({ error: 'File not found', details: err.message || err });
          return resolve(filename);
        });
        return;
      }

      // Otherwise assume it's a filename located in the uploads directory
      const filePath = path.join(uploadDir, filename);
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) return resolve(filePath);

        // Try a normalized fallback in case filename contains backslashes or odd separators
        const normalized = path.normalize(filename);
        const altPath = path.join(uploadDir, normalized);
        fs.access(altPath, fs.constants.F_OK, (err2) => {
          if (!err2) return resolve(altPath);
          return reject({ error: 'File not found', details: err2 ? err2.message || err2 : err.message || err });
        });
      });
    } catch (e) {
      return reject({ error: 'Failed to download file', details: e.message || e });
    }
  });
}

// --- Authentication ---
// const bcrypt = require('bcryptjs'); // removed duplicate, only require once at the top
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

function login(username, password) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, is_admin, password_hash FROM users WHERE username = ?', [username], async (err, user) => {
      try {
        if (err) {
          console.error('Login DB error:', err);
          return reject({ error: 'DB error', details: err.message || err });
        }
        if (!user) {
          console.warn('Login failed: user not found for username', username);
          return reject({ error: 'Invalid username or password' });
        }
        const hash = user.password_hash || '';
        let match = false;
        try {
          match = await bcrypt.compare(password, hash);
        } catch (bcryptErr) {
          console.error('Bcrypt compare error:', bcryptErr);
          return reject({ error: 'Password check error', details: bcryptErr.message || bcryptErr });
        }
        if (!match) {
          console.warn('Login failed: password mismatch for username', username);
          return reject({ error: 'Invalid username or password' });
        }
        
        // Check if user needs to change default password
        let passwordWarning = null;
        try {
          const warningCheck = await checkDefaultPasswordWarning(username);
          if (warningCheck.needsPasswordChange) {
            passwordWarning = warningCheck.message;
          }
        } catch (warningErr) {
          console.error('Error checking password warning:', warningErr);
        }
        
        let token;
        try {
          token = jwt.sign({ id: user.id, username: user.username, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        } catch (jwtErr) {
          console.error('JWT sign error:', jwtErr);
          return reject({ error: 'Token generation error', details: jwtErr.message || jwtErr });
        }
        
        const response = { token };
        if (passwordWarning) {
          response.passwordWarning = passwordWarning;
          response.needsPasswordChange = true;
        }
        
        resolve(response);
      } catch (e) {
        console.error('Unknown login error:', e);
        return reject({ error: 'Unknown error', details: e.message || e });
      }
    });
  });
}

function getCurrentUser(token) {
  return new Promise((resolve, reject) => {
    if (!token) return reject({ error: 'Missing token' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return reject({ error: 'Invalid token' });
      resolve({ id: user.id, username: user.username, is_admin: user.is_admin });
    });
  });
}

// --- Purchase Requests ---
// Create PR
function createPurchaseRequest(data) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM purchase_requests', (err, row) => {
      if (err) return reject(err);
      const pr_count = (row ? row.count : 0) + 1;
  const pr_id = `PO${String(pr_count).padStart(5, '0')}`;
      const date_created = new Date().toISOString();
      db.run('INSERT INTO purchase_requests (pr_id, date_created, received) VALUES (?, ?, ?)', [pr_id, date_created, 0], function (err2) {
        if (err2) return reject(err2);
        const items = data.items || [];
        if (!items || items.length === 0) return resolve({ id: pr_id });

        // Prepare list of product IDs to prefetch unit_price
        const productIds = Array.from(new Set(items.map(it => (it.Id || it.id || it.product_id)).filter(Boolean)));

        const finalizeInsertions = (priceMap, supplierMap) => {
          let pending = items.length;
          let prTotal = 0;

          items.forEach(item => {
            const product_id = item.Id || item.id || item.product_id || null;
            const product_name = item['Product Name'] || item.name || item.product_name || '';
            
            // Get supplier info: prefer explicit item data, fallback to products table lookup
            let supplier_name = item['Supplier Name'] || item.supplier_name || '';
            let supplier_id = item['Supplier Id'] || item.supplier_id || item.supplierId || null;
            if ((!supplier_name || !supplier_id) && product_id && supplierMap && supplierMap[product_id]) {
              supplier_name = supplier_name || supplierMap[product_id].supplier_name || '';
              supplier_id = supplier_id || supplierMap[product_id].supplier_id || null;
            }
            
            const no_to_order = item['No. to Order'] || item.no_to_order || item.qty || item.quantity || 0;
            const quantity = item.quantity || no_to_order;

            // Determine unit cost: prefer explicit item cost fields (including item.unit_cost), fallback to prefetched products.unit_price
            let unit_cost = Number(item.unit_cost ?? item.unitCost ?? item.cost_price ?? item.unit_price ?? item.cost ?? 0) || 0;
            if (!unit_cost && product_id && priceMap && priceMap[product_id]) {
              unit_cost = Number(priceMap[product_id]) || unit_cost;
            }
            const line_total = Number((unit_cost || 0) * (quantity || 0)) || 0;
            prTotal += line_total;

            // Try full insert; if DB lacks new columns, fallback to minimal insert
            db.run(
              `INSERT INTO purchase_request_items (pr_id, product_id, product_name, supplier_name, supplier_id, no_to_order, quantity, unit_cost, line_total, received, received_so_far, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [pr_id, product_id, product_name, supplier_name, supplier_id, no_to_order, quantity, unit_cost, line_total],
              function (insertErr) {
                if (insertErr) {
                  // Insert failed — likely older DB missing unit_cost/line_total columns.
                  // Try adding the missing columns and retry the full insert once before falling back.
                  db.run(`ALTER TABLE purchase_request_items ADD COLUMN unit_cost REAL DEFAULT 0`, (alterErr1) => {
                    // ignore duplicate column error
                    db.run(`ALTER TABLE purchase_request_items ADD COLUMN line_total REAL DEFAULT 0`, (alterErr2) => {
                      // Retry the full insert
                      db.run(
                        `INSERT INTO purchase_request_items (pr_id, product_id, product_name, supplier_name, supplier_id, no_to_order, quantity, unit_cost, line_total, received, received_so_far, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [pr_id, product_id, product_name, supplier_name, supplier_id, no_to_order, quantity, unit_cost, line_total],
                        function (retryErr) {
                          if (retryErr) {
                            // Still failing — fallback to minimal insert to preserve PR creation
                            db.run(
                              `INSERT INTO purchase_request_items (pr_id, product_name, quantity, received)
                               VALUES (?, ?, ?, 0)`,
                              [pr_id, product_name, quantity],
                              (fallbackErr) => {
                                if (fallbackErr) {
                                  console.error('Fallback insert into purchase_request_items failed:', fallbackErr.message);
                                }
                                if (--pending === 0) {
                                  db.run('UPDATE purchase_requests SET total_cost=? WHERE pr_id=?', [prTotal, pr_id], () => resolve({ id: pr_id, total_cost: prTotal }));
                                }
                              }
                            );
                          } else {
                            if (--pending === 0) {
                              db.run('UPDATE purchase_requests SET total_cost=? WHERE pr_id=?', [prTotal, pr_id], () => resolve({ id: pr_id, total_cost: prTotal }));
                            }
                          }
                        }
                      );
                    });
                  });
                } else {
                  if (--pending === 0) {
                    db.run('UPDATE purchase_requests SET total_cost=? WHERE pr_id=?', [prTotal, pr_id], () => resolve({ id: pr_id, total_cost: prTotal }));
                  }
                }
              }
            );
          });
        };

        if (productIds.length === 0) {
          finalizeInsertions({}, {});
        } else {
          const placeholders = productIds.map(() => '?').join(',');
          // Query by both id and cliniko_id to handle both database ID and Cliniko ID lookups
          db.all(`SELECT id, cliniko_id, unit_price, supplier_name, supplier_id FROM products WHERE id IN (${placeholders}) OR cliniko_id IN (${placeholders})`, [...productIds, ...productIds], (errMap, rows) => {
            const priceMap = {};
            const supplierMap = {};
            if (!errMap && Array.isArray(rows)) {
              rows.forEach(r => { 
                // Index by both id and cliniko_id for flexible lookup
                const idKey = String(r.id);
                const clinikoKey = String(r.cliniko_id);
                priceMap[idKey] = r.unit_price;
                priceMap[clinikoKey] = r.unit_price;
                supplierMap[idKey] = { 
                  supplier_name: r.supplier_name, 
                  supplier_id: r.supplier_id 
                };
                supplierMap[clinikoKey] = { 
                  supplier_name: r.supplier_name, 
                  supplier_id: r.supplier_id 
                };
              });
            }
            finalizeInsertions(priceMap, supplierMap);
          });
        }
      });
    });
  });
}

// Get PRs (active/archived, group by vendor or pr)
function getPurchaseRequests(active_only, group_by) {
  return new Promise((resolve, reject) => {
    if (active_only) {
      db.all('SELECT * FROM purchase_requests WHERE received=0', async (err, prs) => {
        if (err) return reject(err);
        if (!prs || prs.length === 0) return resolve([]);
        const prPromises = prs.map(pr => new Promise((resolve2, reject2) => {
          db.all('SELECT * FROM purchase_request_items WHERE pr_id=?', [pr.pr_id], (err2, all_items) => {
            if (err2) return reject2(err2);
            let items = all_items.map(row => ({
              'id': row.id,
              'Product Name': row.product_name,
              'Supplier Name': row.supplier_name,
              'No. to Order': row.no_to_order,
              'received': row.received,
              'received_so_far': row.received_so_far,
              'Unit Cost': row.unit_cost,
              'Line Total': row.line_total,
              // also expose snake_case keys for renderer convenience
              unit_cost: row.unit_cost,
              line_total: row.line_total,
              no_to_order: row.no_to_order,
              quantity: row.quantity,
              product_id: row.product_id,
              'pr_id': pr.pr_id,
              'date_created': pr.date_created,
              'date_received': pr.date_received
            }));
            resolve2({
                  id: pr.pr_id,
              date_created: pr.date_created,
              date_received: pr.date_received,
                  emails_sent: pr.emails_sent || 0,
              received: pr.received,
              total_cost: pr.total_cost || 0,
              items
            });
          });
        }));
        let pr_list;
        try {
          pr_list = await Promise.all(prPromises);
        } catch (e) {
          return reject(e);
        }
        if (group_by === 'vendor') {
          const vendor_dict = {};
          for (const pr of pr_list) {
            for (const item of pr.items) {
              const vendor = item['Supplier Name'] || 'Unknown Vendor';
              if (!vendor_dict[vendor]) vendor_dict[vendor] = [];
              vendor_dict[vendor].push(item);
            }
          }
          for (const vendor in vendor_dict) {
            vendor_dict[vendor] = vendor_dict[vendor].filter(item => (item['received_so_far'] ?? 0) < (item['No. to Order'] ?? 0));
            if (vendor_dict[vendor].length === 0) delete vendor_dict[vendor];
          }
          return resolve(vendor_dict);
        } else {
          return resolve(pr_list);
        }
      });
    } else {
      db.all('SELECT * FROM purchase_requests WHERE received=1', (err, prs) => {
        if (err) return reject(err);
        let pr_list = [];
        let pending = prs.length;
        if (pending === 0) return resolve([]);
        prs.forEach(pr => {
          db.all('SELECT * FROM purchase_request_items WHERE pr_id=?', [pr.pr_id], (err2, pr_items) => {
            let items = [];
            pr_items.forEach(row => {
              items.push({
                'id': row.id,
                'Product Name': row.product_name,
                'Supplier Name': row.supplier_name,
                'No. to Order': row.no_to_order,
                'received': row.received,
                'received_so_far': row.received_so_far,
                'Unit Cost': row.unit_cost,
                'Line Total': row.line_total,
                // snake_case aliases
                unit_cost: row.unit_cost,
                line_total: row.line_total,
                no_to_order: row.no_to_order,
                quantity: row.quantity,
                product_id: row.product_id,
                'pr_id': pr.pr_id,
                'date_created': pr.date_created,
                'date_received': pr.date_received
              });
            });
            pr_list.push({
              id: pr.pr_id,
              emails_sent: pr.emails_sent || 0,
              date_created: pr.date_created,
              date_received: pr.date_received,
              received: pr.received,
              total_cost: pr.total_cost || 0,
              items
            });
            if (--pending === 0) {
              return resolve(pr_list);
            }
          });
        });
      });
    }
  });
}

// Delete PR
function deletePurchaseRequest(pr_id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM purchase_request_items WHERE pr_id=?', [pr_id], () => {
      db.run('DELETE FROM purchase_requests WHERE pr_id=?', [pr_id], () => {
        resolve({ message: 'Purchase request deleted' });
      });
    });
  });
}

// Get single PR by ID
function getPurchaseRequestById(pr_id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM purchase_requests WHERE pr_id=?', [pr_id], (err, pr) => {
      if (err) {
        console.error('Error getting purchase request:', err);
        reject(err);
        return;
      }
      if (!pr) {
        resolve(null);
        return;
      }
      
      // Get items for this PR
      db.all('SELECT * FROM purchase_request_items WHERE pr_id=?', [pr_id], (err, items) => {
        if (err) {
          console.error('Error getting purchase request items:', err);
          reject(err);
          return;
        }
        
        pr.items = items || [];
        resolve(pr);
      });
    });
  });
}

// Set purchase request as received
function setPurchaseRequestReceived(pr_id, updates) {
  return new Promise((resolve, reject) => {
    const { date_received, received } = updates;
    db.run(
      'UPDATE purchase_requests SET date_received=?, received=? WHERE pr_id=?',
      [date_received, received, pr_id],
      function(err) {
        if (err) {
          console.error('Error updating purchase request received status:', err);
          reject(err);
          return;
        }
        resolve({ message: 'Purchase request marked as received', changes: this.changes });
      }
    );
  });
}

// Update reorder levels (bulk)
function updateReorderLevels(updates) {
  return new Promise((resolve, reject) => {
    let pending = updates.length;
    if (pending === 0) return resolve({ message: 'Reorder levels updated successfully' });
    updates.forEach(update => {
      const cliniko_id = update.cliniko_id;
      const reorder_level = update.reorder_level || 0;
      db.get('SELECT reorder_level FROM products WHERE cliniko_id=?', [cliniko_id], (err, row) => {
        if (err || !row) {
          if (--pending === 0) resolve({ message: 'Reorder levels updated successfully (some errors)' });
          return;
        }
        const old_level = row.reorder_level;
        db.run('UPDATE products SET reorder_level=? WHERE cliniko_id=?', [reorder_level, cliniko_id], () => {
          if (old_level !== reorder_level) {
            db.run('INSERT INTO product_change_log (product_id, field_changed, before_value, after_value, timestamp) VALUES (?, ?, ?, ?, ?)',
              [cliniko_id, 'reorder_level', String(old_level), String(reorder_level), new Date().toISOString()],
              () => {
                if (--pending === 0) resolve({ message: 'Reorder levels updated successfully' });
              }
            );
          } else {
            if (--pending === 0) resolve({ message: 'Reorder levels updated successfully' });
          }
        });
      });
    });
  });
}

// Update reorder level for a product
function updateProductReorderLevel(product_id, new_level) {
  return new Promise((resolve, reject) => {
    if (new_level === undefined || typeof new_level !== 'number' || new_level < 0) {
      return reject(new Error('Invalid reorder level'));
    }
    db.get('SELECT reorder_level FROM products WHERE cliniko_id = ?', [product_id], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Product not found'));
      const old_level = row.reorder_level;
      if (old_level === new_level) return resolve({ message: 'No change to reorder level' });
      db.run('UPDATE products SET reorder_level = ? WHERE cliniko_id = ?', [new_level, product_id], () => {
        db.run('INSERT INTO product_change_log (product_id, field_changed, before_value, after_value, timestamp) VALUES (?, ?, ?, ?, ?)',
          [product_id, 'reorder_level', String(old_level), String(new_level), new Date().toISOString()],
          () => resolve({ message: 'Reorder level updated' })
        );
      });
    });
  });
}

// Update barcode for a product
function updateProductBarcode(product_id, new_barcode) {
  return new Promise((resolve, reject) => {
    if (new_barcode === undefined || new_barcode === null) {
      return reject(new Error('Invalid barcode'));
    }
    // Convert to string and trim
    new_barcode = String(new_barcode).trim();
    
    db.get('SELECT barcode FROM products WHERE cliniko_id = ?', [product_id], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Product not found'));
      const old_barcode = row.barcode || '';
      if (old_barcode === new_barcode) return resolve({ message: 'No change to barcode' });
      db.run('UPDATE products SET barcode = ? WHERE cliniko_id = ?', [new_barcode, product_id], () => {
        db.run('INSERT INTO product_change_log (product_id, field_changed, before_value, after_value, timestamp) VALUES (?, ?, ?, ?, ?)',
          [product_id, 'barcode', old_barcode, new_barcode, new Date().toISOString()],
          () => resolve({ message: 'Barcode updated' })
        );
      });
    });
  });
}

// Update reorder levels from uploaded file (Excel/CSV)
function updateReorderLevelsFromFile(fileData) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fileData || !fileData.content || !fileData.name) {
        return reject({ error: 'Invalid file data' });
      }

      // Convert array back to Buffer
      const buffer = Buffer.from(fileData.content);
      const fileName = fileData.name.toLowerCase();
      
      let worksheet;
      let updates = [];
      
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Handle Excel files
        const XLSX = require('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } else if (fileName.endsWith('.csv')) {
        // Handle CSV files
        const csvContent = buffer.toString('utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          return reject({ error: 'CSV file must have at least a header row and one data row' });
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        worksheet = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
      } else {
        return reject({ error: 'Unsupported file format. Please use .xlsx, .xls, or .csv files.' });
      }
      
      // Process the worksheet data
      // Expected columns: Product Name, Product ID, Cliniko ID, Reorder Level
      // We'll be flexible about column names
      for (const row of worksheet) {
        let cliniko_id = null;
        let reorder_level = null;
        let product_name = null;
        
        // Try to find cliniko_id from various possible column names
        const clinikoIdFields = ['cliniko_id', 'Cliniko ID', 'ID', 'Product ID', 'cliniko id'];
        for (const field of clinikoIdFields) {
          if (row[field] !== undefined && row[field] !== '') {
            cliniko_id = row[field];
            break;
          }
        }
        
        // Try to find product name from various possible column names
        const nameFields = ['name', 'Name', 'Product Name', 'product_name', 'Product'];
        for (const field of nameFields) {
          if (row[field] !== undefined && row[field] !== '') {
            product_name = row[field];
            break;
          }
        }
        
        // Try to find reorder level from various possible column names
        const reorderFields = ['reorder_level', 'Reorder Level', 'Reorder', 'Min Stock', 'Minimum Stock'];
        for (const field of reorderFields) {
          if (row[field] !== undefined && row[field] !== '') {
            const parsed = parseInt(row[field]);
            if (!isNaN(parsed) && parsed >= 0) {
              reorder_level = parsed;
              break;
            }
          }
        }
        
        // If we have either cliniko_id or product_name, and a reorder_level, try to update
        if ((cliniko_id || product_name) && reorder_level !== null) {
          // If we only have product name, try to find the cliniko_id
          if (!cliniko_id && product_name) {
            await new Promise((resolveFind) => {
              db.get('SELECT cliniko_id FROM products WHERE name = ?', [product_name], (err, productRow) => {
                if (!err && productRow) {
                  cliniko_id = productRow.cliniko_id;
                }
                resolveFind();
              });
            });
          }
          
          if (cliniko_id) {
            updates.push({
              cliniko_id: cliniko_id,
              reorder_level: reorder_level
            });
          }
        }
      }
      
      if (updates.length === 0) {
        return reject({ error: 'No valid product updates found in file. Please check column names and data format.' });
      }
      
      // Use existing updateReorderLevels function to perform the updates
      const result = await updateReorderLevels(updates);
      resolve({ 
        message: `Successfully updated reorder levels for ${updates.length} products.`,
        updatedCount: updates.length 
      });
      
    } catch (error) {
      console.error('Error processing file:', error);
      reject({ error: 'Failed to process file', details: error.message });
    }
  });
}

// Generate CSV template for reorder levels
function generateReorderLevelsTemplate() {
  return new Promise((resolve, reject) => {
    try {
      // Get all products with their current data
      db.all('SELECT cliniko_id, name, reorder_level FROM products ORDER BY name', [], (err, products) => {
        if (err) {
          return reject({ error: 'Failed to fetch products', details: err.message });
        }
        
        // Create CSV content
        let csvContent = 'Cliniko ID,Product Name,Reorder Level\n';
        
        products.forEach(product => {
          const clinikoId = product.cliniko_id || '';
          const productName = `"${(product.name || '').replace(/"/g, '""')}"`;  // Escape quotes
          const reorderLevel = product.reorder_level || 0;
          
          csvContent += `${clinikoId},${productName},${reorderLevel}\n`;
        });
        
        resolve({
          success: true,
          filename: `reorder_levels_template_${new Date().toISOString().slice(0, 10)}.csv`,
          content: csvContent,
          mimeType: 'text/csv'
        });
      });
    } catch (error) {
      reject({ error: 'Failed to generate template', details: error.message });
    }
  });
}

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const { runMigrations, backupDatabase, getCurrentVersion, CURRENT_DB_VERSION } = require('./migrations');

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'default-app-secret-key', 'salt', 32);

// Encryption/Decryption functions
function encryptApiKey(plaintext) {
  console.log('Encrypting plaintext:', plaintext.substring(0, 10) + '...');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const result = {
    encrypted: encrypted,
    iv: iv.toString('hex')
  };
  console.log('Encryption result:', { encrypted: result.encrypted.substring(0, 20) + '...', iv: result.iv });
  return result;
}

function decryptApiKey(encryptedData) {
  if (typeof encryptedData === 'string') {
    // Handle legacy plain text API keys
    console.log('Found legacy plain text API key');
    return encryptedData;
  }
  
  console.log('Decrypting encrypted data:', { encrypted: encryptedData.encrypted.substring(0, 20) + '...', iv: encryptedData.iv });
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, Buffer.from(encryptedData.iv, 'hex'));
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  console.log('Decryption successful:', decrypted.substring(0, 10) + '...');
  return decrypted;
}

// Allow external setting of database path (for Electron)
let dbPath = process.env.DB_PATH || path.join(__dirname, 'appdata.db');

const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Failed to connect to database:', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    
    try {
      // Conditional migrations: only run if on-disk DB schema version is older than expected
      try {
        const diskVersion = await getCurrentVersion(db);
        if (typeof diskVersion === 'number' && diskVersion < CURRENT_DB_VERSION) {
          console.log(`Database version ${diskVersion} < expected ${CURRENT_DB_VERSION} — running migrations`);
          await backupDatabase(dbPath);
          await runMigrations(db);
        } else if (typeof diskVersion === 'number' && diskVersion > CURRENT_DB_VERSION) {
          console.warn(`Database version ${diskVersion} is newer than app expected ${CURRENT_DB_VERSION}; skipping migrations to avoid potential downgrade`);
        } else {
          console.log('Database schema version matches expected; no migrations needed');
        }
      } catch (mErr) {
        console.error('Failed to determine DB version or run conditional migrations, falling back to running migrations:', mErr);
        // As a last resort attempt to run migrations (this preserves previous behavior)
        try { await backupDatabase(dbPath); } catch (e) {}
        await runMigrations(db);
      }
      
      // Ensure settings table exists
      db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Ensure product_sales table exists with proper unique constraint
      db.run(`CREATE TABLE IF NOT EXISTS product_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id TEXT,
        invoice_date TEXT,
        product_id TEXT,
        product_name TEXT,
        quantity INTEGER,
        UNIQUE(invoice_id, product_id)
      )`);
      
      // Ensure item_receipt_log table exists
      db.run(`CREATE TABLE IF NOT EXISTS item_receipt_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id TEXT,
        product_id TEXT,
        product_name TEXT,
        quantity_received INTEGER,
        received_by TEXT,
        timestamp TEXT,
        extra_json TEXT
      )`);
      
      // User behavior tracking tables
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
      )`);
      
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
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        preference_key TEXT,
        preference_value TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(user_id, preference_key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
      
      // Create core application tables if they don't exist
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        barcode TEXT,
        cliniko_id TEXT,
        reorder_level INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  -- Backwards-compatible columns: 'stock' and 'supplier_name' may be used by newer code
  stock INTEGER DEFAULT 0,
  supplier_name TEXT,
  unit_price REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Purchase requests table: pr_id is a string identifier like 'PUR00001'
      db.run(`CREATE TABLE IF NOT EXISTS purchase_requests (
        pr_id TEXT PRIMARY KEY,
        date_created TEXT,
        date_received TEXT,
        received INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  total_cost REAL DEFAULT 0
      )`);

      // Purchase request items: include both legacy "quantity" and the app-expected fields
      // product_id and supplier_name/supplier_id are persisted so vendor grouping works reliably.
      db.run(`CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_id TEXT,
        product_id TEXT,
        product_name TEXT,
        supplier_name TEXT,
        supplier_id INTEGER,
        no_to_order INTEGER DEFAULT 0,
        quantity INTEGER DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
        received INTEGER DEFAULT 0,
        received_so_far INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pr_id) REFERENCES purchase_requests(pr_id)
      )`);
      
      // Create suppliers table for managing vendor contact information
      db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        email TEXT,
        contact_name TEXT,
        account_number TEXT,
        special_instructions TEXT,
        source TEXT DEFAULT 'Manual',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Add source column if it doesn't exist (for existing databases)
      db.run(`ALTER TABLE suppliers ADD COLUMN source TEXT DEFAULT 'Manual'`, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding source column to suppliers table:', err);
        } else {
          // Migrate existing suppliers that were auto-populated from Cliniko
          db.run(`UPDATE suppliers 
                   SET source = 'Cliniko', 
                       comments = '', 
                       updated_at = datetime('now') 
                   WHERE comments = 'Auto-populated from Cliniko product sync'`, 
            function(err) {
              if (err) {
                console.error('Error migrating existing suppliers:', err);
              } else if (this.changes > 0) {
                console.log(`✅ Migrated ${this.changes} existing auto-populated suppliers`);
              }
            }
          );
          
          // Add special_instructions column and migrate comments data
          db.run(`ALTER TABLE suppliers ADD COLUMN special_instructions TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('Error adding special_instructions column:', err);
            } else {
              // Migrate existing comments to special_instructions
              db.run(`UPDATE suppliers SET special_instructions = comments WHERE comments IS NOT NULL AND comments != ''`, 
                function(err) {
                  if (err) {
                    console.error('Error migrating comments to special_instructions:', err);
                  } else if (this.changes > 0) {
                    console.log(`✅ Migrated ${this.changes} supplier comments to special_instructions`);
                  }
                }
              );
            }
          });
          
          // Ensure suppliers have an 'active' column (1 = active, 0 = inactive).
          // Older databases may not have this column; add it and initialize existing rows to active.
          db.run(`ALTER TABLE suppliers ADD COLUMN active INTEGER DEFAULT 1`, (err) => {
            // SQLite reports 'duplicate column name' if column already exists - ignore that
            if (err && !err.message.includes('duplicate column name')) {
              console.error('Error adding active column to suppliers table:', err);
            } else {
              // Set any NULL active fields to 1 to ensure existing suppliers are active by default
              db.run(`UPDATE suppliers SET active = 1 WHERE active IS NULL`, function (uErr) {
                if (uErr) {
                  console.error('Error initializing suppliers.active values:', uErr);
                } else if (this.changes > 0) {
                  console.log(`✅ Initialized active flag for ${this.changes} existing suppliers`);
                }
              });
            }
          });

            // Ensure suppliers have an 'account_number' column
            db.run(`ALTER TABLE suppliers ADD COLUMN account_number TEXT`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding account_number column to suppliers table:', err);
              }
            });

  // Backwards-compatible schema migrations for purchase_requests and purchase_request_items
  // Add missing columns if they don't exist (SQLite will error on duplicate columns; ignore those errors)
  db.run(`ALTER TABLE purchase_requests ADD COLUMN date_created TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding date_created to purchase_requests:', err); });
  db.run(`ALTER TABLE purchase_requests ADD COLUMN date_received TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding date_received to purchase_requests:', err); });
  db.run(`ALTER TABLE purchase_requests ADD COLUMN received INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding received to purchase_requests:', err); });
  db.run(`ALTER TABLE purchase_requests ADD COLUMN updated_at TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding updated_at to purchase_requests:', err); });
  // Flags for generated files on PRs
  db.run(`ALTER TABLE purchase_requests ADD COLUMN supplier_files_created INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding supplier_files_created to purchase_requests:', err); });
  db.run(`ALTER TABLE purchase_requests ADD COLUMN oft_files_created INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding oft_files_created to purchase_requests:', err); });
  db.run(`ALTER TABLE purchase_requests ADD COLUMN total_cost REAL DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding total_cost to purchase_requests:', err); });

  // purchase_request_items additions
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN product_id TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding product_id to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN supplier_name TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding supplier_name to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN supplier_id INTEGER`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding supplier_id to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN no_to_order INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding no_to_order to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN quantity INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding quantity to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN unit_cost REAL DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding unit_cost to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN line_total REAL DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding line_total to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN received_so_far INTEGER DEFAULT 0`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding received_so_far to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding created_at to purchase_request_items:', err); });
  db.run(`ALTER TABLE purchase_request_items ADD COLUMN updated_at TEXT`, (err) => { if (err && !err.message.includes('duplicate column name')) console.error('Error adding updated_at to purchase_request_items:', err); });
  // Ensure products table has columns expected by newer sync code
  db.run(`ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding stock column to products table:', err);
    }
  });
  db.run(`ALTER TABLE products ADD COLUMN supplier_name TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding supplier_name column to products table:', err);
    }
  });
        }
      });
      console.log('✅ Database initialization completed');
    } catch (migrationError) {
      console.error('❌ Database migration failed:', migrationError);
      process.exit(1);
    }
  }
});

// --- API Key Management ---
function getApiKey() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve({ api_key: !!(row && row.value) }); // Do not return actual key for security
    });
  });
}

// Auto-deactivate setting for Cliniko suppliers
function getAutoDeactivateClinikoSuppliers() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['auto_deactivate_cliniko_suppliers'], (err, row) => {
      if (err) return reject(err);
      // Default to 'true' if not explicitly set
      const value = row && row.value ? row.value : 'true';
      resolve({ enabled: value === 'true' });
    });
  });
}

function setAutoDeactivateClinikoSuppliers(enabled) {
  return new Promise((resolve, reject) => {
    const value = enabled ? 'true' : 'false';
    db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', ['auto_deactivate_cliniko_suppliers', value], function (err) {
      if (err) return reject(err);
      resolve({ success: true, enabled: enabled });
    });
  });
}

// Internal function to get the actual decrypted API key for API calls
function getActualApiKey() {
  return new Promise((resolve, reject) => {
    console.log('🔑 getActualApiKey() called - fetching API key from database...');
    db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
      if (err) {
        console.error('❌ Database error getting API key:', err);
        return reject(err);
      }
      if (!row || !row.value) {
        console.error('❌ No API key found in database');
        return reject({ error: 'No API key found' });
      }
      
      console.log('📥 Raw value from database:', row.value.substring(0, 50) + '...');
      
      try {
        // Try to parse as JSON (encrypted format)
        let decryptedKey;
        try {
          console.log('🔍 Attempting to parse as JSON (encrypted format)...');
          const encryptedData = JSON.parse(row.value);
          console.log('✅ Successfully parsed as JSON - decrypting...');
          console.log('🔐 Encrypted data structure:', { 
            hasEncrypted: !!encryptedData.encrypted, 
            hasIv: !!encryptedData.iv,
            encryptedLength: encryptedData.encrypted ? encryptedData.encrypted.length : 0
          });
          decryptedKey = decryptApiKey(encryptedData);
          console.log('🔓 Decryption successful! Key starts with:', decryptedKey.substring(0, 15) + '...');
        } catch (parseError) {
          // If parsing fails, assume it's a legacy plain text key
          console.log('⚠️  JSON parsing failed - assuming legacy plain text key');
          console.log('📄 Parse error:', parseError.message);
          decryptedKey = row.value;
          console.warn('Found plain text API key - consider re-saving to encrypt it');
        }
        
        console.log('✅ Returning decrypted API key (length:', decryptedKey.length, ')');
        resolve(decryptedKey);
      } catch (decryptionError) {
        console.error('❌ Decryption failed:', decryptionError);
        return reject({ error: 'Failed to decrypt API key', details: decryptionError.message });
      }
    });
  });
}

function setApiKey(newKey) {
  return new Promise((resolve, reject) => {
    if (!newKey || typeof newKey !== 'string' || !newKey.trim()) {
      return reject({ error: 'Missing or invalid API key' });
    }
    
    try {
      // Encrypt the API key before storing
      const encryptedData = encryptApiKey(newKey.trim());
      const encryptedString = JSON.stringify(encryptedData);
      console.log('Encrypting API key:', { 
        original: newKey.trim().substring(0, 10) + '...', 
        encrypted: encryptedString.substring(0, 50) + '...' 
      });
      
      const timestamp = new Date().toISOString();
      db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', 
        ['CLINIKO_API_KEY', encryptedString, timestamp], function (err) {
        if (err) return reject(err);
        console.log('API key encrypted and saved successfully');
        resolve({ message: 'API key updated and encrypted' });
      });
    } catch (encryptionError) {
      console.error('Encryption error:', encryptionError);
      return reject({ error: 'Failed to encrypt API key', details: encryptionError.message });
    }
  });
}

// --- GitHub Token Management ---
function getGitHubToken() {
  return new Promise((resolve, reject) => {
    console.log('🔑 getGitHubToken() called - fetching GitHub token from database...');
    db.get('SELECT value FROM settings WHERE key = ?', ['GITHUB_TOKEN'], (err, row) => {
      if (err) {
        console.error('❌ Database error getting GitHub token:', err);
        return reject(err);
      }
      if (!row || !row.value) {
        console.log('⚠️ No GitHub token found in database');
        return resolve({ token: null });
      }
      
      console.log('📥 Raw GitHub token from database (first 20 chars):', row.value.substring(0, 20) + '...');
      
      try {
        // Try to parse as JSON (encrypted format)
        let decryptedToken;
        try {
          console.log('🔍 Attempting to parse GitHub token as JSON (encrypted format)...');
          const encryptedData = JSON.parse(row.value);
          console.log('✅ Successfully parsed GitHub token as JSON - decrypting...');
          decryptedToken = decryptApiKey(encryptedData);
          console.log('🔓 GitHub token decryption successful! Token starts with:', decryptedToken.substring(0, 15) + '...');
        } catch (parseError) {
          // If parsing fails, assume it's a legacy plain text token
          console.log('⚠️ GitHub token JSON parsing failed - assuming legacy plain text token');
          decryptedToken = row.value;
          console.warn('Found plain text GitHub token - consider re-saving to encrypt it');
        }
        
        console.log('✅ Returning decrypted GitHub token (length:', decryptedToken.length, ')');
        resolve({ token: decryptedToken });
      } catch (decryptionError) {
        console.error('❌ GitHub token decryption failed:', decryptionError);
        return reject({ error: 'Failed to decrypt GitHub token', details: decryptionError.message });
      }
    });
  });
}

function setGitHubToken(newToken) {
  return new Promise((resolve, reject) => {
    if (!newToken || typeof newToken !== 'string' || !newToken.trim()) {
      return reject({ error: 'Missing or invalid GitHub token' });
    }
    
    const trimmedToken = newToken.trim();
    
    // Validate token format (GitHub personal access tokens start with ghp_)
    if (!trimmedToken.startsWith('ghp_')) {
      return reject({ error: 'Invalid GitHub token format. Personal access tokens should start with "ghp_"' });
    }
    
    try {
      // Encrypt the GitHub token before storing
      const encryptedData = encryptApiKey(trimmedToken);
      const encryptedString = JSON.stringify(encryptedData);
      console.log('Encrypting GitHub token:', { 
        original: trimmedToken.substring(0, 15) + '...', 
        encrypted: encryptedString.substring(0, 50) + '...' 
      });
      
      const timestamp = new Date().toISOString();
      db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', 
        ['GITHUB_TOKEN', encryptedString, timestamp], function (err) {
        if (err) return reject(err);
        console.log('GitHub token encrypted and saved successfully');
        resolve({ message: 'GitHub token updated and encrypted' });
      });
    } catch (encryptionError) {
      console.error('GitHub token encryption error:', encryptionError);
      return reject({ error: 'Failed to encrypt GitHub token', details: encryptionError.message });
    }
  });
}

// Example: Get all products
function getAllProducts() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM products', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Get all products with wrapper for error handling
function getAllProductsWithWrapper() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM products ORDER BY name', (err, rows) => {
      if (err) {
        console.error('Error getting products:', err);
        return reject({ error: 'Failed to get products', details: err.message });
      }
      resolve({ products: rows });
    });
  });
}

function getProductCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (err) {
        console.error('Error getting product count:', err);
        return reject({ error: 'Failed to get product count', details: err.message });
      }
      resolve(row ? row.count : 0);
    });
  });
}

// Example: Add user
function addUser(username, password_hash, is_admin) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
      [username, password_hash, is_admin ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        resolve({ message: 'User added' });
      }
    );
  });
}

// Check if this is first time setup (no users exist)
function isFirstTimeSetup() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
      if (err) return reject(err);
      resolve({ isFirstTime: row.count === 0 });
    });
  });
}

// Create the first admin user during setup
function createFirstAdminUser(username, password) {
  return new Promise(async (resolve, reject) => {
    if (!username || !password || username.length < 3 || password.length < 4) {
      return reject({ error: 'Username must be at least 3 characters and password at least 4 characters' });
    }

    try {
      // Double-check no users exist
      const firstTimeCheck = await isFirstTimeSetup();
      if (!firstTimeCheck.isFirstTime) {
        return reject({ error: 'Setup already completed. Users already exist.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
        [username, hashedPassword, 1],
        function (err) {
          if (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
              return reject({ error: 'Username already exists' });
            }
            return reject({ error: 'Database error', details: err.message });
          }
          console.log(`✅ First admin user created: ${username}`);
          resolve({ 
            message: 'Admin user created successfully',
            userId: this.lastID,
            username: username
          });
        }
      );
    } catch (hashError) {
      reject({ error: 'Password hashing error', details: hashError.message });
    }
  });
}

// Create default admin user if no users exist
function createDefaultAdminUser() {
  db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
    if (err) {
      console.error('Error checking user count:', err);
      return;
    }
    
    if (row.count === 0) {
      try {
        const hashedPassword = await bcrypt.hash('admin', 10);
        db.run(
          'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
          ['Administrator', hashedPassword, 1],
          function (err) {
            if (err) {
              console.error('Error creating default admin user:', err);
            } else {
              console.log('✅ Default admin user created (username: Administrator, password: admin)');
              console.log('⚠️  SECURITY WARNING: Please change the default password immediately!');
              
              // Set a flag to remind user to change password
              db.run(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                ['default_password_warning', 'true'],
                (err) => {
                  if (err) console.error('Error setting password warning flag:', err);
                }
              );
            }
          }
        );
      } catch (hashError) {
        console.error('Error hashing default admin password:', hashError);
      }
    }
  });
}

// Check if user is using default password and needs to change it
function checkDefaultPasswordWarning(username) {
  return new Promise((resolve, reject) => {
    // First check if warning flag is set
    db.get('SELECT value FROM settings WHERE key = ?', ['default_password_warning'], (err, setting) => {
      if (err) return reject(err);
      
      if (!setting || setting.value !== 'true') {
        return resolve({ needsPasswordChange: false });
      }
      
      // Check if this user is "Administrator" and still has default password
      if (username === 'Administrator') {
        db.get('SELECT password_hash FROM users WHERE username = ?', [username], async (err, user) => {
          if (err) return reject(err);
          if (!user) return resolve({ needsPasswordChange: false });
          
          try {
            // Check if current password is still "admin"
            const isDefaultPassword = await bcrypt.compare('admin', user.password_hash);
            resolve({ 
              needsPasswordChange: isDefaultPassword,
              username: username,
              message: isDefaultPassword ? 'Please change your default password for security.' : null
            });
          } catch (compareError) {
            reject(compareError);
          }
        });
      } else {
        resolve({ needsPasswordChange: false });
      }
    });
  });
}

// Clear the default password warning (call after password change)
function clearDefaultPasswordWarning() {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM settings WHERE key = ?',
      ['default_password_warning'],
      function (err) {
        if (err) return reject(err);
        console.log('✅ Default password warning cleared');
        resolve({ message: 'Password warning cleared' });
      }
    );
  });
}

// Example: Get all users
function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, username, is_admin FROM users', [], (err, rows) => {
      if (err) return reject(err);
      const users = rows.map(r => ({
        id: r.id,
        username: r.username,
        is_admin: !!r.is_admin
      }));
      resolve(users);
    });
  });
}


// --- Update received quantities for a purchase request ---
function updatePurchaseRequestReceived(pr_id, lines, receivedBy = null, comment = '') {
  return new Promise((resolve, reject) => {
    if (!pr_id || !Array.isArray(lines) || lines.length === 0) {
      return reject({ error: 'Missing PR ID or lines' });
    }
    if (!comment || String(comment).trim().length < 3) return reject({ error: 'A reason/comment is required (min 3 chars)' });
    // Capture before-snapshot for auditing
    db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [pr_id], (preErr, prBefore) => {
      // Even if we can't read the PR, continue with best-effort (prBefore may be null)
      db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [pr_id], (preErr2, itemsBefore) => {
        const beforeSnapshot = { purchase_request: prBefore || null, items: itemsBefore || [] };

        let pending = lines.length;
        lines.forEach(line => {
          // Find the item by product name and PR ID
          const newlyReceived = Math.max(0, Number(line.newlyReceived) || 0);
          db.get('SELECT received_so_far, no_to_order, product_id FROM purchase_request_items WHERE pr_id=? AND product_name=?', [pr_id, line.productName], (err, row) => {
            if (err || !row) {
              pending--;
              if (pending === 0) resolve({ message: 'Updated with errors' });
              return;
            }
            const totalReceived = Math.min(row.no_to_order, (row.received_so_far || 0) + newlyReceived);
            const isFullyReceived = totalReceived >= row.no_to_order ? 1 : 0;
            db.run('UPDATE purchase_request_items SET received_so_far=?, received=? WHERE pr_id=? AND product_name=?', [totalReceived, isFullyReceived, pr_id, line.productName], (err2) => {
              // Log the receipt event
              db.run('INSERT INTO item_receipt_log (pr_id, product_id, product_name, quantity_received, received_by, timestamp, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                  pr_id,
                  row.product_id,
                  line.productName,
                  newlyReceived,
                  receivedBy || line.receivedBy || null,
                  new Date().toISOString(),
                  JSON.stringify(line)
                ],
                () => {
                  pending--;
                  if (pending === 0) {
                    // After all lines processed, read after snapshot and insert a single po_change_log entry
                    db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [pr_id], (gErr, prAfter) => {
                      db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [pr_id], (err3, allItems) => {
                        if (!err3) {
                          const afterSnapshot = { purchase_request: prAfter || null, items: allItems || [] };
                          try {
                            db.run('INSERT INTO po_change_log (pr_id, changed_by, comment, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                              [pr_id, receivedBy || null, String(comment).trim(), JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), new Date().toISOString()], (logErr) => {
                                if (logErr) console.warn('Failed to insert po_change_log for receipt:', logErr);
                              });
                          } catch (e) {
                            console.warn('Failed to write po_change_log for receipt:', e);
                          }
                        }

                        // Check if ALL items in this PR are fully received
                        if (err3) return resolve({ message: 'Updated but could not check PR status' });
                        const allFullyReceived = (allItems || []).every(item => (item.received_so_far || 0) >= item.no_to_order);
                        if (allFullyReceived) {
                          db.run('UPDATE purchase_requests SET received=1, date_received=? WHERE pr_id=?', [new Date().toISOString(), pr_id], () => {
                            resolve({ message: 'PR fully received' });
                          });
                        } else {
                          resolve({ message: 'PR partially received' });
                        }
                      });
                    });
                  }
                }
              );
            });
          });
        });
      });
    });
  });
}

/**
 * Atomically update purchase_request_items (received quantities) with a required comment and record a single po_change_log entry
 * This is used to ensure item-level changes are auditable.
 * @param {string} prId
 * @param {Array} lines - [{ productName, newlyReceived }]
 * @param {string} changedBy
 * @param {string} comment
 */
function updatePurchaseRequestItemsWithComment(prId, lines, changedBy = null, comment = '') {
  return new Promise((resolve, reject) => {
    if (!prId || !Array.isArray(lines) || lines.length === 0) return reject({ error: 'Missing parameters' });
    if (!comment || String(comment).trim().length < 3) return reject({ error: 'A reason/comment is required (min 3 chars)' });

    // Fetch full PR and items for before snapshot
    db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (err, prRow) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      if (!prRow) return reject({ error: 'Purchase request not found' });

      db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [prId], (iErr, itemsBefore) => {
        if (iErr) return reject({ error: 'DB error', details: iErr.message });

        const beforeSnapshot = { purchase_request: prRow, items: itemsBefore };

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Sequentially apply each line update
          const applyLine = (idx) => {
            if (idx >= lines.length) {
              // After applying lines, compute after snapshot
              db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (gErr, prAfter) => {
                if (gErr) return db.run('ROLLBACK', () => reject({ error: 'Failed to read PR after update', details: gErr.message }));
                db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [prId], (gErr2, itemsAfter) => {
                  if (gErr2) return db.run('ROLLBACK', () => reject({ error: 'Failed to read items after update', details: gErr2.message }));

                  const afterSnapshot = { purchase_request: prAfter, items: itemsAfter };

                  // Insert single audit log
                  db.run('INSERT INTO po_change_log (pr_id, changed_by, comment, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                    [prId, changedBy || null, String(comment).trim(), JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), new Date().toISOString()], (logErr) => {
                      if (logErr) console.warn('Failed to insert po_change_log:', logErr);

                      // Update bookkeeping columns on purchase_requests
                      db.run('UPDATE purchase_requests SET last_modified_at = ?, last_modified_by = ?, change_count = COALESCE(change_count,0) + 1 WHERE pr_id = ?',
                        [new Date().toISOString(), changedBy || null, prId], (bErr) => {
                          if (bErr) console.warn('Failed to update bookkeeping columns:', bErr);
                          // If all items fully received, mark PR received/date
                          const allFully = (itemsAfter || []).every(it => (it.received_so_far || 0) >= (it.no_to_order || 0));
                          if (allFully) {
                            db.run('UPDATE purchase_requests SET received=1, date_received=? WHERE pr_id = ?', [new Date().toISOString(), prId], () => {
                              db.run('COMMIT', (cErr) => {
                                if (cErr) return db.run('ROLLBACK', () => reject({ error: 'Commit failed', details: cErr.message }));
                                return resolve({ success: true, pr: prAfter });
                              });
                            });
                          } else {
                            db.run('COMMIT', (cErr) => {
                              if (cErr) return db.run('ROLLBACK', () => reject({ error: 'Commit failed', details: cErr.message }));
                              return resolve({ success: true, pr: prAfter });
                            });
                          }
                      });
                  });
                });
              });
              return;
            }

            const line = lines[idx];
            const newlyReceived = Math.max(0, Number(line.newlyReceived) || 0);
            db.get('SELECT id, received_so_far, no_to_order, product_id, product_name FROM purchase_request_items WHERE pr_id = ? AND (product_name = ? OR product_id = ?)', [prId, line.productName, line.productId || null], (qErr, row) => {
              if (qErr || !row) {
                // Skip missing rows but continue
                return applyLine(idx + 1);
              }
              const totalReceived = Math.min(row.no_to_order, (row.received_so_far || 0) + newlyReceived);
              const isFullyReceived = totalReceived >= row.no_to_order ? 1 : 0;
              db.run('UPDATE purchase_request_items SET received_so_far = ?, received = ? WHERE id = ?', [totalReceived, isFullyReceived, row.id], (uErr) => {
                // Log each item receipt
                db.run('INSERT INTO item_receipt_log (pr_id, product_id, product_name, quantity_received, received_by, timestamp, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [prId, row.product_id, row.product_name, newlyReceived, changedBy || null, new Date().toISOString(), JSON.stringify(line)], () => {
                    // Continue to next
                    applyLine(idx + 1);
                  });
              });
            });
          };

          applyLine(0);
        });
      });
    });
  });
}
// --- Receive item by individual item ID ---
function receiveItemById(itemId, quantityReceived, receivedBy = null) {
  return new Promise((resolve, reject) => {
    if (!itemId || !quantityReceived || quantityReceived <= 0) {
      return reject({ error: 'Missing item ID or invalid quantity' });
    }
    
    // Get the current item details
    db.get('SELECT * FROM purchase_request_items WHERE id = ?', [itemId], (err, item) => {
      if (err) return reject({ error: 'DB error', details: err.message || err });
      if (!item) return reject({ error: 'Item not found' });
      
      const currentReceived = item.received_so_far || 0;
      const maxCanReceive = item.no_to_order - currentReceived;
      
      if (quantityReceived > maxCanReceive) {
        return reject({ error: `Cannot receive ${quantityReceived}. Maximum receivable: ${maxCanReceive}` });
      }
      
      const newTotalReceived = currentReceived + quantityReceived;
      const isFullyReceived = newTotalReceived >= item.no_to_order ? 1 : 0;
      
      // Update the item
      db.run('UPDATE purchase_request_items SET received_so_far = ?, received = ? WHERE id = ?', 
        [newTotalReceived, isFullyReceived, itemId], function(updateErr) {
        if (updateErr) return reject({ error: 'Failed to update item', details: updateErr.message || updateErr });
        
        // Log the receipt event
        db.run('INSERT INTO item_receipt_log (pr_id, product_id, product_name, quantity_received, received_by, timestamp, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            item.pr_id,
            item.product_id,
            item.product_name,
            quantityReceived,
            receivedBy || 'system', // Use provided user or fallback to 'system'
            new Date().toISOString(),
            JSON.stringify({ item_id: itemId })
          ], (logErr) => {
            // Don't fail if logging fails, just continue
            if (logErr) console.warn('Failed to log receipt:', logErr);
            
            // Check if all items in this PR are fully received
            db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [item.pr_id], (err2, allItems) => {
              if (!err2 && allItems) {
                const allFullyReceived = allItems.every(item => (item.received_so_far || 0) >= item.no_to_order);
                if (allFullyReceived) {
                  // Mark the entire PR as received with date
                  db.run('UPDATE purchase_requests SET received = 1, date_received = ? WHERE pr_id = ?', [new Date().toISOString(), item.pr_id], (err3) => {
                    if (err3) console.warn('Failed to mark PR as received:', err3);
                  });
                }
              }
              
              resolve({ 
                success: true, 
                message: 'Item received successfully',
                newTotalReceived,
                quantityReceived 
              });
            });
          }
        );
      });
    });
  });
}

// --- User Behavior Logging Functions ---

/**
 * Start a new user session
 * @param {number} userId 
 * @param {string} sessionId 
 * @returns {Promise}
 */
function startUserSession(userId, sessionId) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      'INSERT OR REPLACE INTO user_sessions (user_id, session_id, start_time, last_activity, page_views, actions_count) VALUES (?, ?, ?, ?, 0, 0)',
      [userId, sessionId, timestamp, timestamp],
      function (err) {
        if (err) return reject(err);
        resolve({ success: true, sessionId });
      }
    );
  });
}

/**
 * End a user session
 * @param {string} sessionId 
 * @returns {Promise}
 */
function endUserSession(sessionId) {
  return new Promise((resolve, reject) => {
    const endTime = new Date().toISOString();
    
    // First get the session start time to calculate duration
    db.get('SELECT start_time FROM user_sessions WHERE session_id = ?', [sessionId], (err, session) => {
      if (err) return reject(err);
      if (!session) return resolve({ success: true }); // Session not found, nothing to end
      
      const startTime = new Date(session.start_time);
      const duration = new Date(endTime) - startTime;
      
      db.run(
        'UPDATE user_sessions SET end_time = ?, total_duration_ms = ? WHERE session_id = ?',
        [endTime, duration, sessionId],
        function (err) {
          if (err) return reject(err);
          resolve({ success: true, duration });
        }
      );
    });
  });
}

/**
 * Log a user behavior event
 * @param {number} userId 
 * @param {string} sessionId 
 * @param {string} actionType - e.g., 'page_view', 'click', 'form_submit', 'feature_use'
 * @param {string} featureAccessed - e.g., 'sales_insights', 'purchase_requests', 'user_management'
 * @param {string} pageUrl 
 * @param {number} durationMs - time spent on action/page
 * @param {object} metadata - additional context data
 * @returns {Promise}
 */
function logUserBehavior(userId, sessionId, actionType, featureAccessed, pageUrl, durationMs = 0, metadata = {}) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    
    db.run(
      'INSERT INTO user_behavior_log (user_id, session_id, action_type, feature_accessed, page_url, timestamp, duration_ms, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, sessionId, actionType, featureAccessed, pageUrl, timestamp, durationMs, JSON.stringify(metadata)],
      function (err) {
        if (err) return reject(err);
        
        // Update session stats
        db.run(
          'UPDATE user_sessions SET last_activity = ?, page_views = page_views + ?, actions_count = actions_count + 1 WHERE session_id = ?',
          [timestamp, actionType === 'page_view' ? 1 : 0, sessionId],
          (updateErr) => {
            if (updateErr) console.warn('Failed to update session stats:', updateErr);
            resolve({ success: true, logId: this.lastID });
          }
        );
      }
    );
  });
}

/**
 * Set or update a user preference
 * @param {number} userId 
 * @param {string} key 
 * @param {string} value 
 * @returns {Promise}
 */
function setUserPreference(userId, key, value) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    
    db.run(
      'INSERT OR REPLACE INTO user_preferences (user_id, preference_key, preference_value, created_at, updated_at) VALUES (?, ?, ?, COALESCE((SELECT created_at FROM user_preferences WHERE user_id = ? AND preference_key = ?), ?), ?)',
      [userId, key, value, userId, key, timestamp, timestamp],
      function (err) {
        if (err) return reject(err);
        resolve({ success: true });
      }
    );
  });
}

/**
 * Get user preferences
 * @param {number} userId 
 * @returns {Promise}
 */
function getUserPreferences(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?', [userId], (err, rows) => {
      if (err) return reject(err);
      const preferences = {};
      rows.forEach(row => {
        preferences[row.preference_key] = row.preference_value;
      });
      resolve(preferences);
    });
  });
}

/**
 * Get user behavior analytics
 * @param {number} userId 
 * @param {number} daysPast - number of days to look back
 * @returns {Promise}
 */
function getUserBehaviorAnalytics(userId, daysPast = 30) {
  return new Promise((resolve, reject) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysPast);
    const sinceTimestamp = sinceDate.toISOString();
    
    // Get feature usage frequency
    const featureQuery = `
      SELECT feature_accessed, COUNT(*) as usage_count, AVG(duration_ms) as avg_duration
      FROM user_behavior_log 
      WHERE user_id = ? AND timestamp >= ? AND feature_accessed IS NOT NULL
      GROUP BY feature_accessed 
      ORDER BY usage_count DESC
    `;
    
    // Get session patterns
    const sessionQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        AVG(total_duration_ms) as avg_session_duration,
        AVG(page_views) as avg_page_views,
        AVG(actions_count) as avg_actions_per_session
      FROM user_sessions 
      WHERE user_id = ? AND start_time >= ?
    `;
    
    // Get most visited pages
    const pageQuery = `
      SELECT page_url, COUNT(*) as visit_count 
      FROM user_behavior_log 
      WHERE user_id = ? AND timestamp >= ? AND action_type = 'page_view'
      GROUP BY page_url 
      ORDER BY visit_count DESC 
      LIMIT 10
    `;
    
    // Get recent behavior logs for patterns analysis
    const behaviorLogsQuery = `
      SELECT id, action_type, feature_accessed, page_url, duration_ms, metadata_json, timestamp
      FROM user_behavior_log 
      WHERE user_id = ? AND timestamp >= ?
      ORDER BY timestamp DESC 
      LIMIT 100
    `;
    
    Promise.all([
      new Promise((res, rej) => db.all(featureQuery, [userId, sinceTimestamp], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.get(sessionQuery, [userId, sinceTimestamp], (err, row) => err ? rej(err) : res(row))),
      new Promise((res, rej) => db.all(pageQuery, [userId, sinceTimestamp], (err, rows) => err ? rej(err) : res(rows))),
      new Promise((res, rej) => db.all(behaviorLogsQuery, [userId, sinceTimestamp], (err, rows) => err ? rej(err) : res(rows)))
    ]).then(([features, sessions, pages, behaviorLogs]) => {
      resolve({
        userId,
        daysPast,
        featureUsage: features,
        sessionStats: sessions,
        topPages: pages,
        behaviorLogs: behaviorLogs,
        generatedAt: new Date().toISOString()
      });
    }).catch(reject);
  });
}

/**
 * Get behavior insights for all users (admin function)
 * @param {number} daysPast 
 * @returns {Promise}
 */
function getAllUsersBehaviorInsights(daysPast = 30) {
  return new Promise((resolve, reject) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysPast);
    const sinceTimestamp = sinceDate.toISOString();
    
    const query = `
      SELECT 
        u.id as user_id,
        u.username,
        COUNT(DISTINCT ub.session_id) as sessions,
        COUNT(ub.id) as total_actions,
        GROUP_CONCAT(DISTINCT ub.feature_accessed) as features_used,
        AVG(ub.duration_ms) as avg_action_duration
      FROM users u
      LEFT JOIN user_behavior_log ub ON u.id = ub.user_id AND ub.timestamp >= ?
      GROUP BY u.id, u.username
      ORDER BY total_actions DESC
    `;
    
    db.all(query, [sinceTimestamp], (err, rows) => {
      if (err) return reject(err);
      resolve({
        daysPast,
        userInsights: rows,
        generatedAt: new Date().toISOString()
      });
    });
  });
}

// --- Cliniko Stock Update Setting Management ---
function getClinikoStockUpdateSetting() {
  return new Promise((resolve, reject) => {
    // Check if the setting exists, create table if it doesn't
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return reject({ error: 'Failed to create settings table', details: err.message });
      
      db.get('SELECT value FROM settings WHERE key = ?', ['cliniko_stock_update_enabled'], (err, row) => {
        if (err) return reject({ error: 'Failed to get setting', details: err.message });
        
        const enabled = row ? (row.value === 'true') : false;
        resolve({ enabled });
      });
    });
  });
}

function setClinikoStockUpdateSetting(enabled) {
  console.log('[setClinikoStockUpdateSetting] called with enabled:', enabled);
  return new Promise((resolve, reject) => {
    const value = enabled ? 'true' : 'false';
    db.run(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, 
      ['cliniko_stock_update_enabled', value], function(err) {
      if (err) {
        console.error('[setClinikoStockUpdateSetting] DB error:', err);
        return reject({ error: 'Failed to save setting', details: err.message });
      }
      console.log('[setClinikoStockUpdateSetting] DB write success:', value);
      resolve({ 
        enabled: enabled,
        message: enabled ? 'Cliniko stock updates enabled' : 'Cliniko stock updates disabled'
      });
    });
  });
}

// --- Update Cliniko Stock ---
function updateClinikoStock(productName, quantityToAdd, purNumber = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // First check if stock updates are enabled
      const setting = await getClinikoStockUpdateSetting();
      if (!setting.enabled) {
        return resolve({ 
          success: true, 
          message: 'Stock updates disabled - no Cliniko update performed',
          updated: false 
        });
      }

      // Get API key using the secure method
      try {
        const apiKey = await getActualApiKey();
        // Format as Basic Auth: 'Basic ' + base64(token + ':')
        const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');

        // Find the product in our database to get the Cliniko ID
        db.get('SELECT cliniko_id, name, stock FROM products WHERE name = ?', [productName], async (err, product) => {
          if (err) return reject({ error: 'Failed to find product', details: err.message });
          if (!product) return reject({ error: 'Product not found in database' });

          try {
            const https = require('https');
            const clinikoId = product.cliniko_id;
            
            // Determine adjustment type based on quantity
            let adjustmentType;
            if (quantityToAdd > 0) {
              adjustmentType = "Stock Purchase"; // For receiving items
            } else {
              adjustmentType = "Other"; // For negative adjustments
            }

            // Use Stock Adjustments API (CORRECT WAY)
            const postData = JSON.stringify({
              product_id: parseInt(clinikoId),
              quantity: quantityToAdd,
              adjustment_type: adjustmentType,
              comment: purNumber ? `Stock adjustment from PUR-${purNumber}` : 'Stock adjustment from purchase request system'
            });

            const options = {
              hostname: 'api.au1.cliniko.com',
              port: 443,
              path: '/v1/stock_adjustments',
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'MyAPP (mitch.hare34@gmail.com)'
              }
            };

            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                if (res.statusCode === 201) { // Stock adjustments return 201 Created
                  const responseData = JSON.parse(data);
                  
                  // Update our local database stock as well
                  const newStock = (product.stock || 0) + quantityToAdd;
                  db.run('UPDATE products SET stock = ? WHERE cliniko_id = ?', [newStock, clinikoId], (updateErr) => {
                    if (updateErr) {
                      console.error('Failed to update local stock:', updateErr);
                    }
                    
                    resolve({
                      success: true,
                      message: `Successfully created Cliniko stock adjustment for ${productName}`,
                      updated: true,
                      previousStock: product.stock,
                      newStock: newStock,
                      quantityAdded: quantityToAdd,
                      adjustmentId: responseData.id
                    });
                  });
                } else {
                  reject({ 
                    error: `Cliniko API error: ${res.statusCode}`, 
                    details: data 
                  });
                }
              });
            });

            req.on('error', (error) => {
              reject({ error: 'Failed to connect to Cliniko API', details: error.message });
            });

            req.write(postData);
            req.end();

          } catch (apiError) {
            reject({ error: 'Failed to update Cliniko stock', details: apiError.message });
          }
        });
      } catch (keyError) {
        reject({ error: 'Failed to get API key', details: keyError.message });
      }

    } catch (error) {
      reject({ error: 'Failed to update Cliniko stock', details: error.message });
    }
  });
}

/**
 * Update a purchase request while requiring a comment and record an audit entry.
 * @param {string} prId
 * @param {object} updates - fields to update on purchase_requests (e.g., date_received, received)
 * @param {string} changedBy - username or identifier
 * @param {string} comment - required reason for change
 */
function updatePurchaseRequestWithComment(prId, updates = {}, changedBy = null, comment = '') {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing PR ID' });
    if (!comment || String(comment).trim().length < 3) return reject({ error: 'A reason/comment is required (min 3 characters)' });

    db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (err, beforeRow) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      if (!beforeRow) return reject({ error: 'Purchase request not found' });

      const beforeJson = JSON.stringify(beforeRow);

      // Build SET clause
      const fields = Object.keys(updates || {}).filter(k => k !== 'pr_id');
      const params = fields.map(k => updates[k]);
      const setSql = fields.length > 0 ? fields.map(k => `${k} = ?`).join(', ') : null;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const applyUpdate = (cb) => {
          if (!setSql) return cb(null);
          db.run(`UPDATE purchase_requests SET ${setSql} WHERE pr_id = ?`, [...params, prId], (uErr) => cb(uErr));
        };

        applyUpdate((uErr) => {
          if (uErr) {
            db.run('ROLLBACK', () => {});
            return reject({ error: 'Failed to update PR', details: uErr.message });
          }

          // Read after-state
          db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (gErr, afterRow) => {
            if (gErr) {
              db.run('ROLLBACK', () => {});
              return reject({ error: 'Failed to read PR after update', details: gErr.message });
            }

            const afterJson = JSON.stringify(afterRow || {});

            // Insert audit log
            db.run('INSERT INTO po_change_log (pr_id, changed_by, comment, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
              [prId, changedBy || null, String(comment || '').trim(), beforeJson, afterJson, new Date().toISOString()], (iErr) => {
                if (iErr) {
                  // Non-fatal: try to continue but note logged failure
                  console.warn('Failed to insert po_change_log:', iErr);
                }

                // Update bookkeeping columns
                db.run('UPDATE purchase_requests SET last_modified_at = ?, last_modified_by = ?, change_count = COALESCE(change_count,0) + 1 WHERE pr_id = ?',
                  [new Date().toISOString(), changedBy || null, prId], (bErr) => {
                    if (bErr) {
                      console.warn('Failed to update bookkeeping columns:', bErr);
                    }
                    db.run('COMMIT', (cErr) => {
                      if (cErr) {
                        db.run('ROLLBACK', () => {});
                        return reject({ error: 'Failed to commit transaction', details: cErr.message });
                      }
                      return resolve({ success: true, pr: afterRow });
                    });
                });
            });
          });
        });
      });
    });
  });
}

function getPoChangeLog(prId, limit = 50) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing PR ID' });
    db.all('SELECT id, pr_id, changed_by, comment, before_json, after_json, timestamp FROM po_change_log WHERE pr_id = ? ORDER BY timestamp DESC LIMIT ?', [prId, limit], (err, rows) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      resolve(rows || []);
    });
  });
}

/**
 * Edit or delete purchase_request_items rows with an audit comment and bookkeeping.
 * edits: [{ id, productName, no_to_order, unit_cost, delete: boolean }]
 */
function updatePurchaseRequestItemsEditWithComment(prId, edits = [], changedBy = null, comment = '') {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing PR ID' });
    if (!Array.isArray(edits) || edits.length === 0) return reject({ error: 'No edits provided' });
    if (!comment || String(comment).trim().length < 3) return reject({ error: 'A reason/comment is required (min 3 chars)' });

    // Debug logging: record invocation
    try {
      fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestItemsEditWithComment called - prId=${prId} edits=${edits.length} changedBy=${changedBy} comment="${String(comment).replace(/\n/g,' ')}"\n`);
    } catch (e) {
      // ignore logging failures
    }

    // Fetch before snapshot
    db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (err, prRow) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      if (!prRow) return reject({ error: 'Purchase request not found' });

      db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [prId], (iErr, itemsBefore) => {
        if (iErr) return reject({ error: 'DB error', details: iErr.message });

        const beforeSnapshot = { purchase_request: prRow, items: itemsBefore };

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          const applyEdit = (idx) => {
            if (idx >= edits.length) {
              // After edits, read after snapshot and insert audit
              db.get('SELECT * FROM purchase_requests WHERE pr_id = ?', [prId], (gErr, prAfter) => {
                if (gErr) return db.run('ROLLBACK', () => reject({ error: 'Failed to read PR after edits', details: gErr.message }));
                db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [prId], (gErr2, itemsAfter) => {
                  if (gErr2) return db.run('ROLLBACK', () => reject({ error: 'Failed to read items after edits', details: gErr2.message }));

                  const afterSnapshot = { purchase_request: prAfter, items: itemsAfter };

                  db.run('INSERT INTO po_change_log (pr_id, changed_by, comment, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                    [prId, changedBy || null, String(comment).trim(), JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), new Date().toISOString()], (logErr) => {
                      if (logErr) console.warn('Failed to insert po_change_log:', logErr);

                      db.run('UPDATE purchase_requests SET last_modified_at = ?, last_modified_by = ?, change_count = COALESCE(change_count,0) + 1 WHERE pr_id = ?',
                        [new Date().toISOString(), changedBy || null, prId], (bErr) => {
                          if (bErr) console.warn('Failed to update bookkeeping columns:', bErr);
                          db.run('COMMIT', (cErr) => {
                            if (cErr) return db.run('ROLLBACK', () => reject({ error: 'Commit failed', details: cErr.message }));
                            return resolve({ success: true, pr: prAfter });
                          });
                      });
                  });
                });
              });
              return;
            }

            const e = edits[idx];
            if (e.delete) {
              // Delete by item id if provided, otherwise by product name and pr_id
              if (e.id) {
                db.run('DELETE FROM purchase_request_items WHERE id = ? AND pr_id = ?', [e.id, prId], (dErr) => {
                  // Continue regardless of individual delete failures
                  applyEdit(idx + 1);
                });
              } else {
                db.run('DELETE FROM purchase_request_items WHERE pr_id = ? AND product_name = ?', [prId, e.productName], (dErr) => {
                  applyEdit(idx + 1);
                });
              }
            } else {
              // Update fields: no_to_order, unit_cost, product_name if present
              const fields = [];
              const params = [];
              if (typeof e.no_to_order !== 'undefined') { fields.push('no_to_order = ?'); params.push(e.no_to_order); }
              if (typeof e.unit_cost !== 'undefined') { fields.push('unit_cost = ?'); params.push(e.unit_cost); }
              if (typeof e.productName !== 'undefined') { fields.push('product_name = ?'); params.push(e.productName); }

              if (fields.length === 0) return applyEdit(idx + 1);

              if (e.id) {
                db.run(`UPDATE purchase_request_items SET ${fields.join(', ')} WHERE id = ? AND pr_id = ?`, [...params, e.id, prId], (uErr) => {
                  applyEdit(idx + 1);
                });
              } else {
                db.run(`UPDATE purchase_request_items SET ${fields.join(', ')} WHERE pr_id = ? AND product_name = ?`, [...params, prId, e.originalProductName || e.productName], (uErr) => {
                  applyEdit(idx + 1);
                });
              }
            }
          };

          applyEdit(0);
        });
      });
    });
  });
}

// --- Supplier Management Functions ---
function getAllSuppliers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM suppliers ORDER BY name ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting suppliers:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      resolve(rows || []);
    });
  });
}

// Return suppliers marked as inactive (active = 0)
function getInactiveSuppliers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM suppliers WHERE active = 0 ORDER BY name ASC', [], (err, rows) => {
      if (err) {
        console.error('Error getting inactive suppliers:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      resolve(rows || []);
    });
  });
}

function addSupplier(name, email, contactName, comments, accountNumber = '', source = 'Manual') {
  return new Promise((resolve, reject) => {
    if (!name || name.trim() === '') {
      return reject({ error: 'Supplier name is required' });
    }
    
    const now = new Date().toISOString();
    // Check if suppliers table has lead_time_days column; if so, insert default lead time = 7
    db.all("PRAGMA table_info('suppliers')", (pragmaErr, cols) => {
      let hasLeadCol = false;
      try { hasLeadCol = Array.isArray(cols) && cols.some(c => c && c.name === 'lead_time_days'); } catch (e) { hasLeadCol = false; }

      const insertWithLead = 'INSERT INTO suppliers (name, email, contact_name, account_number, special_instructions, source, created_at, updated_at, lead_time_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      const insertWithoutLead = 'INSERT INTO suppliers (name, email, contact_name, account_number, special_instructions, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

      const paramsWithLead = [name.trim(), email || '', contactName || '', accountNumber || '', comments || '', source, now, now, 7];
      const paramsWithoutLead = [name.trim(), email || '', contactName || '', accountNumber || '', comments || '', source, now, now];

      const sql = hasLeadCol ? insertWithLead : insertWithoutLead;
      const params = hasLeadCol ? paramsWithLead : paramsWithoutLead;

      db.run(sql, params, function (err) {
        if (err) {
          // If insert failed because column missing (schema drift), try fallback insert without lead_time_days
          if (hasLeadCol && err.message && err.message.toLowerCase().includes('no such column')) {
            // Attempt fallback insert without lead column
            db.run(insertWithoutLead, paramsWithoutLead, function (err2) {
              if (err2) {
                if (err2.message && err2.message.includes('UNIQUE constraint failed')) {
                  return reject({ error: 'A supplier with this name already exists' });
                }
                console.error('Error adding supplier (fallback):', err2);
                return reject({ error: 'Database error', details: err2.message || err2 });
              }
              return resolve({ id: this.lastID, success: true });
            });
            return;
          }

          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return reject({ error: 'A supplier with this name already exists' });
          }
          console.error('Error adding supplier:', err);
          return reject({ error: 'Database error', details: err.message || err });
        }
        resolve({ id: this.lastID, success: true });
      });
    });
  });
}

function updateSupplier(id, name, email, contactName, comments, accountNumber = '') {
  return new Promise((resolve, reject) => {
    if (!id) {
      return reject({ error: 'Supplier ID is required' });
    }
    if (!name || name.trim() === '') {
      return reject({ error: 'Supplier name is required' });
    }
    
    const now = new Date().toISOString();
    db.run(
  'UPDATE suppliers SET name = ?, email = ?, contact_name = ?, account_number = ?, special_instructions = ?, updated_at = ? WHERE id = ?',
  [name.trim(), email || '', contactName || '', accountNumber || '', comments || '', now, id],
      function (err) {
        if (err) {
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return reject({ error: 'A supplier with this name already exists' });
          }
          console.error('Error updating supplier:', err);
          return reject({ error: 'Database error', details: err.message || err });
        }
        if (this.changes === 0) {
          return reject({ error: 'Supplier not found' });
        }
        resolve({ success: true });
      }
    );
  });
}

function deleteSupplier(id) {
  return new Promise((resolve, reject) => {
    if (!id) {
      return reject({ error: 'Supplier ID is required' });
    }
    
    db.run('DELETE FROM suppliers WHERE id = ?', [id], function (err) {
      if (err) {
        console.error('Error deleting supplier:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      if (this.changes === 0) {
        return reject({ error: 'Supplier not found' });
      }
      resolve({ success: true });
    });
  });
}

function getSupplierByName(name) {
  return new Promise((resolve, reject) => {
    if (!name) {
      return reject({ error: 'Supplier name is required' });
    }
    
    db.get('SELECT * FROM suppliers WHERE name = ?', [name.trim()], (err, row) => {
      if (err) {
        console.error('Error getting supplier by name:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      resolve(row || null);
    });
  });
}

// Reactivate a supplier (set active = 1)
function reactivateSupplier(supplierId) {
  return new Promise((resolve, reject) => {
    if (!supplierId) return reject({ error: 'Supplier ID is required' });
    const now = new Date().toISOString();
    db.run('UPDATE suppliers SET active = 1, updated_at = ? WHERE id = ?', [now, supplierId], function (err) {
      if (err) {
        console.error('Error reactivating supplier:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      if (this.changes === 0) {
        return reject({ error: 'Supplier not found' });
      }
      resolve({ success: true });
    });
  });
}

// Deactivate a product (set active = 0)
function deactivateProduct(clinikoId) {
  return new Promise((resolve, reject) => {
    if (!clinikoId) return reject({ error: 'Product Cliniko ID is required' });
    const now = new Date().toISOString();
    db.run('UPDATE products SET active = 0 WHERE cliniko_id = ?', [clinikoId], function (err) {
      if (err) {
        console.error('Error deactivating product:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      if (this.changes === 0) {
        return reject({ error: 'Product not found' });
      }
      resolve({ success: true });
    });
  });
}

// Activate a product (set active = 1)
function activateProduct(clinikoId) {
  return new Promise((resolve, reject) => {
    if (!clinikoId) return reject({ error: 'Product Cliniko ID is required' });
    const now = new Date().toISOString();
    db.run('UPDATE products SET active = 1 WHERE cliniko_id = ?', [clinikoId], function (err) {
      if (err) {
        console.error('Error activating product:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      if (this.changes === 0) {
        return reject({ error: 'Product not found' });
      }
      resolve({ success: true });
    });
  });
}

// Deactivate a supplier (set active = 0)
function deactivateSupplier(supplierId) {
  return new Promise((resolve, reject) => {
    if (!supplierId) return reject({ error: 'Supplier ID is required' });
    const now = new Date().toISOString();
    db.run('UPDATE suppliers SET active = 0, updated_at = ? WHERE id = ?', [now, supplierId], function (err) {
      if (err) {
        console.error('Error deactivating supplier:', err);
        return reject({ error: 'Database error', details: err.message || err });
      }
      if (this.changes === 0) {
        return reject({ error: 'Supplier not found' });
      }
      resolve({ success: true });
    });
  });
}

function autoPopulateSuppliersFromCliniko(uniqueSuppliers, options = { deactivateMissing: true, dryRun: false }) {
  return new Promise((resolve, reject) => {
    if (!uniqueSuppliers || uniqueSuppliers.size === 0) {
      return resolve({ inserted: 0, reactivated: 0, deactivated: 0, insertedNames: [], reactivatedNames: [], deactivatedNames: [], message: 'No suppliers to process' });
    }

    // Build a normalized map: key = lower(trim(name)) -> original trimmed name
    // This lets us compare case-insensitively while preserving the original casing for DB writes/logs
    const normalizedMap = new Map();
    uniqueSuppliers.forEach(s => {
      try {
        const trimmed = String(s).trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !normalizedMap.has(key)) normalizedMap.set(key, trimmed);
      } catch (e) { /* ignore */ }
    });

    let processed = 0;
    let inserted = 0;
    let reactivated = 0;
    let deactivated = 0;
    const insertedNames = [];
    const reactivatedNames = [];
    const deactivatedNames = [];
  const total = normalizedMap.size;
    const now = new Date().toISOString();

    console.log(`Auto-populating ${total} unique suppliers from Cliniko...`);

    function performDeactivationIfNeeded() {
      // If deactivation not requested, resolve immediately
      if (!options || !options.deactivateMissing) {
        return resolve({ inserted, reactivated, deactivated: 0, insertedNames, reactivatedNames, deactivatedNames, message: `Suppliers auto-populated: ${inserted} new, ${reactivated} reactivated` });
      }

      // Get all active Cliniko suppliers and deactivate those not in the current set
      db.all("SELECT id, name FROM suppliers WHERE source = ? AND active = 1", ['Cliniko'], (err, rows) => {
        if (err) {
          console.error('Error querying existing Cliniko suppliers for deactivation:', err);
          return resolve({ inserted, reactivated, deactivated: 0, insertedNames, reactivatedNames, deactivatedNames, message: `Suppliers auto-populated: ${inserted} new, ${reactivated} reactivated (deactivation failed)` , deactivation_error: err.message || err });
        }

        // Compare case-insensitively using the normalizedMap keys
        const toDeactivate = rows.filter(r => {
          try {
            const key = String(r.name || '').trim().toLowerCase();
            return !normalizedMap.has(key);
          } catch (e) { return true; }
        });

        if (toDeactivate.length === 0) {
          return resolve({ inserted, reactivated, deactivated: 0, insertedNames, reactivatedNames, deactivatedNames, message: `Suppliers auto-populated: ${inserted} new, ${reactivated} reactivated, 0 deactivated` });
        }

        if (options.dryRun) {
          // Dry-run: return names that would be deactivated without modifying DB
          const wouldDeactivate = toDeactivate.map(r => r.name);
          return resolve({ inserted, reactivated, deactivated: 0, insertedNames, reactivatedNames, deactivatedNames: [], would_deactivate: wouldDeactivate, message: `Dry-run: ${wouldDeactivate.length} suppliers would be deactivated` });
        }

        // Perform deactivation updates
        let done = 0;
        toDeactivate.forEach(row => {
          db.run('UPDATE suppliers SET active = 0, updated_at = ? WHERE id = ?', [now, row.id], function (uErr) {
            if (!uErr) {
              deactivated++;
              deactivatedNames.push(row.name);
              console.log(`Deactivated supplier: '${row.name}'`);
            } else {
              console.error('Error deactivating supplier:', row.name, uErr);
            }
            done++;
            if (done === toDeactivate.length) {
              return resolve({ inserted, reactivated, deactivated, insertedNames, reactivatedNames, deactivatedNames, message: `Suppliers auto-populated: ${inserted} new, ${reactivated} reactivated, ${deactivated} deactivated` });
            }
          });
        });
      });
    }

    // Process each supplier name: insert or reactivate as before
    // Iterate over normalizedMap values (original trimmed names) but perform case-insensitive lookups
    Array.from(normalizedMap.values()).forEach(supplierName => {
      // Use case-insensitive match via COLLATE NOCASE so names differing only by case match
      db.get('SELECT id, active FROM suppliers WHERE name = ? COLLATE NOCASE', [supplierName], (err, existingRow) => {
        if (err) {
          console.error('Error checking existing supplier:', err);
          processed++;
          if (processed === total) performDeactivationIfNeeded();
          return;
        }

        if (existingRow) {
          const isActive = existingRow.active === undefined || existingRow.active === null ? 1 : Number(existingRow.active);
          if (!isActive) {
            db.run('UPDATE suppliers SET active = 1, updated_at = ? WHERE id = ?', [now, existingRow.id], function (updateErr) {
              if (updateErr) {
                console.error('Error reactivating supplier:', updateErr, supplierName);
              } else {
                reactivated++;
                reactivatedNames.push(supplierName);
                console.log(`Reactivated supplier: '${supplierName}'`);
              }
              processed++;
              if (processed === total) performDeactivationIfNeeded();
            });
          } else {
            processed++;
            if (processed === total) performDeactivationIfNeeded();
          }
        } else {
          db.run(
            'INSERT INTO suppliers (name, email, contact_name, special_instructions, source, created_at, updated_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            [supplierName, '', '', '', 'Cliniko', now, now],
            function (insertErr) {
              if (insertErr && !insertErr.message.includes('UNIQUE constraint failed')) {
                console.error('Error auto-inserting supplier:', insertErr, supplierName);
              } else if (!insertErr) {
                inserted++;
                insertedNames.push(supplierName);
                console.log(`Auto-added supplier: '${supplierName}'`);
              } else if (insertErr && insertErr.message.includes('UNIQUE constraint failed')) {
                // Race: a supplier was inserted concurrently with different casing - try a case-insensitive lookup
                db.get('SELECT id, active FROM suppliers WHERE name = ? COLLATE NOCASE', [supplierName], (gErr, row) => {
                  if (!gErr && row && (row.active === 0 || row.active === '0')) {
                    db.run('UPDATE suppliers SET active = 1, updated_at = ? WHERE id = ?', [now, row.id], function (uErr) {
                      if (!uErr) {
                        reactivated++;
                        reactivatedNames.push(supplierName);
                        console.log(`Reactivated supplier after race: '${supplierName}'`);
                      }
                    });
                  }
                });
              }

              processed++;
              if (processed === total) performDeactivationIfNeeded();
            }
          );
        }
      });
    });
  });
}

// --- Email Template Functions ---
function saveEmailTemplate(templateData) {
  return new Promise((resolve, reject) => {
    const { subject, body, signature } = templateData;
    
    // Create email_templates table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT,
      body TEXT,
      signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Failed to create email_templates table:', err);
        return reject({ error: 'Failed to create email templates table', details: err.message });
      }

      // Check if template exists (we'll only keep one template for now)
      db.get('SELECT id FROM email_templates LIMIT 1', [], (err, row) => {
        if (err) {
          console.error('Error checking existing template:', err);
          return reject({ error: 'Failed to check existing template', details: err.message });
        }

        if (row) {
          // Update existing template
          db.run(
            'UPDATE email_templates SET subject = ?, body = ?, signature = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [subject, body, signature, row.id],
            function (err) {
              if (err) {
                console.error('Error updating email template:', err);
                return reject({ error: 'Failed to update email template', details: err.message });
              }
              resolve({ success: true, message: 'Email template updated successfully' });
            }
          );
        } else {
          // Insert new template
          db.run(
            'INSERT INTO email_templates (subject, body, signature) VALUES (?, ?, ?)',
            [subject, body, signature],
            function (err) {
              if (err) {
                console.error('Error inserting email template:', err);
                return reject({ error: 'Failed to save email template', details: err.message });
              }
              resolve({ success: true, message: 'Email template saved successfully' });
            }
          );
        }
      });
    });
  });
}

function getEmailTemplate() {
  return new Promise((resolve, reject) => {
    // Create table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT,
      body TEXT,
      signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Failed to create email_templates table:', err);
        return reject({ error: 'Failed to create email templates table', details: err.message });
      }

      // Get the latest template
      db.get('SELECT * FROM email_templates ORDER BY updated_at DESC LIMIT 1', [], (err, row) => {
        if (err) {
          console.error('Error fetching email template:', err);
          return reject({ error: 'Failed to fetch email template', details: err.message });
        }
        resolve(row || null);
      });
    });
  });
}

// --- PO Template Functions (separate from email templates) ---
function savePoTemplate(templateData) {
  return new Promise((resolve, reject) => {
    const { name = 'default', html, subject } = templateData || {};
    // Create po_templates table
    db.run(`CREATE TABLE IF NOT EXISTS po_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      html TEXT,
      subject TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return reject({ error: 'Failed to create po_templates table', details: err.message });

      // Upsert by name
      db.get('SELECT id FROM po_templates WHERE name = ?', [name], (err, row) => {
        if (err) return reject({ error: 'DB error', details: err.message });
        if (row) {
          db.run('UPDATE po_templates SET html = ?, subject = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [html, subject, row.id], function (uErr) {
            if (uErr) return reject({ error: 'Failed to update PO template', details: uErr.message });
            resolve({ success: true, message: 'PO template updated' });
          });
        } else {
          db.run('INSERT INTO po_templates (name, html, subject) VALUES (?, ?, ?)', [name, html, subject], function (iErr) {
            if (iErr) return reject({ error: 'Failed to save PO template', details: iErr.message });
            resolve({ success: true, message: 'PO template saved' });
          });
        }
      });
    });
  });
}

function getPoTemplate(name = 'default') {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS po_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      html TEXT,
      subject TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) return reject({ error: 'Failed to create po_templates table', details: err.message });
      db.get('SELECT * FROM po_templates WHERE name = ? ORDER BY updated_at DESC LIMIT 1', [name], (err2, row) => {
        if (err2) return reject({ error: 'Failed to fetch PO template', details: err2.message });
        resolve(row || null);
      });
    });
  });
}

// --- Smart Prompts Setting Functions ---
function getSmartPromptsSetting() {
  return new Promise((resolve, reject) => {
    // Ensure settings table exists before querying (like ClinikoStockUpdate)
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('[getSmartPromptsSetting] Failed to create settings table:', err);
        return reject({ error: 'Failed to create settings table', details: err.message });
      }
      console.log('[getSmartPromptsSetting] Querying smart_prompts_enabled from settings table');
      db.get('SELECT value FROM settings WHERE key = ?', ['smart_prompts_enabled'], (err, row) => {
        if (err) {
          console.error('[getSmartPromptsSetting] DB error:', err);
          return reject({ error: 'Failed to get smart prompts setting', details: err.message });
        }
        console.log('[getSmartPromptsSetting] DB row:', row);
        const enabled = row ? (row.value === 'true') : false; // Default to false (disabled)
        console.log('[getSmartPromptsSetting] Returning enabled:', enabled);
        resolve({ enabled });
      });
    });
  });
}

function setSmartPromptsSetting(enabled) {
  console.log('[setSmartPromptsSetting] called with enabled:', enabled);
  return new Promise((resolve, reject) => {
    const value = enabled ? 'true' : 'false';
    db.run(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, 
      ['smart_prompts_enabled', value], function(err) {
      if (err) {
        console.error('[setSmartPromptsSetting] DB error:', err);
        return reject({ error: 'Failed to save smart prompts setting', details: err.message });
      }
      console.log('[setSmartPromptsSetting] DB write success:', value);
      resolve({ 
        enabled: enabled,
        message: enabled ? 'Smart prompts enabled' : 'Smart prompts disabled'
      });
    });
  });
}

// --- File Management Functions for Supplier Files ---

/**
 * Get generated files for a purchase request
 * @param {string} prId - Purchase request ID
 * @param {string} fileType - Optional file type filter ('excel', 'oft', etc.)
 * @returns {Promise<Array>} Array of file records
 */
function getGeneratedFiles(prId, fileType = null) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing purchase request ID' });
    
    let sql = 'SELECT * FROM vendor_files WHERE pr_id = ?';
    let params = [prId];
    
    if (fileType) {
      sql += ' AND file_type = ?';
      params.push(fileType);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error getting generated files:', err);
        return reject({ error: 'Failed to get generated files', details: err.message });
      }
      resolve(rows || []);
    });
  });
}

/**
 * Delete a generated file record and optionally the file from disk
 * @param {string} prId - Purchase request ID
 * @param {string} vendorName - Vendor name
 * @param {string} fileType - File type ('excel', 'oft', etc.)
 * @param {string} filename - Filename
 * @returns {Promise<boolean>} Success status
 */
function deleteGeneratedFile(prId, vendorName, fileType, filename) {
  return new Promise((resolve, reject) => {
    if (!prId || !vendorName || !fileType || !filename) {
      return reject({ error: 'Missing required parameters' });
    }
    
    db.run(
      'DELETE FROM vendor_files WHERE pr_id = ? AND vendor_name = ? AND file_type = ? AND filename = ?',
      [prId, vendorName, fileType, filename],
      function(err) {
        if (err) {
          console.error('Error deleting generated file:', err);
          return reject({ error: 'Failed to delete generated file', details: err.message });
        }
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Mark vendor files as created in the database
 * @param {string} prId - Purchase request ID
 * @param {string} vendorName - Vendor name
 * @param {string} fileType - File type ('excel', 'oft', etc.)
 * @param {string} filename - Filename
 * @param {string} filePath - Full file path
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<boolean>} Success status
 */
function markVendorFilesCreated(prId, vendorName, fileType, filename, filePath, fileSize = 0) {
  return new Promise((resolve, reject) => {
    if (!prId || !vendorName || !fileType || !filename) {
      return reject({ error: 'Missing required parameters' });
    }
  try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] markVendorFilesCreated called with prId=${prId}, vendor=${vendorName}, fileType=${fileType}, filename=${filename}, filePath=${filePath}\n`); } catch (e) {}
    
    // Ensure vendor_files table exists
    db.run(`CREATE TABLE IF NOT EXISTS vendor_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (createErr) => {
      if (createErr) {
        console.error('Error creating vendor_files table:', createErr);
        return reject({ error: 'Failed to create vendor_files table', details: createErr.message });
      }
      
        // Run a dedupe pass to remove accidental duplicates (keep the earliest id per group)
        db.run(`DELETE FROM vendor_files WHERE id NOT IN (SELECT MIN(id) FROM vendor_files GROUP BY pr_id, vendor_name, file_type, filename)`, [], function(dedupeErr) {
          if (dedupeErr) {
            // Log but do not fail - we'll still try to create the unique index and upsert
            console.warn('Warning: failed to dedupe vendor_files table before creating index:', dedupeErr.message || dedupeErr);
            try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] DEDUPE WARNING: ${dedupeErr && dedupeErr.message ? dedupeErr.message : dedupeErr}\n`); } catch (e) {}
          }

          // Create a unique index to prevent future duplicate rows on the same (pr_id, vendor_name, file_type, filename)
          db.run(`CREATE UNIQUE INDEX IF NOT EXISTS vendor_files_unique_idx ON vendor_files(pr_id, vendor_name, file_type, filename)`, [], function(idxErr) {
            if (idxErr) {
              console.warn('Warning: failed to create unique index on vendor_files:', idxErr.message || idxErr);
              try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] INDEX CREATE WARNING: ${idxErr && idxErr.message ? idxErr.message : idxErr}\n`); } catch (e) {}
            }

            // Use UPSERT to insert or update the record atomically
            const upsertSql = `INSERT INTO vendor_files (pr_id, vendor_name, file_type, filename, file_path, file_size, created_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(pr_id, vendor_name, file_type, filename) DO UPDATE SET
                file_path = excluded.file_path,
                file_size = excluded.file_size,
                created_at = CURRENT_TIMESTAMP`;

            db.run(upsertSql, [prId, vendorName, fileType, filename, filePath, fileSize], function(err) {
              if (err) {
                try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] markVendorFilesCreated ERROR: ${err && err.message ? err.message : err}\n`); } catch (e) {}
                console.error('Error marking vendor files created (upsert):', err);
                return reject({ error: 'Failed to mark vendor files created', details: err.message });
              }
              try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] markVendorFilesCreated success for prId=${prId}, vendor=${vendorName}, filename=${filename}\n`); } catch (e) {}
              resolve(true);
            });
          });
        });
    });
  });
}

/**
 * Check if vendor files have been created for a purchase request
 * @param {string} prId - Purchase request ID
 * @param {string} vendorName - Vendor name
 * @param {string} fileType - File type ('excel', 'oft', etc.)
 * @returns {Promise<boolean>} True if files exist
 */
function hasVendorFilesCreated(prId, vendorName, fileType) {
  return new Promise((resolve, reject) => {
    if (!prId || !vendorName || !fileType) {
      return reject({ error: 'Missing required parameters' });
    }
    
    db.get(
      'SELECT COUNT(*) as count FROM vendor_files WHERE pr_id = ? AND vendor_name = ? AND file_type = ?',
      [prId, vendorName, fileType],
      (err, row) => {
        if (err) {
          console.error('Error checking vendor files:', err);
          return reject({ error: 'Failed to check vendor files', details: err.message });
        }
        resolve((row?.count || 0) > 0);
      }
    );
  });
}

/**
 * Update purchase request supplier files status
 * @param {string} prId - Purchase request ID
 * @param {boolean} hasFiles - Whether files exist
 * @returns {Promise<boolean>} Success status
 */
function updatePurchaseRequestSupplierFilesStatus(prId, hasFiles) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing purchase request ID' });
    
    db.run(
      'UPDATE purchase_requests SET supplier_files_created = ? WHERE pr_id = ?',
      [hasFiles ? 1 : 0, prId],
      function(err) {
        if (err) {
          console.error('Error updating supplier files status:', err);
          return reject({ error: 'Failed to update supplier files status', details: err.message });
        }
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Update purchase request OFT files status
 * @param {string} prId - Purchase request ID
 * @param {boolean} hasFiles - Whether files exist
 * @returns {Promise<boolean>} Success status
 */
function updatePurchaseRequestOftFilesStatus(prId, hasFiles) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing purchase request ID' });
    
    db.run(
      'UPDATE purchase_requests SET oft_files_created = ? WHERE pr_id = ?',
      [hasFiles ? 1 : 0, prId],
      function(err) {
        if (err) {
          console.error('Error updating OFT files status:', err);
          return reject({ error: 'Failed to update OFT files status', details: err.message });
        }
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Update purchase request emails_sent status
 * @param {string} prId - Purchase request ID
 * @param {boolean} sent - Whether emails were sent
 * @returns {Promise<boolean>} Success status
 */
function updatePurchaseRequestEmailsSentStatus(prId, sent) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing purchase request ID' });
    try {
      try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatus called prId=${prId} sent=${sent}\n`); } catch (e) {}
      db.run(
        'UPDATE purchase_requests SET emails_sent = ? WHERE pr_id = ?',
        [sent ? 1 : 0, prId],
        function(err) {
          if (err) {
            console.error('Error updating emails_sent status:', err);
            try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatus ERROR prId=${prId} err=${err && err.message}\n`); } catch (e) {}
            return reject({ error: 'Failed to update emails_sent status', details: err.message });
          }
          try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatus result prId=${prId} changes=${this.changes}\n`); } catch (e) {}
          resolve(this.changes > 0);
        }
      );
    } catch (e) {
      try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatus EXCEPTION prId=${prId} err=${e && e.message}\n`); } catch (ee) {}
      return reject({ error: 'Failed to update emails_sent status', details: e.message });
    }
  });
}

/**
 * More robust update: try exact match, then trimmed match, then LIKE match to handle id formatting differences.
 * Returns { success: boolean, changes: number }
 */
function updatePurchaseRequestEmailsSentStatusForce(prId, sent) {
  return new Promise((resolve, reject) => {
    if (!prId) return reject({ error: 'Missing purchase request ID' });
    const val = sent ? 1 : 0;
    const tryUpdates = [
      { sql: 'UPDATE purchase_requests SET emails_sent = ? WHERE pr_id = ?', params: [val, prId] },
      { sql: 'UPDATE purchase_requests SET emails_sent = ? WHERE TRIM(pr_id) = TRIM(?)', params: [val, prId] },
      { sql: 'UPDATE purchase_requests SET emails_sent = ? WHERE pr_id LIKE ?', params: [val, `%${prId}%`] }
    ];

    let idx = 0;
    const attempt = () => {
      if (idx >= tryUpdates.length) return resolve({ success: false, changes: 0 });
      const q = tryUpdates[idx++];
      try {
        try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatusForce attempt sql=${q.sql} params=${JSON.stringify(q.params)}\n`); } catch (e) {}
        db.run(q.sql, q.params, function (err) {
          if (err) {
            try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatusForce ERROR prId=${prId} err=${err && err.message}\n`); } catch (e) {}
            return reject({ error: 'Failed to update emails_sent status', details: err.message });
          }
          try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatusForce result prId=${prId} changes=${this.changes}\n`); } catch (e) {}
          if (this.changes && this.changes > 0) {
            return resolve({ success: true, changes: this.changes });
          }
          // try next strategy
          attempt();
        });
      } catch (e) {
        try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] updatePurchaseRequestEmailsSentStatusForce EXCEPTION prId=${prId} err=${e && e.message}\n`); } catch (ee) {}
        return reject({ error: 'Failed to update emails_sent status', details: e.message });
      }
    };
    attempt();
  });
}

/**
 * Check whether a file exists on disk. Accepts absolute paths and normalizes separators.
 * Returns a Promise<boolean>.
 */
function fileExists(filePath) {
  return new Promise((resolve) => {
    try {
      if (!filePath || typeof filePath !== 'string') return resolve(false);
      const tryPaths = [filePath];
      // Normalized version
      tryPaths.push(path.normalize(filePath));
      // Swap slashes/backslashes
      tryPaths.push(filePath.replace(/\\/g, '/'));
      tryPaths.push(filePath.replace(/\//g, '\\'));

      let checked = 0;
      for (const p of tryPaths) {
        try {
          fs.access(p, fs.constants.F_OK, (err) => {
            checked++;
            if (!err) return resolve(true);
            if (checked === tryPaths.length) return resolve(false);
          });
        } catch (e) {
          checked++;
          if (checked === tryPaths.length) return resolve(false);
        }
      }
    } catch (e) {
      return resolve(false);
    }
  });
}

/**
 * Get basic file stats (size, mtime) for a given path. Returns null if not found.
 */
function getFileStats(filePath) {
  return new Promise((resolve) => {
    try {
      if (!filePath || typeof filePath !== 'string') return resolve(null);
      const candidate = path.normalize(filePath);
      fs.stat(candidate, (err, stats) => {
        if (err) {
          // Try alternate separators
          const alt = filePath.replace(/\\/g, '/');
          fs.stat(alt, (err2, stats2) => {
            if (err2) return resolve(null);
            return resolve({ size: stats2.size, mtime: stats2.mtime });
          });
        } else {
          return resolve({ size: stats.size, mtime: stats.mtime });
        }
      });
    } catch (e) {
      return resolve(null);
    }
  });
}

/**
 * Get a chronological audit/timeline for a product across PRs, receipts, manual changes and sales.
 * productId may be a cliniko_id or product_name (function matches against both columns).
 * opts: { includePRs, includeReceipts, includeChanges, includeSales, limit }
 */
function getProductAudit(productId, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!productId) return reject({ error: 'Missing productId' });

    const includePRs = opts.includePRs !== false;
    const includeReceipts = opts.includeReceipts !== false;
    const includeChanges = opts.includeChanges !== false;
    const includeSales = opts.includeSales !== false;
    const limit = Number(opts.limit || 1000) || 1000;

    const parts = [];
    const params = [];

    // Purchase request items (when the product was requested)
    if (includePRs) {
      parts.push(`SELECT pri.created_at AS date, 'purchase_request' AS action, pri.no_to_order AS qty_change, pri.id AS ref_id, pri.pr_id AS pr_id, pri.supplier_name AS supplier_name, NULL AS user_name, NULL AS location, NULL AS notes, pri.product_id, pri.product_name FROM purchase_request_items pri` +
        ` WHERE (pri.product_id = ? OR pri.product_name = ?)`);
      params.push(productId, productId);
    }

    // Item receipt log (when items were received)
    if (includeReceipts) {
      parts.push(`SELECT ir.timestamp AS date, 'receipt' AS action, ir.quantity_received AS qty_change, ir.id AS ref_id, ir.pr_id AS pr_id, NULL AS supplier_name, ir.received_by AS user_name, NULL AS location, ir.extra_json AS notes, ir.product_id, ir.product_name FROM item_receipt_log ir` +
        ` WHERE (ir.product_id = ? OR ir.product_name = ?)`);
      params.push(productId, productId);
    }

    // Product change log (manual edits)
    if (includeChanges) {
      parts.push(`SELECT pcl.timestamp AS date, 'change' AS action, NULL AS qty_change, pcl.rowid AS ref_id, NULL AS pr_id, NULL AS supplier_name, NULL AS user_name, NULL AS location, json_object('field', pcl.field_changed, 'before', pcl.before_value, 'after', pcl.after_value) AS notes, pcl.product_id, NULL AS product_name FROM product_change_log pcl` +
        ` WHERE pcl.product_id = ?`);
      params.push(productId);
    }

    // Product sales (sales reduce stock) - negative quantity to indicate outflow
    if (includeSales) {
      parts.push(`SELECT ps.invoice_date AS date, 'sale' AS action, (ps.quantity * -1) AS qty_change, ps.invoice_id AS ref_id, NULL AS pr_id, NULL AS supplier_name, NULL AS user_name, NULL AS location, NULL AS notes, ps.product_id, ps.product_name FROM product_sales ps` +
        ` WHERE (ps.product_id = ? OR ps.product_name = ?)`);
      params.push(productId, productId);
    }

    if (parts.length === 0) return resolve([]);

    const sql = parts.join('\nUNION ALL\n') + `\nORDER BY date DESC LIMIT ${limit}`;

    db.all(sql, params, (err, rows) => {
      if (err) return reject({ error: 'DB error', details: err.message });

      const normalized = (rows || []).map(r => {
        return {
          date: r.date || null,
          action: r.action || null,
          qty_change: (typeof r.qty_change !== 'undefined' && r.qty_change !== null) ? Number(r.qty_change) : null,
          ref_id: r.ref_id || null,
          pr_id: r.pr_id || null,
          supplier_name: r.supplier_name || null,
          user_name: r.user_name || null,
          location: r.location || null,
          notes: r.notes || null,
          product_id: r.product_id || null,
          product_name: r.product_name || null
        };
      });

      resolve(normalized);
    });
  });
}

// --- Demand & Reorder helpers ---
function getAverageDailyDemand(productId, days = 90) {
  return new Promise((resolve, reject) => {
    if (!productId) return resolve(0);
    const daysInt = Number(days) || 90;
    const sql = `SELECT COALESCE(SUM(quantity),0) AS total FROM product_sales WHERE product_id = ? AND invoice_date >= date('now', ?)`;
    const since = `-` + String(daysInt) + ` day`;
    db.get(sql, [productId, since], (err, row) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      const total = (row && row.total) ? Number(row.total) : 0;
      const avg = total / daysInt;
      resolve(avg);
    });
  });
}

function getSupplierLeadTime(supplierName) {
  return new Promise((resolve, reject) => {
    if (!supplierName) return resolve(null);
    // Prefer stored supplier field lead_time_days if present
    db.get('PRAGMA table_info(suppliers)', (err, cols) => {
      // PRAGMA returns rows via db.all normally; check column existence synchronously via a simple query
      db.all("PRAGMA table_info('suppliers')", (err2, rows) => {
        if (err2) return reject({ error: 'DB error', details: err2.message });
        const hasLeadCol = Array.isArray(rows) && rows.some(c => c && c.name === 'lead_time_days');
        if (hasLeadCol) {
          db.get('SELECT lead_time_days FROM suppliers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [supplierName], (err3, row3) => {
            if (err3) return reject({ error: 'DB error', details: err3.message });
            if (row3 && row3.lead_time_days !== null && typeof row3.lead_time_days !== 'undefined') {
              return resolve(Number(row3.lead_time_days));
            }
            // otherwise fallthrough to calculated lead time
            calcLeadTime();
          });
        } else {
          // no column, calculate
          calcLeadTime();
        }
        function calcLeadTime() {
          const sql = `SELECT AVG(julianday(ir.timestamp) - julianday(pr.date_created)) AS avg_lead_days
                       FROM item_receipt_log ir
                       JOIN purchase_requests pr ON pr.pr_id = ir.pr_id
                       JOIN purchase_request_items pri ON pri.pr_id = pr.pr_id AND (pri.product_id = ir.product_id OR pri.product_name = ir.product_name)
                       WHERE LOWER(TRIM(pri.supplier_name)) = LOWER(TRIM(?)) AND ir.timestamp IS NOT NULL AND pr.date_created IS NOT NULL`;
          db.get(sql, [supplierName], (err4, row4) => {
            if (err4) return reject({ error: 'DB error', details: err4.message });
            const avg = row4 && row4.avg_lead_days ? Number(row4.avg_lead_days) : null;
            resolve(avg);
          });
        }
      });
    });
  });
}

function setSupplierLeadTime(supplierName, days) {
  return new Promise((resolve, reject) => {
    if (!supplierName) return reject({ error: 'Missing supplierName' });
    const daysNum = Number(days);
    if (isNaN(daysNum) || daysNum < 0) return reject({ error: 'Invalid days' });

    // Ensure suppliers table has lead_time_days column
    db.all("PRAGMA table_info('suppliers')", (err, rows) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      const hasLeadCol = Array.isArray(rows) && rows.some(c => c && c.name === 'lead_time_days');
      const ensureCol = (cb) => {
        if (hasLeadCol) return cb();
        db.run('ALTER TABLE suppliers ADD COLUMN lead_time_days INTEGER DEFAULT NULL', (alterErr) => {
          // ignore errors from duplicate column attempts
          cb();
        });
      };
      ensureCol(() => {
        db.run('UPDATE suppliers SET lead_time_days = ? WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [daysNum, supplierName], function (uErr) {
          if (uErr) return reject({ error: 'DB error', details: uErr.message });
          if (this.changes === 0) {
            // Insert supplier row if not exists
            db.run('INSERT INTO suppliers (name, lead_time_days) VALUES (?, ?)', [supplierName, daysNum], function (insErr) {
              if (insErr) return reject({ error: 'DB error', details: insErr.message });
              resolve({ supplier: supplierName, lead_time_days: daysNum, created: true });
            });
          } else {
            resolve({ supplier: supplierName, lead_time_days: daysNum, updated: true });
          }
        });
      });
    });
  });
}

function getSuppliersWithLeadTime() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info('suppliers')", (err, rows) => {
      if (err) return reject({ error: 'DB error', details: err.message });
      const hasLeadCol = Array.isArray(rows) && rows.some(c => c && c.name === 'lead_time_days');
      if (!hasLeadCol) {
        // return supplier names with calculated lead times only
        db.all('SELECT DISTINCT supplier_name FROM purchase_request_items WHERE supplier_name IS NOT NULL', [], async (err2, supRows) => {
          if (err2) return reject({ error: 'DB error', details: err2.message });
          const result = [];
          for (const s of (supRows || [])) {
            const name = s.supplier_name || s.name;
            const calc = await getSupplierLeadTime(name).catch(() => null);
            result.push({ name, lead_time_days: calc });
          }
          resolve(result);
        });
      } else {
        db.all('SELECT id, name, lead_time_days FROM suppliers ORDER BY name', [], (err3, supRows2) => {
          if (err3) return reject({ error: 'DB error', details: err3.message });
          resolve(supRows2 || []);
        });
      }
    });
  });
}

function getReorderSuggestion(productId, opts = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!productId) return reject({ error: 'Missing productId' });
      const days = Number(opts.historyDays || 90);
      const avgDaily = await getAverageDailyDemand(productId, days).catch(() => 0);
      // Get product row for current stock and supplier
      db.get('SELECT cliniko_id, name, stock, supplier_name FROM products WHERE cliniko_id = ? OR cliniko_id = ? LIMIT 1', [productId, productId], async (err, prod) => {
        if (err) return reject({ error: 'DB error', details: err.message });
        const currentStock = (prod && typeof prod.stock !== 'undefined') ? Number(prod.stock) : 0;
        const supplierName = prod ? prod.supplier_name : null;
        // Determine lead time (days): prefer supplied value, else supplier average, else default 7
        let leadTime = Number(opts.leadTimeDays || 0) || null;
        if (!leadTime) {
          if (supplierName) {
            const supLead = await getSupplierLeadTime(supplierName).catch(() => null);
            if (supLead) leadTime = Math.max(1, Math.round(supLead));
          }
        }
        if (!leadTime) leadTime = Number(opts.defaultLead || 7);

        // Safety stock: use z for service level (default 95% -> z=1.65) and sigma ~ assume sqrt(daily*days) as rough proxy when history sparse
        const serviceLevel = Number(opts.serviceLevelPct || 95);
        const z = serviceLevel >= 99 ? 2.33 : (serviceLevel >= 95 ? 1.65 : 1.28);
        // Estimate sigma_daily as sqrt(avgDaily) (Poisson-like) fallback
        const sigmaDaily = Math.sqrt(Math.max(0, avgDaily));
        const safetyStock = Math.ceil(z * sigmaDaily * Math.sqrt(leadTime));

        // Recommended order qty: simple cover for leadTime + review period (default 7 days)
        const reviewDays = Number(opts.reviewDays || 7);
        let recommendedQty = Math.ceil(avgDaily * (leadTime + reviewDays));
        if (recommendedQty <= 0) recommendedQty = Math.max(1, Math.ceil((avgDaily || 0) + safetyStock));

        const reorderPoint = Math.ceil(avgDaily * leadTime + safetyStock);

        resolve({ productId, productName: prod && prod.name, currentStock, avgDaily, leadTime, safetyStock, reorderPoint, recommendedQty, supplierName });
      });
    } catch (e) {
      reject({ error: 'Failed to compute reorder suggestion', details: e && e.message ? e.message : e });
    }
  });
}

function getVendorConsolidation(windowDays = 14, opts = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // Find products likely to need reorder within windowDays
      const days = Number(opts.historyDays || 90);
      // Get all products with avg daily demand
      db.all('SELECT cliniko_id, name, stock, supplier_name FROM products', async (err, rows) => {
        if (err) return reject({ error: 'DB error', details: err.message });
        const candidates = [];
        for (const r of (rows || [])) {
          const avg = await getAverageDailyDemand(r.cliniko_id, days).catch(() => 0);
          const lead = await (r.supplier_name ? getSupplierLeadTime(r.supplier_name).catch(() => null) : Promise.resolve(null));
          const leadDays = lead ? Math.max(1, Math.round(lead)) : (opts.defaultLead || 7);
          const daysCover = avg > 0 ? (r.stock / avg) : Infinity;
          // if projected days of cover <= windowDays + leadDays then candidate
          if (daysCover <= (windowDays + leadDays)) {
            const recommendedQty = Math.ceil(avg * (leadDays + (opts.reviewDays || 7)));
            candidates.push({ productId: r.cliniko_id, productName: r.name, supplier: r.supplier_name, currentStock: r.stock, avgDaily: avg, leadDays, recommendedQty });
          }
        }

        // Group by supplier
        const bySupplier = {};
        for (const c of candidates) {
          const s = c.supplier || 'Unknown Supplier';
          if (!bySupplier[s]) bySupplier[s] = { supplier: s, items: [] };
          bySupplier[s].items.push(c);
        }

        resolve(Object.values(bySupplier));
      });
    } catch (e) {
      reject({ error: 'Failed to compute vendor consolidation', details: e && e.message ? e.message : e });
    }
  });
}

// --- Supplier/Product volume discount helpers ---
function addSupplierProductDiscount(discount) {
  return new Promise((resolve, reject) => {
    const {
      supplier_id = null,
      product_cliniko_id = null,
      min_qty = 1,
      price_per_unit = null,
      percent_discount = null,
      currency = null,
      effective_from = null,
      effective_to = null,
      notes = null
    } = discount || {};

    db.run(`INSERT INTO supplier_product_discounts (supplier_id, product_cliniko_id, min_qty, price_per_unit, percent_discount, currency, effective_from, effective_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supplier_id, product_cliniko_id, min_qty, price_per_unit, percent_discount, currency, effective_from, effective_to, notes], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      });
  });
}

function updateSupplierProductDiscount(id, updates) {
  return new Promise((resolve, reject) => {
    if (!id) return reject({ error: 'Missing id' });
    const fields = [];
    const params = [];
    const keys = ['supplier_id','product_cliniko_id','min_qty','price_per_unit','percent_discount','currency','effective_from','effective_to','notes'];
    keys.forEach(k => { if (typeof updates[k] !== 'undefined') { fields.push(`${k} = ?`); params.push(updates[k]); } });
    if (fields.length === 0) return resolve({ success: true });
    params.push(id);
    const sql = `UPDATE supplier_product_discounts SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, params, function (err) { if (err) return reject(err); resolve({ changes: this.changes }); });
  });
}

function deleteSupplierProductDiscount(id) {
  return new Promise((resolve, reject) => {
    if (!id) return reject({ error: 'Missing id' });
    db.run('DELETE FROM supplier_product_discounts WHERE id = ?', [id], function (err) { if (err) return reject(err); resolve({ deleted: this.changes }); });
  });
}

function listSupplierProductDiscounts({ supplier_id = null, product_cliniko_id = null } = {}) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM supplier_product_discounts WHERE 1=1';
    const params = [];
    if (supplier_id !== null) { sql += ' AND supplier_id = ?'; params.push(supplier_id); }
    if (product_cliniko_id !== null) { sql += ' AND product_cliniko_id = ?'; params.push(product_cliniko_id); }
    sql += ' ORDER BY min_qty DESC, supplier_id';
    db.all(sql, params, (err, rows) => { if (err) return reject(err); resolve(rows || []); });
  });
}

/**
 * Find the best applicable discount for a given supplier/product/quantity and date.
 * Priority: exact product-level discounts (supplier+product), then supplier-wide discounts, then global product-only discounts.
 * Returns the best discount row or null.
 */
function findApplicableDiscount({ supplier_id = null, product_cliniko_id = null, qty = 1, onDate = null } = {}) {
  return new Promise((resolve, reject) => {
    const dateClause = (onDate ? `AND (effective_from IS NULL OR DATE(effective_from) <= DATE(?)) AND (effective_to IS NULL OR DATE(effective_to) >= DATE(?))` : '');
    const params = [];
    if (onDate) { params.push(onDate, onDate); }

    // Query product-level for this supplier
    let sqls = [];
    if (supplier_id && product_cliniko_id) {
      sqls.push({ sql: `SELECT * FROM supplier_product_discounts WHERE supplier_id = ? AND product_cliniko_id = ? AND min_qty <= ? ${dateClause} ORDER BY min_qty DESC LIMIT 1`, params: [supplier_id, product_cliniko_id, qty].concat(onDate ? [onDate, onDate] : []) });
    }
    // Supplier-wide discounts
    if (supplier_id) {
      sqls.push({ sql: `SELECT * FROM supplier_product_discounts WHERE supplier_id = ? AND product_cliniko_id IS NULL AND min_qty <= ? ${dateClause} ORDER BY min_qty DESC LIMIT 1`, params: [supplier_id, qty].concat(onDate ? [onDate, onDate] : []) });
    }
    // Product-only (global) discounts
    if (product_cliniko_id) {
      sqls.push({ sql: `SELECT * FROM supplier_product_discounts WHERE supplier_id IS NULL AND product_cliniko_id = ? AND min_qty <= ? ${dateClause} ORDER BY min_qty DESC LIMIT 1`, params: [product_cliniko_id, qty].concat(onDate ? [onDate, onDate] : []) });
    }

    const tryNext = (idx) => {
      if (idx >= sqls.length) return resolve(null);
      const q = sqls[idx];
      db.get(q.sql, q.params, (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(row);
        tryNext(idx + 1);
      });
    };

    tryNext(0);
  });
}

module.exports = {
  gatherPoTemplateOptions,
  getAllProducts,
  getAllProductsWithWrapper,
  getProductCount,
  addUser,
  getAllUsers,
  login,
  getCurrentUser,
  getPurchaseRequests,
  getPurchaseRequestById,
  setPurchaseRequestReceived,
  createPurchaseRequest,
  deletePurchaseRequest,
  deleteUser,
  changeUserPassword,
  updateReorderLevels,
  updateReorderLevelsFromFile,
  generateReorderLevelsTemplate,
  updateProductReorderLevel,
  getProductSales,
  getSalesInsights,
  getSalesInsightsWithCustomRanges,
  getProductOptions,
  downloadFile,
  getApiKey,
  setApiKey,
  getProductAudit,
  getActualApiKey,
  getAverageDailyDemand,
  getSupplierLeadTime,
  getReorderSuggestion,
  getVendorConsolidation,
  // discounts
  addSupplierProductDiscount,
  updateSupplierProductDiscount,
  deleteSupplierProductDiscount,
  listSupplierProductDiscounts,
  findApplicableDiscount,
  setSupplierLeadTime,
  getSuppliersWithLeadTime,
  getGitHubToken,
  setGitHubToken,
  syncProductsFromCliniko,
  updateStockFromCliniko,
  updateSalesDataFromCliniko,
  previewSalesDataCount,
  getSessionTimeout,
  setSessionTimeout,
  updatePurchaseRequestReceived,
  receiveItemById,
  updatePurchaseRequestItemsWithComment,
  updatePurchaseRequestItemsEditWithComment,
  getActivePURsForBarcode,
  createSupplierOrderFilesForVendors,
  // User behavior logging functions
  startUserSession,
  endUserSession,
  logUserBehavior,
  setUserPreference,
  getUserPreferences,
  getUserBehaviorAnalytics,
  getAllUsersBehaviorInsights,
  // Cliniko stock update functions
  getClinikoStockUpdateSetting,
  setClinikoStockUpdateSetting,
  updateClinikoStock,
  // Auto-deactivate Cliniko suppliers setting
  getAutoDeactivateClinikoSuppliers,
  setAutoDeactivateClinikoSuppliers,
  // Supplier management functions
  getAllSuppliers,
  getInactiveSuppliers,
  reactivateSupplier,
  deactivateSupplier,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierByName,
  autoPopulateSuppliersFromCliniko,
  // Product management functions
  activateProduct,
  deactivateProduct,
  // Email template functions
  saveEmailTemplate,
  getEmailTemplate,
  // PO template functions
  savePoTemplate,
  getPoTemplate,
  // App settings
  getAppSetting,
  setAppSetting,
  updatePurchaseRequestWithComment,
  getPoChangeLog,
  // Smart Prompts setting functions
  getSmartPromptsSetting,
  setSmartPromptsSetting,
  // File management functions for supplier files
  getGeneratedFiles,
  deleteGeneratedFile,
  markVendorFilesCreated,
  hasVendorFilesCreated,
  updatePurchaseRequestSupplierFilesStatus,
  updatePurchaseRequestOftFilesStatus,
  updatePurchaseRequestEmailsSentStatus,
  // First time setup functions
  isFirstTimeSetup,
  createFirstAdminUser,
  checkDefaultPasswordWarning,
  clearDefaultPasswordWarning,
  db // Export db for advanced queries
};

// Export additional filesystem helpers
module.exports.fileExists = fileExists;
module.exports.getFileStats = getFileStats;
