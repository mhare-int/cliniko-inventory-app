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
function createSupplierOrderFilesForVendors(items, outputFolder) {
  return new Promise(async (resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) {
      return reject({ error: 'No items provided' });
    }
    if (!outputFolder || typeof outputFolder !== 'string') {
      return reject({ error: 'No output folder specified' });
    }
    try {
      // Ensure output folder exists
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      // Call the utility (assumed to return a Promise)
      const files = await createSupplierOrderFiles(items, outputFolder);
      resolve({ message: 'Supplier order files created', files });
    } catch (err) {
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
      db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, userId], function (err) {
        if (err) return reject({ error: 'DB error', details: err.message || err });
        if (this.changes === 0) return reject({ error: 'User not found' });
        resolve({ message: 'Password updated' });
      });
    } catch (e) {
      reject({ error: 'Hashing error', details: e.message || e });
    }
  });
}

module.exports.changeUserPassword = changeUserPassword;
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
    db.run('REPLACE INTO settings (key, value) VALUES (?, ?)', ['SESSION_TIMEOUT_HOURS', String(Number(hours))], function (err) {
      if (err) return reject(err);
      resolve({ message: 'Session timeout updated', hours: Number(hours) });
    });
  });
}

module.exports.getSessionTimeout = getSessionTimeout;
module.exports.setSessionTimeout = setSessionTimeout;
// --- Update stock from Cliniko API ---
const https = require('https');
const { URL } = require('url');
const httpOrHttps = require('follow-redirects').https || https;
function updateStockFromCliniko() {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
      if (err || !row || !row.value) return reject({ error: 'No Cliniko API key set' });
      const apiKey = row.value.trim();
      const allProducts = [];
      let nextUrl = 'https://api.au1.cliniko.com/v1/products';
      // Use Basic Auth as in the working test script
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
              // Map to cliniko_list schema
              const cliniko_list = allProducts.map(item => ({
                'Id': String(item.id),
                'Stock': item.stock_level,
                'Reorder Level': 0,
                'Product Name': item.name,
                'Supplier Name': item.product_supplier_name
              }));
              // Update local DB stock for each product
              let updated = 0;
              let total = cliniko_list.length;
              if (total === 0) return resolve({ message: 'No products to update' });
              cliniko_list.forEach(prod => {
                const cliniko_id = prod['Id'];
                const stock = prod['Stock'] || 0;
                db.run('UPDATE products SET stock=? WHERE cliniko_id=?', [stock, cliniko_id], (err2) => {
                  updated++;
                  if (updated === total) resolve({ message: 'Stock updated from Cliniko', total });
                });
              });
            }
          });
        });
        req.on('error', (e) => reject({ error: e.message }));
        req.end();
      }
      fetchPage(nextUrl);
    });
  });
}
const path = require('path');

// --- Update Sales Data from Cliniko ---
function updateSalesDataFromCliniko(startDate = null, endDate = null) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
      if (err || !row || !row.value) return reject({ error: 'No Cliniko API key set' });
      const apiKey = row.value.trim();
      
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
            console.log(`Resuming sync from latest date in DB: ${startDate}`);
            
            // Check if there are actually any new invoices since our latest date
            // Use created_at instead of updated_at for more reliable checking
            const checkUrl = `https://api.au1.cliniko.com/v1/invoices?per_page=5&q[]=created_at:>${startDate}&sort=created_at:desc`;
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
    const today = new Date();
    const lastYear = today.getFullYear() - 1;
    const nextMonth = today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2;
    const yearForNextMonth = today.getMonth() + 2 > 12 ? lastYear + 1 : lastYear;
    const start_date = new Date(yearForNextMonth, nextMonth - 1, 1);
    const end_date = nextMonth === 12 ? new Date(yearForNextMonth + 1, 0, 1) : new Date(yearForNextMonth, nextMonth, 1);
    const start_date_str = start_date.toISOString().slice(0, 10);
    const end_date_str = end_date.toISOString().slice(0, 10);
    const last_month_start = new Date(today.getFullYear(), today.getMonth(), 1);
    const last_month_end = today.getMonth() < 11 ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : new Date(today.getFullYear() + 1, 0, 1);
    const last_month_start_str = last_month_start.toISOString().slice(0, 10);
    const last_month_end_str = last_month_end.toISOString().slice(0, 10);
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
    db.all(query, params, (err, rows) => {
      if (err) return reject({ error: 'DB error' });
      const insights = rows.map(row => ({
        product_name: row.product_name,
        total_quantity: row.total_quantity,
        current_stock: row.current_stock,
        last_month_sales: row.last_month_sales || 0,
        currently_ordered: row.currently_ordered || 0
      }));
      resolve(insights);
    });
  });
}

