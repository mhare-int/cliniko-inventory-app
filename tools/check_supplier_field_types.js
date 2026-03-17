const db = require('../backend/db');

async function run() {
  try {
    console.log('=== Checking Supplier Data Field Types ===\n');
    
    const allSuppliers = await db.getAllSuppliers();
    
    if (allSuppliers.length === 0) {
      console.log('No suppliers found in database');
      process.exit(0);
    }
    
    console.log(`Found ${allSuppliers.length} suppliers\n`);
    
    // Check first few suppliers
    const samplesToCheck = Math.min(5, allSuppliers.length);
    for (let i = 0; i < samplesToCheck; i++) {
      const s = allSuppliers[i];
      console.log(`Supplier #${i + 1}: ${s.name}`);
      console.log(`  email: "${s.email}" (type: ${typeof s.email}, null: ${s.email === null}, undefined: ${s.email === undefined})`);
      console.log(`  contact_name: "${s.contact_name}" (type: ${typeof s.contact_name}, null: ${s.contact_name === null})`);
      console.log(`  account_number: "${s.account_number}" (type: ${typeof s.account_number}, null: ${s.account_number === null})`);
      console.log(`  special_instructions: "${s.special_instructions}" (type: ${typeof s.special_instructions}, null: ${s.special_instructions === null})`);
      console.log('');
    }
    
    // Check if any have null values
    const withNulls = allSuppliers.filter(s => 
      s.email === null || 
      s.contact_name === null || 
      s.account_number === null || 
      s.special_instructions === null
    );
    
    console.log(`\n${withNulls.length} suppliers have NULL values in at least one field`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
