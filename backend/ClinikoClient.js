/**
 * Cliniko API Client
 * Handles authentication, rate limiting, and pagination for Cliniko API calls
 */

const https = require('https');
const http = require('http');

class ClinikoClient {
  /**
   * @param {string} apiKey - Cliniko API key
   * @param {Object} [options] - Client options
   * @param {number} [options.requestsPerMinute=45] - Rate limit (default 45 to leave buffer)
   * @param {string} [options.userAgent='StockProcurementApp'] - User agent for requests
   */
  constructor(apiKey, options = {}) {
    this.baseUrl = 'https://api.au1.cliniko.com/v1';
    this.apiKey = apiKey;
    this.authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
    this.userAgent = options.userAgent || 'StockProcurementApp';
    
    // Rate limiting
    this.requestsPerMinute = options.requestsPerMinute || 45;
    this.minInterval = (60 * 1000) / this.requestsPerMinute;
    this.lastRequest = 0;
  }

  /**
   * Wait for rate limit before making request
   * @private
   */
  async _waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    const waitTime = Math.max(0, this.minInterval - elapsed);
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }

  /**
   * Make HTTP request to Cliniko API with retry logic
   * @param {string} url - Full URL or endpoint path
   * @param {number} [retryAttempt=0] - Current retry attempt (for recursion)
   * @returns {Promise<Object>} Parsed JSON response
   */
  async request(url, retryAttempt = 0) {
    await this._waitForRateLimit();

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const urlObj = new URL(fullUrl);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const maxRetries = 3;
    const retryableStatusCodes = [429, 500, 502, 503, 504]; // Rate limit + server errors
    const baseDelay = 1000; // 1 second

    return new Promise((resolve, reject) => {
      let data = '';
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'User-Agent': this.userAgent
        }
      };

      const req = httpModule.request(options, (res) => {
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', async () => {
          // Handle retryable status codes
          if (retryableStatusCodes.includes(res.statusCode) && retryAttempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryAttempt); // Exponential backoff
            console.warn(`Cliniko API returned ${res.statusCode}, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${maxRetries})`);
            
            await new Promise(r => setTimeout(r, delay));
            
            try {
              const result = await this.request(url, retryAttempt + 1);
              resolve(result);
            } catch (retryErr) {
              reject(retryErr);
            }
            return;
          }
          
          // Non-retryable error or max retries exceeded
          if (res.statusCode >= 400) {
            reject({
              error: `Cliniko API error ${res.statusCode}`,
              statusCode: res.statusCode,
              details: data.substring(0, 500),
              retryAttempts: retryAttempt
            });
            return;
          }
          
          // Success - parse response
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (parseErr) {
            reject({
              error: 'Failed to parse Cliniko API response',
              statusCode: res.statusCode,
              details: data.substring(0, 500)
            });
          }
        });
      });

      req.on('error', async (err) => {
        // Network errors are retryable
        if (retryAttempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryAttempt);
          console.warn(`Network error, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${maxRetries}):`, err.message);
          
          await new Promise(r => setTimeout(r, delay));
          
          try {
            const result = await this.request(url, retryAttempt + 1);
            resolve(result);
          } catch (retryErr) {
            reject(retryErr);
          }
          return;
        }
        
        reject({
          error: 'HTTP request failed after retries',
          details: err.message,
          retryAttempts: retryAttempt
        });
      });

      req.end();
    });
  }

  /**
   * Fetch all pages from a paginated Cliniko API endpoint
   * @param {string} endpoint - API endpoint (e.g., '/products')
   * @param {Function} [onProgress] - Optional callback called after each page with (pageNumber, totalItems)
   * @returns {Promise<Array>} All items from all pages
   */
  async fetchAllPages(endpoint, onProgress = null) {
    const allItems = [];
    let nextUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    let pageNumber = 1;

    while (nextUrl) {
      const response = await this.request(nextUrl);
      
      // Handle different response structures (products, invoices, etc.)
      const items = response.products || response.invoices || response.items || [];
      
      if (!Array.isArray(items)) {
        throw {
          error: 'Unexpected Cliniko API response structure',
          details: `Expected array but got ${typeof items}`
        };
      }

      allItems.push(...items);
      
      if (onProgress) {
        onProgress(pageNumber, allItems.length);
      }

      // Get next page URL
      nextUrl = response.links && response.links.next ? response.links.next : null;
      pageNumber++;
    }

    return allItems;
  }

  /**
   * Fetch products from Cliniko API
   * @param {Object} [options] - Fetch options
   * @param {boolean} [options.excludeArchived=true] - Filter out archived products
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Array>} Array of products
   */
  async fetchProducts(options = {}) {
    const { excludeArchived = true, onProgress } = options;
    
    const allProducts = await this.fetchAllPages('/products', onProgress);
    
    if (excludeArchived) {
      return allProducts.filter(p => !p.archived_at);
    }
    
    return allProducts;
  }

  /**
   * Fetch invoices from Cliniko API for a date range
   * @param {string} [startDate] - ISO date string (e.g., '2024-01-01')
   * @param {string} [endDate] - ISO date string
   * @param {Function} [onProgress] - Progress callback
   * @returns {Promise<Array>} Array of invoices
   */
  async fetchInvoices(startDate = null, endDate = null, onProgress = null) {
    let endpoint = '/invoices?sort=created_at';
    
    // Add date filters if provided
    const params = [];
    if (startDate) params.push(`q[created_at_gteq]=${startDate}`);
    if (endDate) params.push(`q[created_at_lteq]=${endDate}`);
    
    if (params.length > 0) {
      endpoint += '&' + params.join('&');
    }
    
    return await this.fetchAllPages(endpoint, onProgress);
  }

  /**
   * De-duplicate items by ID field
   * @param {Array} items - Items to de-duplicate
   * @param {string} [idField='id'] - Field name to use for de-duplication
   * @returns {Array} De-duplicated items
   */
  static deduplicateById(items, idField = 'id') {
    const uniqueById = new Map();
    
    for (const item of items) {
      const id = String(item[idField]);
      if (!uniqueById.has(id)) {
        uniqueById.set(id, item);
      }
    }
    
    return Array.from(uniqueById.values());
  }

  /**
   * Extract unique supplier names from products
   * @param {Array} products - Array of products
   * @param {string} [supplierField='product_supplier_name'] - Field containing supplier name
   * @returns {Set} Set of unique supplier names
   */
  static extractUniqueSuppliers(products, supplierField = 'product_supplier_name') {
    const suppliers = new Set();
    
    for (const product of products) {
      const supplierName = product[supplierField];
      if (supplierName && String(supplierName).trim() !== '') {
        suppliers.add(String(supplierName).trim());
      }
    }
    
    return suppliers;
  }
}

module.exports = ClinikoClient;
