const { syncProductsFromCliniko } = require('./backend/db');

console.log('🔧 Fixing missing product supplier and price data...');
console.log('This will sync products from Cliniko to fill in missing supplier_name and unit_price data.\n');

async function fixProductData() {
  try {
    console.log('🔄 Running product sync to fix missing data...');
    const result = await syncProductsFromCliniko();
    
    console.log('✅ Sync completed!');
    console.log(`📊 Result: ${result.message || 'Unknown'}`);
    if (result.products_synced) console.log(`📦 Products synced: ${result.products_synced}`);
    if (result.inserted) console.log(`➕ New products: ${result.inserted}`);
    if (result.updated) console.log(`🔄 Updated products: ${result.updated}`);
    
    console.log('\n🎯 This should have fixed the missing supplier and price data.');
    console.log('💡 Try creating a new purchase order to verify the fix.');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.log('\n🔍 If this fails, check:');
    console.log('1. API key is set correctly');
    console.log('2. Internet connection is working');
    console.log('3. Cliniko API is accessible');
  }
}

fixProductData();
