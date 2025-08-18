const db = require('../backend/db');

(async () => {
  try {
    console.log('Calling syncProductsFromCliniko...');
    const res = await db.syncProductsFromCliniko();
    console.log('syncProductsFromCliniko result:', res);

    console.log('Querying getAllProductsWithWrapper...');
    const all = await db.getAllProductsWithWrapper();
    console.log('getAllProductsWithWrapper result:', all && all.products ? all.products.length : (all.error || 'no data'));
  } catch (e) {
    console.error('Diagnostic error:', e);
  }
})();