function getSalesInsightsWithCustomRanges(customRanges = [], limit = 500, offset = 0) {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const lastYear = today.getFullYear() - 1;
    const nextMonth = today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2;
    const yearForNextMonth = today.getMonth() + 2 > 12 ? lastYear + 1 : lastYear;
    const start_date = new Date(yearForNextMonth, nextMonth - 1, 1);
    const end_date = nextMonth === 12 ? new Date(yearForNextMonth + 1, 0, 1) : new Date(yearForNextMonth, nextMonth, 1);
    const start_date_str = start_date.toISOString().slice(0, 10);
    const end_date_str = end_date.toISOString().slice(0, 10);
    const last_month_start = new Date(today.getFullYear(), today.getMonth(), 1);
    const last_month_end = today.getMonth() < 11 ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : new Date(today.getFullYear() + 1, 0, 1);
    const last_month_start_str = last_month_start.toISOString().slice(0, 10);
    const last_month_end_str = last_month_end.toISOString().slice(0, 10);
    
    // Build custom range subqueries
    const customRangeSelects = customRanges.map((range, index) => `
               (
                   SELECT SUM(ps${index + 3}.quantity)
                   FROM product_sales ps${index + 3}
                   WHERE ps${index + 3}.product_name = ps.product_name
                     AND ps${index + 3}.invoice_date >= ?
                     AND ps${index + 3}.invoice_date <= ?
               ) as custom_range_${index}`).join(',');
    
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
    
    db.all(query, params, (err, rows) => {
      if (err) return reject({ error: 'DB error' });
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
      resolve(insights);
    });
  });
}

module.exports.getProductSales = getProductSales;
module.exports.getSalesInsights = getSalesInsights;
module.exports.getSalesInsightsWithCustomRanges = getSalesInsightsWithCustomRanges;
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
    const filePath = path.join(uploadDir, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) return reject({ error: 'File not found' });
      resolve(filePath);
    });
  });
}

