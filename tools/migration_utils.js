/**
 * Migration compatibility and testing utilities
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { runMigrations, getCurrentVersion } = require('../backend/migrations.js');

/**
 * Detect likely app version based on database schema
 */
async function detectAppVersion(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    // Check for version table first
    db.get('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1', (err, row) => {
      if (!err && row) {
        db.close();
        return resolve({
          detected: 'schema_version',
          version: row.version,
          likely_app_version: mapSchemaToAppVersion(row.version)
        });
      }
      
      // No version table or error, analyze table structure
      db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        const tableNames = tables.map(t => t.name);
        
        // Check for key indicators
        const indicators = {
          has_suppliers: tableNames.includes('suppliers'),
          has_products: tableNames.includes('products'),
          has_purchase_requests: tableNames.includes('purchase_requests'),
          has_users: tableNames.includes('users'),
          has_settings: tableNames.includes('settings'),
          has_user_behavior_log: tableNames.includes('user_behavior_log'),
          has_vendor_files: tableNames.includes('vendor_files'),
          has_supplier_product_discounts: tableNames.includes('supplier_product_discounts')
        };
        
        // Check column structure for more detailed analysis
        db.all("PRAGMA table_info(products)", (err, productCols) => {
          if (err) productCols = [];
          
          db.all("PRAGMA table_info(suppliers)", (err, supplierCols) => {
            if (err) supplierCols = [];
            
            const productColNames = productCols.map(c => c.name);
            const supplierColNames = supplierCols.map(c => c.name);
            
            indicators.products_has_stock = productColNames.includes('stock');
            indicators.products_has_current_stock = productColNames.includes('current_stock');
            indicators.products_has_supplier_name = productColNames.includes('supplier_name');
            indicators.products_has_unit_price = productColNames.includes('unit_price');
            indicators.products_has_supplier_id = productColNames.includes('supplier_id');
            indicators.suppliers_has_lead_time = supplierColNames.includes('lead_time_days');
            indicators.suppliers_has_active = supplierColNames.includes('active');
            
            const estimatedVersion = estimateVersionFromIndicators(indicators);
            
            db.close();
            resolve({
              detected: 'schema_analysis',
              indicators,
              estimated_schema_version: estimatedVersion,
              likely_app_version: mapSchemaToAppVersion(estimatedVersion),
              table_count: tableNames.length,
              tables: tableNames
            });
          });
        });
      });
    });
  });
}

/**
 * Map schema version to likely app version
 */
function mapSchemaToAppVersion(schemaVersion) {
  if (schemaVersion >= 22) return '2.0.5+';
  if (schemaVersion >= 20) return '2.0.4-2.0.5';
  if (schemaVersion >= 15) return '2.0.3-2.0.4';
  if (schemaVersion >= 10) return '2.0.2-2.0.3';
  if (schemaVersion >= 5) return '2.0.1-2.0.2';
  if (schemaVersion >= 1) return '2.0.0-2.0.1';
  return 'pre-2.0.0 or unknown';
}

/**
 * Estimate schema version from database indicators
 */
function estimateVersionFromIndicators(indicators) {
  let version = 0;
  
  // Basic tables suggest version 1+
  if (indicators.has_products && indicators.has_suppliers) version = 1;
  
  // Settings with updated_at suggests version 2+
  if (version > 0) version = 2;
  
  // Stock column and supplier_name suggest version 3+
  if (indicators.products_has_stock && indicators.products_has_supplier_name) version = 3;
  
  // User behavior tracking suggests version 5+
  if (indicators.has_user_behavior_log) version = 5;
  
  // Vendor files suggests version 14+
  if (indicators.has_vendor_files) version = 14;
  
  // Unit price suggests version 16+
  if (indicators.products_has_unit_price) version = 16;
  
  // Supplier ID suggests version 19+
  if (indicators.products_has_supplier_id) version = 19;
  
  // Lead time suggests version 21+
  if (indicators.suppliers_has_lead_time) version = 21;
  
  // Supplier discounts suggests version 22+
  if (indicators.has_supplier_product_discounts) version = 22;
  
  return version;
}

/**
 * Create a pre-migration backup with version info
 */
async function createVersionedBackup(dbPath) {
  const analysis = await detectAppVersion(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `appdata.db.backup.pre-upgrade.v${analysis.estimated_schema_version || 'unknown'}.${timestamp}`;
  const backupPath = path.join(path.dirname(dbPath), backupName);
  
  return new Promise((resolve, reject) => {
    fs.copyFile(dbPath, backupPath, (err) => {
      if (err) reject(err);
      else {
        console.log(`✅ Created versioned backup: ${backupName}`);
        console.log(`📊 Detected schema version: ${analysis.estimated_schema_version}`);
        console.log(`📱 Likely app version: ${analysis.likely_app_version}`);
        resolve({ backupPath, analysis });
      }
    });
  });
}

/**
 * Test migration from any version to current
 */
async function testMigrationFromVersion(dbPath) {
  try {
    console.log('🔍 Analyzing database version...');
    const analysis = await detectAppVersion(dbPath);
    console.log('Database analysis:', JSON.stringify(analysis, null, 2));
    
    console.log('📦 Creating backup...');
    const backup = await createVersionedBackup(dbPath);
    
    console.log('🚀 Testing migration...');
    const db = new sqlite3.Database(dbPath);
    
    const initialVersion = await getCurrentVersion(db);
    console.log(`📊 Initial schema version: ${initialVersion}`);
    
    await runMigrations(db);
    
    const finalVersion = await getCurrentVersion(db);
    console.log(`📊 Final schema version: ${finalVersion}`);
    
    db.close();
    
    console.log('✅ Migration test successful!');
    return { success: true, initialVersion, finalVersion, backup: backup.backupPath };
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  detectAppVersion,
  createVersionedBackup,
  testMigrationFromVersion,
  mapSchemaToAppVersion,
  estimateVersionFromIndicators
};
