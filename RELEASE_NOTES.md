Release 3.1.0

## Key Features & Fixes

### 🔧 Critical Compatibility Fixes
- **Fixed "Product not found" errors for 2.0.1 → 3.1.0 auto-updates**
- **Resolved JavaScript precision issues with long Cliniko IDs (19-digit numbers)**
- **Complete database migration system (Migration 23) for legacy compatibility**

### 🎯 Migration 23 Enhancements
- Proper `cliniko_id` column type conversion (INTEGER → TEXT) 
- Legacy `stock` → `current_stock` data migration
- Missing columns addition for full 3.x compatibility
- Preserves all existing product data during upgrade

### 💰 User Experience Improvements
- **Modern SupplierDiscounts UI** with card-based design and bulk discount wizards
- **90% performance improvement** in user behavior analytics (reduced from 25+ to 6 essential tracking fields)
- **Enhanced reorder level management** - no more update failures for products with long IDs

### 🗂️ Database Schema Robustness
- Automatic table creation for advanced features (vendor files, email templates)
- Comprehensive schema validation and repair system
- Future-proof migration architecture

Files produced by the build:

- dist/Good Life Clinic - Inventory Management Setup 3.1.0.exe
- dist/Good Life Clinic - Inventory Management Setup 3.1.0.exe.blockmap
- dist/latest.yml

Notes:
- The installer binary is large; it is not checked into git. Upload the `.exe` and `.blockmap` to the GitHub Release for tag `v3.1.0` (recommended).
- The `latest.yml` file in `dist/` can be used by the auto-updater if you publish these artifacts to GitHub Releases under the `release` channel.
- **Critical**: This release fixes compatibility issues for 2.0.1 users. Auto-updater will now properly migrate legacy databases.

Build run summary:
- Built on: 2025-09-01
- package.json version: 3.1.0
- electron-builder config: package-electron.json
