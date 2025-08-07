# App Update Strategy Guide

## Overview
This document outlines how to safely update the Cliniko Inventory Management app while preserving customer data.

## Update Types

### 1. **Patch Updates (Bug Fixes)**
- Version: 1.0.0 → 1.0.1
- Safe to auto-update
- No database changes
- Examples: UI fixes, minor bug fixes

### 2. **Minor Updates (New Features)**
- Version: 1.0.0 → 1.1.0
- Usually safe to auto-update
- May include database migrations
- Examples: New admin features, UI improvements

### 3. **Major Updates (Breaking Changes)**
- Version: 1.0.0 → 2.0.0
- Require manual review
- May include significant database changes
- Examples: New architecture, major workflow changes

## Database Safety Strategy

### 1. **Automatic Backups**
- App creates automatic backup before any update
- Backups stored in: `{userData}/backups/`
- Backup naming: `appdata.db.backup.{timestamp}`
- Keep last 5 backups, auto-delete older ones

### 2. **Migration System**
- All database changes use versioned migrations
- Migrations run automatically on app start
- Failed migrations prevent app startup (safety measure)
- Each migration is logged and tracked

### 3. **Rollback Plan**
- If update fails, app can restore from backup
- Users can manually restore previous version
- Migration failures are logged for debugging

## File Locations (Customer Environment)

### Windows
```
C:\Users\{username}\AppData\Roaming\cliniko-inventory-app\
├── appdata.db                 (main database)
├── backups\                   (automatic backups)
├── logs\                      (app logs)
└── uploads\                   (supplier files)
```

### macOS
```
~/Library/Application Support/cliniko-inventory-app/
├── appdata.db
├── backups/
├── logs/
└── uploads/
```

### Linux
```
~/.config/cliniko-inventory-app/
├── appdata.db
├── backups/
├── logs/
└── uploads/
```

## Update Delivery Methods

### Option 1: Auto-Updater (Recommended)
- Uses `electron-updater` package
- Checks for updates on app start
- Downloads and installs automatically
- Requires update server hosting

**How It Works:**
1. **Update Server Setup** (One-time setup for you):
   - Host releases on GitHub Releases (free and easy)
   - Or use your own server with proper file structure
   - Upload new app versions as releases

2. **Customer's App Behavior**:
   - App checks for updates every time it starts
   - Downloads update in background (customer can still use app)
   - Shows notification: "Update available - restart to install"
   - Customer clicks restart, app updates automatically
   - All their data is preserved during the process

3. **Behind the Scenes**:
   - App compares current version with latest release
   - Downloads only the differences (delta updates)
   - Backs up database before applying update
   - Runs migrations if needed
   - Restarts with new version

**Setup Required:**
- Add `electron-updater` to your main.js process
- Configure update server URL in package-electron.json
- Build and upload releases to your chosen server

**Example Implementation:**
```javascript
// In your main.js (Electron main process)
const { autoUpdater } = require('electron-updater');

// Configure update server (GitHub releases)
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username',
  repo: 'cliniko-inventory-app'
});

// Check for updates when app starts
app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});

// Handle update events
autoUpdater.on('update-available', () => {
  console.log('Update available');
  // Show notification to user
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded');
  // Show "restart to install" dialog
  autoUpdater.quitAndInstall();
});
```

**Your Workflow:**
1. Make changes to your app
2. Increment version in package.json (e.g., 1.0.0 → 1.0.1)
3. Run: `npm run build:electron`
4. Upload the generated installer to GitHub Releases
5. Customer's apps automatically detect and install the update

### Option 2: Manual Distribution
- Send new installer to customer
- Customer runs installer manually
- App handles database migration automatically
- Good for controlled environments

### Option 3: Portable Updates
- Send just the updated app files
- Customer replaces old files
- Database stays in place
- Simplest but requires technical knowledge

## Pre-Update Checklist

Before releasing any update:

1. **Test Migration Path**
   - Test migration on copy of customer database
   - Verify all data preserved correctly
   - Test rollback if needed

2. **Version Compatibility**
   - Ensure new version can read old database
   - Test with various database states
   - Verify API compatibility

3. **Backup Strategy**
   - Confirm backup creation works
   - Test backup restoration
   - Verify backup cleanup

4. **Communication Plan**
   - Notify customer of update
   - Provide changelog
   - Schedule update during downtime

## Customer Instructions Template

### For Automatic Updates:
```
Subject: Cliniko Inventory App Update Available

Dear [Customer],

A new version of your Cliniko Inventory Management app is available.

Version: 1.1.0
Changes:
- Improved user interface
- New reporting features
- Bug fixes

The app will automatically:
1. Create a backup of your data
2. Download and install the update
3. Migrate your data if needed

Action Required: None - the update will install automatically.

If you experience any issues, contact support.
```

### For Manual Updates:
```
Subject: Cliniko Inventory App Update - Manual Installation Required

Dear [Customer],

Please install the attached update at your earliest convenience.

Installation Steps:
1. Close the current app
2. Run the new installer
3. Your data will be automatically preserved
4. App will update your database if needed

A backup will be created automatically before any changes.

If you need assistance, please contact support.
```

## Troubleshooting Updates

### Migration Failure
1. App won't start after update
2. Check logs in app data directory
3. Restore from backup if needed
4. Contact developer with error logs

### Data Loss Prevention
1. Automatic backups before migrations
2. Migration validation checks
3. Rollback capability
4. Manual backup instructions for customers

### Version Rollback
1. Uninstall current version
2. Reinstall previous version
3. Restore database backup if needed
4. Report issue to developer

## Developer Workflow

### Adding New Features
1. Create migration script if database changes needed
2. Increment version number appropriately
3. Test migration path thoroughly
4. Update changelog
5. Build and test installer
6. Deploy to update server or send to customer

### Emergency Updates
1. Critical bug fixes get priority
2. Fast-track testing process
3. Immediate notification to customers
4. Remote assistance if needed

## Best Practices

1. **Always backup before changes**
2. **Test migrations thoroughly**
3. **Communicate changes clearly**
4. **Provide rollback instructions**
5. **Monitor update success**
6. **Keep update process simple**
7. **Document all changes**
8. **Provide support during updates**
