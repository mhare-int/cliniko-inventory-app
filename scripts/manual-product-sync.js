const { syncProductsFromCliniko } = require('./backend/db.js');

console.log('🚀 Starting manual product sync from Cliniko...');

syncProductsFromCliniko()
  .then(result => {
    console.log('✅ Product sync completed successfully!');
    console.log('Result:', result);
    console.log(`📊 Products synced: ${result.products_synced || result.inserted || 0}`);
    console.log(`🏢 Suppliers updated: ${result.suppliers_added || 0}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Product sync failed:', error);
    process.exit(1);
  });
