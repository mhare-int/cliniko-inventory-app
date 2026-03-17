/**
 * Fix migration issues for upgrading from any version
 * Usage: node tools/fix_migration.js [path-to-database]
 */

const fs = require('fs');
const path = require('path');
const { testMigrationFromVersion, detectAppVersion } = require('./migration_utils.js');

async function main() {
  const dbPath = process.argv[2] || path.join(__dirname, '../backend/appdata.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database file not found: ${dbPath}`);
    console.log('Usage: node tools/fix_migration.js [path-to-database]');
    process.exit(1);
  }
  
  console.log(`🔧 Fixing migration for database: ${dbPath}`);
  console.log('==================================================');
  
  try {
    // First, analyze the current state
    console.log('🔍 Step 1: Analyzing current database state...');
    const analysis = await detectAppVersion(dbPath);
    
    console.log('📊 Database Analysis Results:');
    console.log(`   Detection method: ${analysis.detected}`);
    console.log(`   Estimated schema version: ${analysis.estimated_schema_version || 'unknown'}`);
    console.log(`   Likely app version: ${analysis.likely_app_version}`);
    console.log(`   Tables found: ${analysis.table_count}`);
    
    if (analysis.indicators) {
      console.log('📋 Schema indicators:');
      Object.entries(analysis.indicators).forEach(([key, value]) => {
        console.log(`   ${key}: ${value ? '✅' : '❌'}`);
      });
    }
    
    console.log('\\n🚀 Step 2: Testing migration...');
    const result = await testMigrationFromVersion(dbPath);
    
    if (result.success) {
      console.log('\\n✅ SUCCESS!');
      console.log(`   Initial version: ${result.initialVersion}`);
      console.log(`   Final version: ${result.finalVersion}`);
      console.log(`   Backup created: ${result.backup}`);
      console.log('\\n🎉 Your database is now ready for the latest version!');
    } else {
      console.log('\\n❌ MIGRATION FAILED');
      console.log(`   Error: ${result.error}`);
      console.log('\\n📋 Troubleshooting suggestions:');
      console.log('   1. Check that your database is not corrupted');
      console.log('   2. Ensure you have proper file permissions');
      console.log('   3. Try running with administrator privileges');
      console.log('   4. Contact support with the error message above');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