module.exports.getProductOptions = getProductOptions;
module.exports.downloadFile = downloadFile;
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
        let token;
        try {
          token = jwt.sign({ id: user.id, username: user.username, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        } catch (jwtErr) {
          console.error('JWT sign error:', jwtErr);
          return reject({ error: 'Token generation error', details: jwtErr.message || jwtErr });
        }
        resolve({ token });
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

module.exports.login = login;
module.exports.getCurrentUser = getCurrentUser;
// --- Purchase Requests ---
// Create PR
function createPurchaseRequest(data) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM purchase_requests', (err, row) => {
      if (err) return reject(err);
      const pr_count = (row ? row.count : 0) + 1;
      const pr_id = `PUR${String(pr_count).padStart(5, '0')}`;
      const date_created = new Date().toISOString();
      db.run('INSERT INTO purchase_requests (pr_id, date_created, received) VALUES (?, ?, ?)', [pr_id, date_created, 0], function (err2) {
        if (err2) return reject(err2);
        const items = data.items || [];
        let pending = items.length;
        if (pending === 0) return resolve({ id: pr_id });
        items.forEach(item => {
          const product_id = item.Id || item.id || item.product_id;
          const product_name = item['Product Name'] || item.name || item.product_name;
          const supplier_name = item['Supplier Name'] || item.supplier_name;
          const no_to_order = item['No. to Order'] || item.no_to_order || item.qty || 0;
          db.run(
            `INSERT INTO purchase_request_items (pr_id, product_id, product_name, supplier_name, no_to_order, received, received_so_far)
            VALUES (?, ?, ?, ?, ?, 0, 0)`,
            [pr_id, product_id, product_name, supplier_name, no_to_order],
            () => {
              if (--pending === 0) resolve({ id: pr_id });
            }
          );
        });
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
              'pr_id': pr.pr_id,
              'date_created': pr.date_created,
              'date_received': pr.date_received
            }));
            resolve2({
              id: pr.pr_id,
              date_created: pr.date_created,
              date_received: pr.date_received,
              received: pr.received,
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
                'pr_id': pr.pr_id,
                'date_created': pr.date_created,
                'date_received': pr.date_received
              });
            });
            pr_list.push({
              id: pr.pr_id,
              date_created: pr.date_created,
              date_received: pr.date_received,
              received: pr.received,
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

module.exports.createPurchaseRequest = createPurchaseRequest;
module.exports.getPurchaseRequests = getPurchaseRequests;
module.exports.deletePurchaseRequest = deletePurchaseRequest;
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

module.exports.updateReorderLevels = updateReorderLevels;
module.exports.updateProductReorderLevel = updateProductReorderLevel;

const sqlite3 = require('sqlite3').verbose();
const { runMigrations, backupDatabase } = require('./migrations');

const dbPath = path.join(__dirname, 'appdata.db');
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Failed to connect to database:', err);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    
    try {
      // Create backup before running migrations
      await backupDatabase(dbPath);
      
      // Run any pending migrations
      await runMigrations(db);
      
      // Ensure settings table exists
      db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
      
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

function setApiKey(newKey) {
  return new Promise((resolve, reject) => {
    if (!newKey || typeof newKey !== 'string' || !newKey.trim()) {
      return reject({ error: 'Missing or invalid API key' });
    }
    db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', ['CLINIKO_API_KEY', newKey.trim()], function (err) {
      if (err) return reject(err);
      resolve({ message: 'API key updated' });
    });
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
function updatePurchaseRequestReceived(pr_id, lines, receivedBy = null) {
  return new Promise((resolve, reject) => {
    if (!pr_id || !Array.isArray(lines) || lines.length === 0) {
      return reject({ error: 'Missing PR ID or lines' });
    }
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
                // Check if ALL items in this PR are fully received
                db.all('SELECT * FROM purchase_request_items WHERE pr_id = ?', [pr_id], (err3, allItems) => {
                  if (err3) return resolve({ message: 'Updated but could not check PR status' });
                  
                  const allFullyReceived = allItems.every(item => (item.received_so_far || 0) >= item.no_to_order);
                  if (allFullyReceived) {
                    db.run('UPDATE purchase_requests SET received=1, date_received=? WHERE pr_id=?', [new Date().toISOString(), pr_id], () => {
                      resolve({ message: 'PR fully received' });
                    });
                  } else {
                    resolve({ message: 'PR partially received' });
                  }
                });
              }
            }
          );
        });
      });
    });
  });
}

module.exports.updatePurchaseRequestReceived = updatePurchaseRequestReceived;

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

      // Get API key from settings (similar to updateStockFromCliniko)
      db.get('SELECT value FROM settings WHERE key = ?', ['CLINIKO_API_KEY'], (err, row) => {
        if (err || !row || !row.value) {
          return reject({ error: 'Cliniko API key not configured' });
        }
        
        const apiKey = row.value.trim();
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
      });

    } catch (error) {
      reject({ error: 'Failed to update Cliniko stock', details: error.message });
    }
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

module.exports = {
  getAllProducts,
  addUser,
  getAllUsers,
  login,
  getCurrentUser,
  getPurchaseRequests,
  createPurchaseRequest,
  deletePurchaseRequest,
  deleteUser,
  changeUserPassword,
  updateReorderLevels,
  updateProductReorderLevel,
  getProductSales,
  getSalesInsights,
  getSalesInsightsWithCustomRanges,
  getProductOptions,
  downloadFile,
  getApiKey,
  setApiKey,
  updateStockFromCliniko,
  updateSalesDataFromCliniko,
  getSessionTimeout,
  setSessionTimeout,
  updatePurchaseRequestReceived,
  receiveItemById,
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
  // Smart Prompts setting functions
  getSmartPromptsSetting,
  setSmartPromptsSetting,
  db // Export db for advanced queries
};
