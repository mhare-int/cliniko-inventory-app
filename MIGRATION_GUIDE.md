# Migration Testing Guide

This guide helps you test and fix database migrations when upgrading from older versions (like 2.0.1) to the current version.

## Quick Test

To test migration from a simulated 2.0.1 database:

```bash
node tools/test_migration_from_201.js
```

This creates a test database that mimics what 2.0.1 might have looked like and runs all migrations.

## Analyze Any Database

To analyze an existing database and see what version it likely came from:

```bash
node tools/fix_migration.js [path-to-database]
```

If no path is provided, it will analyze `backend/appdata.db`.

## Fix Migration Issues

The main issues we identified and fixed:

### 1. SQLite DEFAULT Constraints
**Problem**: SQLite doesn't allow non-constant defaults in `ALTER TABLE ADD COLUMN`
**Fix**: Add columns without defaults, then UPDATE to set values

**Before (broken):**
```sql
ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

**After (fixed):**
```sql
ALTER TABLE settings ADD COLUMN updated_at DATETIME
UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL
```

### 2. Missing Table References
**Problem**: Migrations trying to update tables that don't exist in older versions
**Fix**: Check if tables exist before trying to update them

**Example fix:**
```javascript
// Check if table exists before creating index
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='product_sales'", (err, row) => {
  if (!row) {
    console.log('product_sales table does not exist, skipping index creation');
    return resolve();
  }
  // Create index only if table exists
  db.run("CREATE UNIQUE INDEX...", callback);
});
```

### 3. Version Detection
We now detect the likely app version by analyzing:
- Schema version table
- Table structure and columns
- Presence of specific features

## Migration Strategy

1. **Backup First**: Always create a backup before migration
2. **Detect Version**: Analyze what version you're starting from  
3. **Run Migrations**: Execute migrations in order
4. **Verify**: Check that data is preserved and new features work

## Files Changed

- `backend/migrations.js`: Fixed DEFAULT constraints and table existence checks
- `tools/test_migration_from_201.js`: Test script for 2.0.1 → current migration
- `tools/migration_utils.js`: Version detection and backup utilities
- `tools/fix_migration.js`: Main migration fix script

## Testing with Real 2.0.1 Database

If you have an actual 2.0.1 database:

1. **Make a backup copy first**
2. **Run the fix script:**
   ```bash
   node tools/fix_migration.js path/to/your/201/database.db
   ```
3. **Check the results** - the script will tell you if migration succeeded

## Common Issues and Solutions

### Issue: "Cannot add a column with non-constant default"
**Solution**: Already fixed in migrations.js - columns are added without defaults then updated

### Issue: "no such table: [table_name]"  
**Solution**: Already fixed - we check table existence before operations

### Issue: "UNIQUE constraint failed"
**Solution**: The PO ID migration checks for conflicts and handles them safely

## Production Deployment

For production upgrades:

1. **Always backup the database first**
2. **Test with a copy** of the production database first  
3. **Use the fix script** to identify potential issues
4. **Have a rollback plan** in case of issues

The migration system is now much more robust and should handle upgrades from 2.0.1 through to the current version safely.
