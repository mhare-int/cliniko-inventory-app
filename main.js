// --- Electron/Node.js requires at the very top ---
const path = require('path');
const fs = require('fs');
const validation = require('./backend/validation');

// Try to load Electron APIs; if not running under Electron, provide safe stubs
let app, BrowserWindow, ipcMain, dialog, Menu;
let isElectron = false;
try {
  const _electron = require('electron');
  // Ensure the required module actually exposes the properties we need
  if (_electron && _electron.app && _electron.ipcMain) {
    ({ app, BrowserWindow, ipcMain, dialog, Menu } = _electron);
    isElectron = true;
  } else {
    throw new Error('Electron module present but missing expected properties');
  }
} catch (e) {
  // not running under Electron - provide minimal stubs so requiring main.js in plain Node doesn't crash
  app = {
    isPackaged: false,
    on: () => {},
    getPath: () => process.cwd(),
    getVersion: () => '0.0.0'
  };
  BrowserWindow = class {
    constructor() { }
    static fromId() { return null; }
  };
  ipcMain = { handle: (...args) => { /* no-op for plain Node requires */ } };
  dialog = { showMessageBox: async () => {}, showErrorBox: () => {} };
  Menu = { buildFromTemplate: () => ({}), setApplicationMenu: () => {} };
}

// electron-updater is required lazily inside initializeAutoUpdater (see below)
let autoUpdater = null;

// Set up database path for production when running under Electron packaged app
if (isElectron && app && app.isPackaged) {
  const userDataPath = app.getPath('userData');
  const userDbPath = path.join(userDataPath, 'appdata.db');

  // Copy initial database if it doesn't exist
  if (!fs.existsSync(userDbPath)) {
    // Copy from bundled version
    const bundledDbPath = path.join(process.resourcesPath, 'backend', 'appdata.db');
    if (fs.existsSync(bundledDbPath)) {
      // Ensure new directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.copyFileSync(bundledDbPath, userDbPath);
      console.log('Copied initial database to user data directory');
    } else {
      console.error('Bundled database not found at:', bundledDbPath);
    }
  }

  // Set the environment variable for the backend
  process.env.DB_PATH = userDbPath;
} else {
  // Default DB path for non-packaged / plain Node runs
  if (!process.env.DB_PATH) process.env.DB_PATH = path.join(__dirname, 'backend', 'appdata.db');
}

  // Support a CLI-only migrate mode so installers (or CI) can run migrations immediately after files are installed.
  // Usage (Windows installer / PowerShell):
  //   "C:\Program Files\...\Good Life Clinic - Inventory Management.exe" --migrate-only
  if (process.argv && process.argv.includes('--migrate-only')) {
    (async () => {
      try {
        console.log('[Installer] Starting migrate-only mode');
        const sqlite3 = require('sqlite3').verbose();
        const { runMigrations, backupDatabase } = require('./backend/migrations');
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'backend', 'appdata.db');

        try {
          await backupDatabase(dbPath);
        } catch (bkErr) {
          console.warn('[Installer] Database backup failed (continuing):', bkErr && bkErr.message ? bkErr.message : bkErr);
        }

        const dbForMigrate = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
          if (err) {
            console.error('[Installer] Failed to open DB for migrations:', err);
            process.exit(1);
            return;
          }

          try {
            console.log('[Installer] Running migrations against', dbPath);
            await runMigrations(dbForMigrate);
            dbForMigrate.close(() => {
              console.log('[Installer] Migrations completed successfully (migrate-only). Exiting.');
              process.exit(0);
            });
          } catch (migErr) {
            console.error('[Installer] Migration failed:', migErr && migErr.message ? migErr.message : migErr);
            try { dbForMigrate.close(() => process.exit(1)); } catch (e) { process.exit(1); }
          }
        });
      } catch (e) {
        console.error('[Installer] migrate-only unexpected error:', e && e.message ? e.message : e);
        process.exit(1);
      }
    })();
  }

// Import backend logic (after setting DB_PATH)
const db = require('./backend/db');

// Global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logErrorToFile('Unhandled Promise Rejection: ' + (reason && reason.stack ? reason.stack : JSON.stringify(reason)));
  console.error('Unhandled Promise Rejection:', reason);
});

// Helper to log errors to a file in the user data directory (safe when not running under Electron)
function logErrorToFile(message) {
  try {
    if (isElectron && app && typeof app.getPath === 'function') {
      const logPath = path.join(app.getPath('userData'), 'backend-error.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
    } else {
      const logPath = path.join(process.cwd(), 'backend-error.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
    }
  } catch (e) {
    console.error('Failed to write to backend-error.log:', e);
  }
}

let mainWindow;

async function createWindow() {
  console.log('[Electron] Creating main window...');
  
  try {
    mainWindow = new BrowserWindow({
      width: 1600,
      height: 1200,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    const htmlPath = path.join(__dirname, 'client', 'build', 'index.html');
    console.log('[Electron] Loading HTML from:', htmlPath);
    
  // In development, try to connect to React dev server first
  if (!app || !app.isPackaged) {
      try {
        console.log('[Electron] Development mode - attempting to connect to React dev server at http://localhost:3000');
        await mainWindow.loadURL('http://localhost:3000');
        console.log('[Electron] Successfully connected to React dev server');
      } catch (error) {
        console.log('[Electron] React dev server not available, falling back to build folder:', error.message);
        mainWindow.loadFile(htmlPath);
      }
    } else {
      // Load the React build directly from the build folder
      mainWindow.loadFile(htmlPath);
    }
    
  // Open Developer Tools for debugging (only in development)
  if (!app || !app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
    
    mainWindow.once('ready-to-show', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.show();
      mainWindow.focus();
      if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.focus();
      }
    });

    mainWindow.on('focus', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.focus();
      }
    });

    mainWindow.on('closed', function () {
      mainWindow = null;
    });
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`[Electron] Window failed to load: ${errorDescription} (${errorCode})`);
      logErrorToFile(`Window failed to load: ${errorDescription} (${errorCode})`);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Electron] Main window finished loading.');
    });

    // Set up application menu
    const template = [
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Check for Updates',
            click: async () => {
              try {
                const result = await require('electron-updater').autoUpdater.checkForUpdates();
                if (result && result.updateInfo) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Update Check',
                    message: `Current version: ${app.getVersion()}\nLatest version: ${result.updateInfo.version}`,
                    detail: result.updateInfo.version === app.getVersion() 
                      ? 'You are using the latest version!' 
                      : 'A new version is available!'
                  });
                }
              } catch (error) {
                dialog.showErrorBox('Update Check Failed', error.message);
              }
            }
          },
          {
            label: 'About',
            click: () => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About',
                message: 'Good Life Clinic - Inventory Management',
                detail: `Version: ${app.getVersion()}\nElectron-based inventory management system.`
              });
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

  } catch (error) {
    console.error('[Electron] Error creating window:', error);
    logErrorToFile('Error creating window: ' + error.message);
  }
}

// --- Get active PURs for a barcode ---
ipcMain.handle('getActivePURsForBarcode', async (event, barcode) => {
  const barcodeValidation = validation.validateBarcode(barcode);
  if (!barcodeValidation.valid) {
    return { error: barcodeValidation.error };
  }
  try {
    return await db.getActivePURsForBarcode(barcodeValidation.value);
  } catch (err) {
    logErrorToFile('getActivePURsForBarcode error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to get active PURs for barcode', details: err.details || err.message || err };
  }
});

// --- Supplier Order File Creation ---
ipcMain.handle('createSupplierOrderFilesForVendors', async (event, items, outputFolder, clientOpts) => {
  try {
    // Gather company/profile and template settings to pass into the generator
    let opts = {};
    try {
      opts = await db.gatherPoTemplateOptions();
    } catch (e) {
      console.warn('Could not gather PO template options:', e && e.message ? e.message : e);
    }
  // Merge client-provided options (e.g. { format: 'pdf' }) with persisted options
  const mergedOpts = Object.assign({}, opts, clientOpts || {});
  return await db.createSupplierOrderFilesForVendors(items, outputFolder, mergedOpts);
  } catch (err) {
    logErrorToFile('createSupplierOrderFilesForVendors error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to create supplier order files', details: err.details || err.message || err };
  }
});

// --- Render PO preview (returns rendered HTML string) ---
// Log registration so we can confirm handler exists in running main process
try { console.log('[IPC] Registering handler: renderPoPreview'); } catch(e) {}
ipcMain.handle('renderPoPreview', async (event, items = [], opts = {}) => {
  try {
    // Gather persisted company/template options if available and merge with provided opts
    let gathered = {};
    try {
      gathered = await db.gatherPoTemplateOptions();
    } catch (e) {
      console.warn('Could not gather PO template options for preview:', e && e.message ? e.message : e);
    }

    const mergedOpts = Object.assign({}, gathered, opts, { previewOnly: true });

    const result = await db.createSupplierOrderFilesForVendors(items, null, mergedOpts);

    // The generator returns the rendered HTML when previewOnly is true (string) or an object containing html
    if (!result) return { success: false, error: 'No preview generated' };
    if (typeof result === 'string') return { success: true, html: result };
    if (result.html) return { success: true, html: result.html };
    return { success: true, html: String(result) };
  } catch (err) {
    logErrorToFile('renderPoPreview error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { success: false, error: err && err.message ? err.message : JSON.stringify(err) };
  }
});

// --- Folder picker for output directory ---
ipcMain.handle('pickFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return '';
  return result.filePaths[0];
});

// --- Update stock from Cliniko API on app open ---
ipcMain.handle('updateStockFromCliniko', async () => {
  try {
    return await db.updateStockFromCliniko();
  } catch (err) {
    logErrorToFile('updateStockFromCliniko error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update stock from Cliniko' };
  }
});

// --- Sync products from Cliniko API (Create/Insert) ---
ipcMain.handle('syncProductsFromCliniko', async () => {
  try {
    return await db.syncProductsFromCliniko();
  } catch (err) {
    logErrorToFile('syncProductsFromCliniko error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to sync products from Cliniko' };
  }
});

// --- Update sales data from Cliniko API ---
ipcMain.handle('updateSalesDataFromCliniko', async (event, startDate = null, endDate = null) => {
  const startValidation = validation.validateDate(startDate, false);
  if (!startValidation.valid) {
    return { error: `Invalid start date: ${startValidation.error}` };
  }
  const endValidation = validation.validateDate(endDate, false);
  if (!endValidation.valid) {
    return { error: `Invalid end date: ${endValidation.error}` };
  }
  try {
    return await db.updateSalesDataFromCliniko(startValidation.value, endValidation.value);
  } catch (err) {
    logErrorToFile('updateSalesDataFromCliniko error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update sales data from Cliniko' };
  }
});

// --- Preview Sales Data Count from Cliniko ---
ipcMain.handle('previewSalesDataCount', async (event, startDate = null, endDate = null, apiKey = null) => {
  try {
    return await db.previewSalesDataCount(startDate, endDate, apiKey);
  } catch (err) {
    logErrorToFile('previewSalesDataCount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to preview sales data count from Cliniko' };
  }
});

// --- Logout ---
ipcMain.handle('logout', async (event) => {
  // Invalidate token on frontend by removing it from localStorage; nothing to do on backend for stateless JWT
  return { success: true };
});

// --- Auto-Updater Configuration Function ---
async function initializeAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[Auto-Updater] Development mode - auto-updater disabled');
    return;
  }

  console.log('[Auto-Updater] Initializing auto-updater in production mode...');

  try {
    // Require electron-updater lazily so that requiring main.js in plain Node doesn't crash
    const { autoUpdater: _autoUpdater } = require('electron-updater');
    autoUpdater = _autoUpdater;

    const updateConfig = {
      provider: 'github',
      owner: 'mhare-int',
      repo: 'cliniko-inventory-app',
      private: false
    };

    // Add GitHub token if available (required for private repos)
    let githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

    // If no environment token, try to get from database/settings
    if (!githubToken) {
      try {
        console.log('[Auto-Updater] Attempting to get GitHub token from database...');
        const tokenResult = await db.getGitHubToken();
        if (tokenResult && tokenResult.token) {
          githubToken = tokenResult.token;
          console.log('[Auto-Updater] ✅ Successfully retrieved GitHub token from app settings');
        } else {
          console.log('[Auto-Updater] ⚠️ No token found in database result:', tokenResult);
        }
      } catch (err) {
        console.warn('[Auto-Updater] ❌ Could not retrieve GitHub token from settings:', err.message);
        logErrorToFile('Auto-updater token retrieval error: ' + err.message);
      }
    }

    if (githubToken) {
      updateConfig.token = githubToken;
      console.log('[Auto-Updater] ✅ Using GitHub token for private repository access (length:', githubToken.length, ')');
    } else {
      console.warn('[Auto-Updater] ❌ No GitHub token found. Private repository updates will fail.');
      console.warn('[Auto-Updater] Set GH_TOKEN environment variable or configure in app settings.');
    }

    autoUpdater.setFeedURL(updateConfig);
    console.log('[Auto-Updater] Feed URL configured successfully');

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('[Auto-Updater] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Auto-Updater] Update available:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info.version);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[Auto-Updater] Update not available');
    });

    autoUpdater.on('error', (err) => {
      console.error('[Auto-Updater] Error:', err);
      logErrorToFile('Auto-updater error: ' + err.message);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const { bytesPerSecond, percent, transferred, total } = progressObj;
      console.log(`[Auto-Updater] Download speed: ${bytesPerSecond} - Downloaded ${percent}% (${transferred}/${total})`);
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Auto-Updater] Update downloaded:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info.version);
      }
    });

  } catch (err) {
    console.error('[Auto-Updater] Initialization error:', err);
    logErrorToFile('Auto-updater initialization error: ' + err.message);
  }
}

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      console.error('[Auto-Updater] Manual check failed:', error);
      return { success: false, error: error.message };
    }
  } else {
    return { success: false, error: 'Updates disabled in development mode' };
  }
});

// IPC handler for installing update
ipcMain.handle('install-update', async () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
    return { success: true };
  } else {
    return { success: false, error: 'Updates disabled in development mode' };
  }
});

app.on('ready', async () => {
  console.log('[Electron] App ready. Starting backend...');
  // In production, ensure any outstanding DB migrations are applied before creating the UI
  if (app && app.isPackaged) {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const { runMigrations, backupDatabase, getCurrentVersion, CURRENT_DB_VERSION } = require('./backend/migrations');
      const dbPath = process.env.DB_PATH || path.join(__dirname, 'backend', 'appdata.db');

      console.log('[Startup] Checking database migration state for', dbPath);
      try {
        // Quick check of disk version
        const tmpDb = new sqlite3.Database(dbPath);
        const diskVersion = await getCurrentVersion(tmpDb);
        try { tmpDb.close(); } catch (e) {}

        if (typeof diskVersion === 'number' && diskVersion < CURRENT_DB_VERSION) {
          console.log(`[Startup] Database version ${diskVersion} < expected ${CURRENT_DB_VERSION} — running migrations now`);
          try { await backupDatabase(dbPath); } catch (bkErr) { console.warn('[Startup] Database backup failed (continuing):', bkErr && bkErr.message ? bkErr.message : bkErr); }

          // Open DB for migrations and run
          await new Promise((resolve) => {
            const migrateDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
              if (err) {
                console.error('[Startup] Failed to open DB for migrations:', err);
                return resolve();
              }
              try {
                await runMigrations(migrateDb);
              } catch (migErr) {
                console.error('[Startup] Migration error:', migErr && migErr.message ? migErr.message : migErr);
              } finally {
                try { migrateDb.close(() => resolve()); } catch (e) { resolve(); }
              }
            });
          });
        } else {
          console.log('[Startup] No migrations needed');
        }
      } catch (checkErr) {
        console.warn('[Startup] Could not determine DB version or run migrations gracefully:', checkErr && checkErr.message ? checkErr.message : checkErr);
        // Fallback: attempt backup and run migrations (best-effort)
        try { await backupDatabase(dbPath); } catch (e) { /* ignore backup failures */ }
        try {
          const migrateDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
            if (err) return console.error('[Startup] Fallback: failed to open DB for migrations:', err);
            try { await runMigrations(migrateDb); } catch (e2) { console.error('[Startup] Fallback migration failed:', e2); } finally { try { migrateDb.close(); } catch (e) {} }
          });
        } catch (e) {
          console.error('[Startup] Unexpected error during fallback migration attempt:', e);
        }
      }
    } catch (e) {
      console.error('[Startup] Unexpected error running startup migrations:', e && e.message ? e.message : e);
    }
  }

  createWindow();
  
  // Initialize auto-updater after app is ready and database is available
  await initializeAutoUpdater();

  // Check for updates after initialization (in production only)
  if (app && app.isPackaged) {
    setTimeout(() => {
      console.log('[Auto-Updater] Performing initial update check...');
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000); // Wait 5 seconds after startup to ensure everything is initialized
  }
});

// --- IPC handlers for backend logic ---
ipcMain.handle('deleteUser', async (event, userId) => {
  const userIdValidation = validation.validateUserId(userId);
  if (!userIdValidation.valid) {
    return { error: userIdValidation.error };
  }
  return await db.deleteUser(userIdValidation.value);
});

ipcMain.handle('changeUserPassword', async (event, userId, newPassword) => {
  const userIdValidation = validation.validateUserId(userId);
  if (!userIdValidation.valid) {
    return { error: userIdValidation.error };
  }
  const passwordValidation = validation.validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.error };
  }
  return await db.changeUserPassword(userIdValidation.value, passwordValidation.value);
});

ipcMain.handle('updatePurchaseRequestReceived', async (event, prId, lines, receivedBy = null, comment = '') => {
  const prIdValidation = validation.validatePrId(prId);
  if (!prIdValidation.valid) {
    return { error: prIdValidation.error };
  }
  const linesValidation = validation.validateReceivedLines(lines);
  if (!linesValidation.valid) {
    return { error: linesValidation.error };
  }
  const commentValidation = validation.validateComment(comment);
  if (!commentValidation.valid) {
    return { error: commentValidation.error };
  }
  try {
    return await db.updatePurchaseRequestReceived(prIdValidation.value, linesValidation.value, receivedBy, commentValidation.value);
  } catch (err) {
    logErrorToFile('updatePurchaseRequestReceived error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update purchase request received', details: err && err.message ? err.message : undefined };
  }
});

// Update purchase request with required comment and create audit log
ipcMain.handle('updatePurchaseRequestWithComment', async (event, prId, updates, changedBy, comment) => {
  const prIdValidation = validation.validatePrId(prId);
  if (!prIdValidation.valid) {
    return { error: prIdValidation.error };
  }
  const updatesValidation = validation.validatePrUpdates(updates);
  if (!updatesValidation.valid) {
    return { error: updatesValidation.error };
  }
  const usernameValidation = validation.validateUsername(changedBy);
  if (!usernameValidation.valid) {
    return { error: usernameValidation.error };
  }
  const commentValidation = validation.validateComment(comment);
  if (!commentValidation.valid) {
    return { error: commentValidation.error };
  }
  try {
    return await db.updatePurchaseRequestWithComment(prIdValidation.value, updatesValidation.value, usernameValidation.value, commentValidation.value);
  } catch (err) {
    logErrorToFile('updatePurchaseRequestWithComment error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update purchase request with comment', details: err && err.details ? err.details : err };
  }
});

ipcMain.handle('updatePurchaseRequestItemsWithComment', async (event, prId, lines, changedBy, comment) => {
  try {
    return await db.updatePurchaseRequestItemsWithComment(prId, lines, changedBy, comment);
  } catch (err) {
    logErrorToFile('updatePurchaseRequestItemsWithComment error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update PR items with comment', details: err && err.details ? err.details : err };
  }
});

ipcMain.handle('getPoChangeLog', async (event, prId, limit = 50) => {
  try {
    return await db.getPoChangeLog(prId, limit);
  } catch (err) {
    logErrorToFile('getPoChangeLog error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get PO change log' };
  }
});

ipcMain.handle('updatePurchaseRequestItemsEditWithComment', async (event, prId, edits, changedBy, comment) => {
  const prIdValidation = validation.validatePrId(prId);
  if (!prIdValidation.valid) {
    return { error: prIdValidation.error };
  }
  const editsValidation = validation.validateItemEdits(edits);
  if (!editsValidation.valid) {
    return { error: editsValidation.error };
  }
  const usernameValidation = validation.validateUsername(changedBy);
  if (!usernameValidation.valid) {
    return { error: usernameValidation.error };
  }
  const commentValidation = validation.validateComment(comment);
  if (!commentValidation.valid) {
    return { error: commentValidation.error };
  }
  try {
  // Log incoming IPC call for diagnostics
  try { require('fs').appendFileSync(require('path').join(__dirname, 'backend.log'), `[${new Date().toISOString()}] IPC updatePurchaseRequestItemsEditWithComment invoked - prId=${prIdValidation.value} edits=${Array.isArray(editsValidation.value)?editsValidation.value.length:0} changedBy=${usernameValidation.value}\n`); } catch (e) {}
  const res = await db.updatePurchaseRequestItemsEditWithComment(prIdValidation.value, editsValidation.value, usernameValidation.value, commentValidation.value);
  try { require('fs').appendFileSync(require('path').join(__dirname, 'backend.log'), `[${new Date().toISOString()}] IPC updatePurchaseRequestItemsEditWithComment result - ${JSON.stringify(res).slice(0,200)}\n`); } catch (e) {}
  return res;
  } catch (err) {
    logErrorToFile('updatePurchaseRequestItemsEditWithComment error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to apply item edits' };
  }
});

ipcMain.handle('receiveItemById', async (event, itemId, quantityReceived) => {
  const itemIdValidation = validation.validateItemId(itemId);
  if (!itemIdValidation.valid) {
    return { error: itemIdValidation.error };
  }
  const quantityValidation = validation.validateQuantity(quantityReceived);
  if (!quantityValidation.valid) {
    return { error: quantityValidation.error };
  }
  try {
    return await db.receiveItemById(itemIdValidation.value, quantityValidation.value);
  } catch (err) {
    logErrorToFile('receiveItemById error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to receive item', details: err.details || err.message || err };
  }
});

// --- Session Timeout Management ---
ipcMain.handle('getSessionTimeout', async () => {
  return await db.getSessionTimeout();
});

ipcMain.handle('setSessionTimeout', async (event, hours) => {
  const hoursValidation = validation.validateSessionTimeout(hours);
  if (!hoursValidation.valid) {
    return { error: hoursValidation.error };
  }
  return await db.setSessionTimeout(hoursValidation.value);
});

ipcMain.handle('getAllProducts', async () => {
  return await db.getAllProducts();
});

ipcMain.handle('getAllProductsWithWrapper', async () => {
  try {
    return await db.getAllProductsWithWrapper();
  } catch (err) {
    logErrorToFile('getAllProductsWithWrapper error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to get products with wrapper' };
  }
});

ipcMain.handle('getProductCount', async () => {
  try {
    return await db.getProductCount();
  } catch (err) {
    logErrorToFile('getProductCount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return 0;
  }
});

ipcMain.handle('getAllUsers', async () => {
  return await db.getAllUsers();
});

ipcMain.handle('addUser', async (event, username, password_hash, is_admin) => {
  return await db.addUser(username, password_hash, is_admin);
});

ipcMain.handle('getProductSales', async (event, start_date, end_date) => {
  return await db.getProductSales(start_date, end_date);
});

ipcMain.handle('getSalesInsights', async (event, limit, offset) => {
  return await db.getSalesInsights(limit, offset);
});

ipcMain.handle('getSalesInsightsWithCustomRanges', async (event, customRanges, limit, offset) => {
  return await db.getSalesInsightsWithCustomRanges(customRanges, limit, offset);
});

ipcMain.handle('getProductOptions', async (event, term) => {
  return await db.getProductOptions(term);
});

// --- Product Audit (timeline) ---
ipcMain.handle('getProductAudit', async (event, productId, opts = {}) => {
  try {
    return await db.getProductAudit(productId, opts);
  } catch (err) {
    logErrorToFile('getProductAudit error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to get product audit', details: err && err.details ? err.details : err && err.message };
  }
});

ipcMain.handle('downloadFile', async (event, filename) => {
  try {
    const filePath = await db.downloadFile(filename);
    return { success: true, path: filePath };
  } catch (err) {
    logErrorToFile('downloadFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { success: false, error: err && err.error ? err.error : (err && err.message ? err.message : JSON.stringify(err)), details: err && err.details ? err.details : undefined };
  }
});

// --- Authentication and User Info ---
ipcMain.handle('login', async (event, username, password) => {
  return await db.login(username, password);
});

ipcMain.handle('getCurrentUser', async (event, token) => {
  return await db.getCurrentUser(token);
});

// --- First Time Setup ---
ipcMain.handle('isFirstTimeSetup', async () => {
  return await db.isFirstTimeSetup();
});

ipcMain.handle('createFirstAdminUser', async (event, username, password) => {
  return await db.createFirstAdminUser(username, password);
});

ipcMain.handle('resetFirstTimeSetup', async () => {
  try {
    // This will force migrations to run again
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'backend', 'appdata.db');
    const { runMigrations } = require('./backend/migrations');
    const sqlite3 = require('sqlite3').verbose();
    
    return new Promise((resolve, reject) => {
      const testDb = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error('Failed to connect for migration:', err);
          return reject({ error: 'Failed to connect to database for migration' });
        }
        
        try {
          await runMigrations(testDb);
          testDb.close();
          resolve({ success: true, message: 'Database migrations completed successfully' });
        } catch (migrationErr) {
          console.error('Migration error:', migrationErr);
          testDb.close();
          reject({ error: 'Migration failed', details: migrationErr.message });
        }
      });
    });
  } catch (err) {
    logErrorToFile('resetFirstTimeSetup error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to reset first time setup', details: err.message };
  }
});

ipcMain.handle('createPurchaseRequest', async (event, data) => {
  return await db.createPurchaseRequest(data);
});

ipcMain.handle('getPurchaseRequests', async (event, active_only, group_by) => {
  return await db.getPurchaseRequests(active_only, group_by);
});

ipcMain.handle('getPurchaseRequestById', async (event, pr_id) => {
  return await db.getPurchaseRequestById(pr_id);
});

ipcMain.handle('setPurchaseRequestReceived', async (event, pr_id, updates) => {
  return await db.setPurchaseRequestReceived(pr_id, updates);
});

ipcMain.handle('deletePurchaseRequest', async (event, pr_id) => {
  return await db.deletePurchaseRequest(pr_id);
});

ipcMain.handle('updateReorderLevels', async (event, updates) => {
  return await db.updateReorderLevels(updates);
});

ipcMain.handle('updateReorderLevelsFromFile', async (event, fileData) => {
  try {
    return await db.updateReorderLevelsFromFile(fileData);
  } catch (err) {
    logErrorToFile('updateReorderLevelsFromFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update reorder levels from file', details: err.details || err.message || err };
  }
});

ipcMain.handle('generateReorderLevelsTemplate', async () => {
  try {
    return await db.generateReorderLevelsTemplate();
  } catch (err) {
    logErrorToFile('generateReorderLevelsTemplate error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to generate template', details: err.details || err.message || err };
  }
});

ipcMain.handle('updateProductReorderLevel', async (event, product_id, new_level) => {
  return await db.updateProductReorderLevel(product_id, new_level);
});

ipcMain.handle('updateProductBarcode', async (event, product_id, new_barcode) => {
  return await db.updateProductBarcode(product_id, new_barcode);
});

// --- API Key Management ---
ipcMain.handle('getApiKey', async () => {
  try {
    return await db.getApiKey();
  } catch (err) {
    logErrorToFile('getApiKey error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { api_key: false, error: 'Failed to get API key' };
  }
});

ipcMain.handle('setApiKey', async (event, newKey) => {
  try {
    return await db.setApiKey(newKey);
  } catch (err) {
    logErrorToFile('setApiKey error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to set API key' };
  }
});

ipcMain.handle('testApiKey', async (event, apiKey) => {
  try {
    return await db.testClinikoApiKey(apiKey);
  } catch (err) {
    logErrorToFile('testApiKey error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { valid: false, error: 'Failed to test API key' };
  }
});

// --- GitHub Token Management ---
ipcMain.handle('getGitHubToken', async () => {
  try {
    return await db.getGitHubToken();
  } catch (err) {
    logErrorToFile('getGitHubToken error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { token: null, error: 'Failed to get GitHub token' };
  }
});

ipcMain.handle('setGitHubToken', async (event, newToken) => {
  try {
    return await db.setGitHubToken(newToken);
  } catch (err) {
    logErrorToFile('setGitHubToken error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to set GitHub token' };
  }
});

// --- User Behavior Logging ---
ipcMain.handle('startUserSession', async (event, userId, sessionId) => {
  try {
    return await db.startUserSession(userId, sessionId);
  } catch (err) {
    logErrorToFile('startUserSession error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    // Return success to avoid blocking the app if user behavior tracking fails
    return { success: true, warning: 'User behavior tracking unavailable' };
  }
});

ipcMain.handle('endUserSession', async (event, sessionId) => {
  try {
    return await db.endUserSession(sessionId);
  } catch (err) {
    logErrorToFile('endUserSession error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    // Return success to avoid blocking the app if user behavior tracking fails
    return { success: true, warning: 'User behavior tracking unavailable' };
  }
});

ipcMain.handle('logUserBehavior', async (event, userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata) => {
  try {
    return await db.logUserBehavior(userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata);
  } catch (err) {
    logErrorToFile('logUserBehavior error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    // Return success to avoid blocking the app if user behavior tracking fails
    return { success: true, warning: 'User behavior tracking unavailable' };
  }
});

ipcMain.handle('setUserPreference', async (event, userId, key, value) => {
  try {
    return await db.setUserPreference(userId, key, value);
  } catch (err) {
    logErrorToFile('setUserPreference error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set user preference' };
  }
});

ipcMain.handle('getUserPreferences', async (event, userId) => {
  try {
    return await db.getUserPreferences(userId);
  } catch (err) {
    logErrorToFile('getUserPreferences error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get user preferences' };
  }
});

ipcMain.handle('getUserBehaviorAnalytics', async (event, userId, daysPast) => {
  try {
    return await db.getUserBehaviorAnalytics(userId, daysPast);
  } catch (err) {
    logErrorToFile('getUserBehaviorAnalytics error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    // Return empty data to avoid blocking the app if user behavior tracking fails
    return { analytics: [], warning: 'User behavior analytics unavailable' };
  }
});

ipcMain.handle('getAllUsersBehaviorInsights', async (event, daysPast) => {
  try {
    return await db.getAllUsersBehaviorInsights(daysPast);
  } catch (err) {
    logErrorToFile('getAllUsersBehaviorInsights error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    // Return empty data to avoid blocking the app if user behavior tracking fails
    return { insights: [], warning: 'User behavior insights unavailable' };
  }
});

// Cliniko Stock Update Setting API endpoints
ipcMain.handle('getClinikoStockUpdateSetting', async () => {
  try {
    return await db.getClinikoStockUpdateSetting();
  } catch (err) {
    logErrorToFile('getClinikoStockUpdateSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get Cliniko stock update setting' };
  }
});

ipcMain.handle('setClinikoStockUpdateSetting', async (event, enabled) => {
  try {
    return await db.setClinikoStockUpdateSetting(enabled);
  } catch (err) {
    logErrorToFile('setClinikoStockUpdateSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set Cliniko stock update setting' };
  }
});

// Update stock in Cliniko when items are received
ipcMain.handle('updateClinikoStock', async (event, productName, quantityToAdd, purId = null, productId = null) => {
  try {
    return await db.updateClinikoStock(productName, quantityToAdd, purId, productId);
  } catch (err) {
    logErrorToFile('updateClinikoStock error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to update Cliniko stock' };
  }
});

// Smart Prompts Setting API endpoints
ipcMain.handle('getSmartPromptsSetting', async () => {
  try {
    return await db.getSmartPromptsSetting();
  } catch (err) {
    logErrorToFile('getSmartPromptsSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get Smart Prompts setting' };
  }
});

// App settings handlers (company profile, logo path, etc.)
ipcMain.handle('getAppSetting', async (event, key) => {
  try {
    return await db.getAppSetting(key);
  } catch (err) {
    logErrorToFile('getAppSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get app setting' };
  }
});

ipcMain.handle('setAppSetting', async (event, key, value) => {
  try {
    return await db.setAppSetting(key, value);
  } catch (err) {
    logErrorToFile('setAppSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set app setting' };
  }
});

// Upload logo (base64 or binary buffer) - save under backend/uploads
ipcMain.handle('uploadFile', async (event, fileObj) => {
  try {
    // fileObj: { name, content } where content is a base64 string
    if (!fileObj || !fileObj.name || !fileObj.content) return { error: 'Invalid file data' };
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = fileObj.name.replace(/[<>:\\/?%*|\"']/g, '_');
    const filePath = path.join(uploadsDir, safeName);
    const buffer = Buffer.isBuffer(fileObj.content) ? fileObj.content : Buffer.from(fileObj.content, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, filename: safeName, path: filePath };
  } catch (err) {
    logErrorToFile('uploadFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to upload file' };
  }
});

ipcMain.handle('listUploads', async () => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) return { files: [] };
    const names = fs.readdirSync(uploadsDir).filter(n => fs.statSync(path.join(uploadsDir, n)).isFile());
    return { files: names };
  } catch (err) {
    logErrorToFile('listUploads error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to list uploads' };
  }
});

ipcMain.handle('setSmartPromptsSetting', async (event, enabled) => {
  try {
    return await db.setSmartPromptsSetting(enabled);
  } catch (err) {
    logErrorToFile('setSmartPromptsSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set Smart Prompts setting' };
  }
});

// Email functionality - opens system default email client
ipcMain.handle('sendSupplierEmails', async (event, emailData, outputFolder) => {
  try {
    // Persistent invocation log for debugging when sendSupplierEmails is called
    try {
      const logPath = path.join(__dirname, 'backend.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] sendSupplierEmails called - emailCount=${Array.isArray(emailData)?emailData.length:0}, outputFolder=${outputFolder}\n`);
    } catch (e) {
      console.error('Could not write to backend.log:', e && e.message ? e.message : e);
    }

    // Also write a start marker into the outputFolder/oft-debug directory so we can see attempts
    try {
      if (outputFolder && typeof outputFolder === 'string') {
        const debugDir = path.join(outputFolder, 'oft-debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const startFile = path.join(debugDir, `sendSupplierEmails_start_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
        const sample = {
          timestamp: new Date().toISOString(),
          emailCount: Array.isArray(emailData) ? emailData.length : 0,
          sampleEmails: Array.isArray(emailData) ? emailData.slice(0,3).map(e => ({ vendorName: e.vendorName, email: e.email })) : []
        };
        fs.writeFileSync(startFile, JSON.stringify(sample, null, 2), 'utf8');
      }
    } catch (e) {
      try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] sendSupplierEmails failed to write start marker: ${e && e.message ? e.message : e}\n`); } catch (ee) {}
    }
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    let sentCount = 0;
    const errors = [];
    const createdOftFiles = []; // Track only files created in this session

    for (const email of emailData) {
      try {
        const { vendorName, email: toEmail, subject, message, fallbackMessage, attachmentFile } = email;
        
        console.log(`🔍 BACKEND DEBUG: Processing email for vendor: ${vendorName}`);
        console.log(`🔍 BACKEND DEBUG: Email data received:`, { 
          vendorName, 
          toEmail, 
          subject: subject?.substring(0, 50) + '...', 
          attachmentFile,
          hasAttachment: !!attachmentFile
        });
        
        if (!toEmail || !toEmail.trim()) {
          errors.push(`No email address provided for ${vendorName}`);
          continue;
        }

        // Create .oft template file using Outlook COM
        const fs = require('fs');
        const path = require('path');
        
        if (!outputFolder) {
          errors.push(`Output folder not provided`);
          continue;
        }

        if (process.platform !== 'win32') {
          errors.push(`OFT file creation only supported on Windows`);
          continue;
        }

        try {
          // Clean vendor name for filename
          const cleanVendorName = vendorName.replace(/[<>:"/\\|?*]/g, '_');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const oftFilename = `${cleanVendorName}_Email_${timestamp}.oft`;
          // Prefer saving .oft files into the supplier-specific folder (same place POs are written)
          let supplierFolder = path.join(outputFolder, cleanVendorName);
          let useFolder = supplierFolder;
          try {
            if (!fs.existsSync(supplierFolder)) fs.mkdirSync(supplierFolder, { recursive: true });
            console.log('DEBUG: Ensured supplier folder exists for OFT:', supplierFolder);
          } catch (mkdirErr) {
            console.log('WARNING: Could not create supplier folder for OFT, falling back to outputFolder:', mkdirErr && mkdirErr.message ? mkdirErr.message : mkdirErr);
            useFolder = outputFolder;
          }
          const oftFilePath = path.join(useFolder, oftFilename);

          // Debug: Log attachment info
          console.log(`DEBUG: Processing ${vendorName}`);
          console.log(`DEBUG: attachmentFile = ${attachmentFile}`);
          if (attachmentFile && fs.existsSync(attachmentFile)) {
            console.log(`DEBUG: Attachment file exists: ${attachmentFile}`);
          } else if (attachmentFile) {
            console.log(`DEBUG: Attachment file NOT found: ${attachmentFile}`);
          } else {
            console.log(`DEBUG: No attachment file specified`);
          }

      // Write PowerShell script to temp file - exactly like your working test script
      const tempDir = require('os').tmpdir();
      const scriptPath = path.join(tempDir, `oft_create_${timestamp}.ps1`);

      // Safer approach: write the email HTML to a temporary .html file and have PowerShell read it
      const messageHtmlPath = path.join(tempDir, `oft_message_${timestamp}.html`);
      try {
      fs.writeFileSync(messageHtmlPath, message, 'utf8');
      console.log('DEBUG: Wrote temporary message HTML to', messageHtmlPath);
      } catch (writeErr) {
      console.error('Failed to write temporary message HTML file:', writeErr);
      }

      // Escape backslashes for embedding into PowerShell script
      const escapedMessageHtmlPath = (messageHtmlPath || '').replace(/\\/g, '\\\\');
      const escapedAttachmentPath = attachmentFile ? (attachmentFile.replace(/\\/g, '\\\\')) : null;
      const escapedOftPath = oftFilePath.replace(/\\/g, '\\\\');

      const powershellScript = `
try {
  # Create Outlook application
  $outlook = New-Object -ComObject Outlook.Application
    
  # Create mail item and set properties
  $mail = $outlook.CreateItem(0)  # olMailItem
  $mail.To = "${toEmail}"
  $mail.Subject = "${subject}"
  # Read HTML body from temporary file to avoid here-string quoting issues
  $mail.HTMLBody = Get-Content -Raw -Encoding UTF8 "${escapedMessageHtmlPath}"
    
  ${attachmentFile ? `# Add attachment
  $attachmentPath = "${escapedAttachmentPath}"
  if (Test-Path $attachmentPath) {
    $mail.Attachments.Add($attachmentPath)
    Write-Host "Attachment added: $attachmentPath"
  } else {
    Write-Host "WARNING: Attachment file not found: $attachmentPath"
  }` : '# No attachment specified'}
    
  $oftPath = "${escapedOftPath}"
    
  # Try different save format approaches (exactly like test_comprehensive_oft.ps1)
  try {
    # Method 1: Save as MSG first, then copy to OFT
    $msgPath = $oftPath.Replace('.oft', '.msg')
    $mail.SaveAs($msgPath, 3)  # olMSG = 3
        
    if (Test-Path $msgPath) {
      # Copy and rename to .oft
      Copy-Item $msgPath $oftPath -Force
      Remove-Item $msgPath -Force
      Write-Host "SUCCESS: OFT created via MSG method"
    }
        
  } catch {
    # Method 2: Direct OFT save with error handling
    Write-Host "MSG method failed, trying direct OFT save..."
    $mail.SaveAs($oftPath, 5)  # olTemplate = 5
    Write-Host "SUCCESS: OFT created via direct method"
  }
    
  # Clean up COM objects
  $mail = $null
  $outlook = $null
    
  # Verify file was created and report size
  if (Test-Path $oftPath) {
    $fileInfo = Get-Item $oftPath
    Write-Host "VERIFIED: OFT file exists - Size: $($fileInfo.Length) bytes"
  } else {
    Write-Host "ERROR: OFT file was not created"
  }
    
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
}
`;

      // Write script to temp file
      fs.writeFileSync(scriptPath, powershellScript, 'utf8');
          
          // Execute PowerShell script from file (like your test script)
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
          
          const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
          
          const result = await execPromise(command);
          console.log(`PowerShell output: ${result.stdout}`);
          if (result.stderr) {
            console.log(`PowerShell errors: ${result.stderr}`);
          }

          // Write debug log into outputFolder (if available) so we can inspect PS output later
          try {
            const debugLogDir = outputFolder && typeof outputFolder === 'string' ? path.join(outputFolder, 'oft-debug') : require('os').tmpdir();
            if (!fs.existsSync(debugLogDir)) fs.mkdirSync(debugLogDir, { recursive: true });
            const debugLogPath = path.join(debugLogDir, `oft_debug_${cleanVendorName}_${timestamp}.log`);
            const debugContents = [];
            debugContents.push(`COMMAND: ${command}`);
            debugContents.push(`--- POWERSHELL STDOUT ---\n`);
            debugContents.push(result.stdout || '');
            debugContents.push(`\n--- POWERSHELL STDERR ---\n`);
            debugContents.push(result.stderr || '');
            try {
              fs.writeFileSync(debugLogPath, debugContents.join('\n'), 'utf8');
              console.log(`DEBUG: Wrote PowerShell debug log: ${debugLogPath}`);
            } catch (writeLogErr) {
              console.log('Could not write debug log:', writeLogErr && writeLogErr.message ? writeLogErr.message : writeLogErr);
            }
          } catch (e) {
            console.log('Failed to write PS debug log:', e && e.message ? e.message : e);
          }

          // Clean up temp script file and temp message HTML unless developer requested to keep them
          try {
            if (!process.env.KEEP_OFT_SCRIPTS || process.env.KEEP_OFT_SCRIPTS === '0') {
              fs.unlinkSync(scriptPath);
            } else {
              console.log('DEBUG: Preserving temp PowerShell script because KEEP_OFT_SCRIPTS is set. Script path:', scriptPath);
            }
          } catch (cleanupErr) {
            console.log(`Could not clean up temp script: ${cleanupErr.message}`);
          }
          try {
            if (typeof messageHtmlPath !== 'undefined' && fs.existsSync(messageHtmlPath)) {
              if (!process.env.KEEP_OFT_SCRIPTS || process.env.KEEP_OFT_SCRIPTS === '0') {
                fs.unlinkSync(messageHtmlPath);
              } else {
                console.log('DEBUG: Preserving temp message HTML because KEEP_OFT_SCRIPTS is set. Path:', messageHtmlPath);
              }
            }
          } catch (cleanupHtmlErr) {
            console.log(`Could not clean up temp message HTML: ${cleanupHtmlErr.message}`);
          }
          
          // Verify file was created and check size (expecting ~16kb like test script)
          if (fs.existsSync(oftFilePath)) {
            const stats = fs.statSync(oftFilePath);
            console.log(`Created .oft template file: ${oftFilename} (${stats.size} bytes)`);
            
            if (stats.size > 10000) { // Should be around 16kb for proper OFT files
              sentCount++;
              // Add this specific file to our created files list
              const oftFileObj = {
                filename: oftFilename,
                path: oftFilePath,
                file: outputFolder ? path.relative(outputFolder, oftFilePath) : oftFilePath,
                vendor: vendorName,
                created: stats.birthtime || new Date(),
                size: stats.size
              };
              console.log(`🔍 BACKEND DEBUG: Adding OFT file to createdOftFiles:`, oftFileObj);
              createdOftFiles.push(oftFileObj);
            } else {
              errors.push(`Created .oft file for ${vendorName} but size is too small (${stats.size} bytes) - may be corrupted`);
            }
          } else {
            errors.push(`Failed to create .oft file for ${vendorName} - file not found after PowerShell execution`);
          }
          
        } catch (err) {
          console.error(`Failed to create .oft file for ${vendorName}:`, err);
          errors.push(`Failed to create .oft file for ${vendorName}: ${err.message}`);
        }
        
      } catch (err) {
        console.error(`Failed to open email for ${email.vendorName}:`, err);
        errors.push(`Failed to open email for ${email.vendorName}: ${err.message}`);
      }
    }

    if (sentCount > 0) {
      const response = { 
        success: true, 
        sentCount, 
        message: `Created ${sentCount} .oft email template file(s)`,
        oftFiles: createdOftFiles, // Return only files created in this session
        errors: errors.length > 0 ? errors : undefined
      };
      try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] sendSupplierEmails SUCCESS - sentCount=${sentCount}, created=${createdOftFiles.length}\n`); } catch (e) {}
      console.log(`🔍 BACKEND DEBUG: Final response with ${createdOftFiles.length} OFT files:`, response);
      return response;
    } else {
      try { fs.appendFileSync(path.join(__dirname, 'backend.log'), `[${new Date().toISOString()}] sendSupplierEmails FAILURE - errors=${JSON.stringify(errors)}\n`); } catch (e) {}
      return { 
        success: false, 
        error: 'Failed to create any .oft files', 
        details: errors 
      };
    }
    
  } catch (err) {
    logErrorToFile('sendSupplierEmails error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { 
      success: false, 
      error: 'Failed to create .oft email template files', 
      details: err.message 
    };
  }
});

// Delete file from disk
ipcMain.handle('deleteFileFromDisk', async (event, filePath) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    fs.unlinkSync(filePath);
    return { success: true, message: 'File deleted successfully' };
    
  } catch (err) {
    logErrorToFile('deleteFileFromDisk error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { success: false, error: 'Failed to delete file', details: err.message };
  }
});

// Check if vendor files have been created for a specific type
ipcMain.handle('hasVendorFilesCreated', async (event, prId, vendorName, fileType) => {
  try {
    return await db.hasVendorFilesCreated(prId, vendorName, fileType);
  } catch (err) {
    logErrorToFile('hasVendorFilesCreated error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return false;
  }
});

// Open .oft file with default application
ipcMain.handle('openOftFile', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    const fs = require('fs');
    
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    await shell.openPath(filePath);
    return { success: true, message: 'File opened successfully' };
    
  } catch (err) {
    logErrorToFile('openOftFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { success: false, error: 'Failed to open file', details: err.message };
  }
});

// Supplier management API endpoints
ipcMain.handle('getAllSuppliers', async () => {
  try {
    return await db.getAllSuppliers();
  } catch (err) {
    logErrorToFile('getAllSuppliers error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get suppliers' };
  }
});

ipcMain.handle('addSupplier', async (event, name, email, contactName, comments, accountNumber = '') => {
  try {
    return await db.addSupplier(name, email, contactName, comments, accountNumber);
  } catch (err) {
    logErrorToFile('addSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err.error || 'Failed to add supplier' };
  }
});

ipcMain.handle('updateSupplier', async (event, id, name, email, contactName, comments, accountNumber = '') => {
  try {
    return await db.updateSupplier(id, name, email, contactName, comments, accountNumber);
  } catch (err) {
    logErrorToFile('updateSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err.error || 'Failed to update supplier' };
  }
});

ipcMain.handle('deleteSupplier', async (event, id) => {
  try {
    return await db.deleteSupplier(id);
  } catch (err) {
    logErrorToFile('deleteSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err.error || 'Failed to delete supplier' };
  }
});

ipcMain.handle('getSupplierByName', async (event, name) => {
  try {
    return await db.getSupplierByName(name);
  } catch (err) {
    logErrorToFile('getSupplierByName error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get supplier' };
  }
});

ipcMain.handle('getInactiveSuppliers', async () => {
  try {
    return await db.getInactiveSuppliers();
  } catch (err) {
    logErrorToFile('getInactiveSuppliers error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get inactive suppliers' };
  }
});

ipcMain.handle('getSupplierUsageSummary', async () => {
  try {
    return await db.getSupplierUsageSummary();
  } catch (err) {
    logErrorToFile('getSupplierUsageSummary error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get supplier usage summary' };
  }
});

ipcMain.handle('deleteInactiveSuppliers', async (event, forceDelete = false) => {
  try {
    return await db.deleteInactiveSuppliers(forceDelete);
  } catch (err) {
    logErrorToFile('deleteInactiveSuppliers error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to delete inactive suppliers' };
  }
});

ipcMain.handle('reactivateSupplier', async (event, supplierId) => {
  try {
    return await db.reactivateSupplier(supplierId);
  } catch (err) {
    logErrorToFile('reactivateSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to reactivate supplier' };
  }
});

ipcMain.handle('deactivateSupplier', async (event, supplierId) => {
  try {
    return await db.deactivateSupplier(supplierId);
  } catch (err) {
    logErrorToFile('deactivateSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to deactivate supplier' };
  }
});

ipcMain.handle('activateProduct', async (event, clinikoId) => {
  try {
    return await db.activateProduct(clinikoId);
  } catch (err) {
    logErrorToFile('activateProduct error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to activate product' };
  }
});

ipcMain.handle('deactivateProduct', async (event, clinikoId) => {
  try {
    return await db.deactivateProduct(clinikoId);
  } catch (err) {
    logErrorToFile('deactivateProduct error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to deactivate product' };
  }
});

// --- Supplier lead-time, demand and reorder helper endpoints ---
ipcMain.handle('getAverageDailyDemand', async (event, productId, days = 90) => {
  try {
    return await db.getAverageDailyDemand(productId, days);
  } catch (err) {
    logErrorToFile('getAverageDailyDemand error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get average daily demand' };
  }
});

ipcMain.handle('getSupplierLeadTime', async (event, supplierName) => {
  try {
    return await db.getSupplierLeadTime(supplierName);
  } catch (err) {
    logErrorToFile('getSupplierLeadTime error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get supplier lead time' };
  }
});

ipcMain.handle('setSupplierLeadTime', async (event, supplierName, days) => {
  try {
    return await db.setSupplierLeadTime(supplierName, days);
  } catch (err) {
    logErrorToFile('setSupplierLeadTime error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set supplier lead time' };
  }
});

ipcMain.handle('getSuppliersWithLeadTime', async () => {
  try {
    return await db.getSuppliersWithLeadTime();
  } catch (err) {
    logErrorToFile('getSuppliersWithLeadTime error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get suppliers with lead times' };
  }
});

ipcMain.handle('getReorderSuggestion', async (event, productId, opts = {}) => {
  try {
    return await db.getReorderSuggestion(productId, opts);
  } catch (err) {
    logErrorToFile('getReorderSuggestion error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get reorder suggestion' };
  }
});

ipcMain.handle('getVendorConsolidation', async (event, windowDays = 14, opts = {}) => {
  try {
    return await db.getVendorConsolidation(windowDays, opts);
  } catch (err) {
    logErrorToFile('getVendorConsolidation error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get vendor consolidation' };
  }
});

// Supplier/Product discount CRUD and lookup
ipcMain.handle('addSupplierProductDiscount', async (event, discount) => {
  try {
    return await db.addSupplierProductDiscount(discount);
  } catch (err) {
    logErrorToFile('addSupplierProductDiscount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to add discount' };
  }
});

ipcMain.handle('updateSupplierProductDiscount', async (event, id, updates) => {
  try {
    return await db.updateSupplierProductDiscount(id, updates);
  } catch (err) {
    logErrorToFile('updateSupplierProductDiscount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to update discount' };
  }
});

ipcMain.handle('deleteSupplierProductDiscount', async (event, id) => {
  try {
    return await db.deleteSupplierProductDiscount(id);
  } catch (err) {
    logErrorToFile('deleteSupplierProductDiscount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to delete discount' };
  }
});

ipcMain.handle('listSupplierProductDiscounts', async (event, filter) => {
  try {
    return await db.listSupplierProductDiscounts(filter || {});
  } catch (err) {
    logErrorToFile('listSupplierProductDiscounts error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to list discounts' };
  }
});

ipcMain.handle('findApplicableDiscount', async (event, query) => {
  try {
    return await db.findApplicableDiscount(query || {});
  } catch (err) {
    logErrorToFile('findApplicableDiscount error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to find applicable discount' };
  }
});

// Email Template Management
ipcMain.handle('saveEmailTemplate', async (event, templateData) => {
  try {
    return await db.saveEmailTemplate(templateData);
  } catch (err) {
    logErrorToFile('saveEmailTemplate error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err.error || 'Failed to save email template' };
  }
});

ipcMain.handle('getEmailTemplate', async () => {
  try {
    return await db.getEmailTemplate();
  } catch (err) {
    logErrorToFile('getEmailTemplate error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get email template' };
  }
});

// File tracking handlers
ipcMain.handle('getGeneratedFiles', async (event, prId, fileType = null) => {
  try {
    return await db.getGeneratedFiles(prId, fileType);
  } catch (err) {
    logErrorToFile('getGeneratedFiles error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get generated files' };
  }
});

ipcMain.handle('markVendorFilesCreated', async (event, prId, vendorName, fileType, filename, filePath, fileSize = null) => {
  try {
    return await db.markVendorFilesCreated(prId, vendorName, fileType, filename, filePath, fileSize);
  } catch (err) {
    logErrorToFile('markVendorFilesCreated error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to mark vendor files as created' };
  }
});

ipcMain.handle('deleteGeneratedFile', async (event, prId, vendorName, fileType, filename) => {
  try {
    return await db.deleteGeneratedFile(prId, vendorName, fileType, filename);
  } catch (err) {
    logErrorToFile('deleteGeneratedFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to delete generated file' };
  }
});

ipcMain.handle('getFileStats', async (event, filePath) => {
  try {
    return await db.getFileStats(filePath);
  } catch (err) {
    logErrorToFile('getFileStats error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return null;
  }
});

ipcMain.handle('fileExists', async (event, filePath) => {
  try {
    return await db.fileExists(filePath);
  } catch (err) {
    logErrorToFile('fileExists error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return false;
  }
});

ipcMain.handle('updatePurchaseRequestSupplierFilesStatus', async (event, prId, hasSupplierFiles) => {
  try {
    return await db.updatePurchaseRequestSupplierFilesStatus(prId, hasSupplierFiles);
  } catch (err) {
    logErrorToFile('updatePurchaseRequestSupplierFilesStatus error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to update supplier files status' };
  }
});

ipcMain.handle('updatePurchaseRequestOftFilesStatus', async (event, prId, hasOftFiles) => {
  try {
    return await db.updatePurchaseRequestOftFilesStatus(prId, hasOftFiles);
  } catch (err) {
    logErrorToFile('updatePurchaseRequestOftFilesStatus error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to update OFT files status' };
  }
});

ipcMain.handle('updatePurchaseRequestEmailsSentStatus', async (event, prId, sent) => {
  try {
    // Log invocation in main process so developer can correlate renderer console and backend.log
    try { console.log(`[IPC] updatePurchaseRequestEmailsSentStatus called prId=${prId} sent=${sent}`); } catch (e) {}
    const result = await db.updatePurchaseRequestEmailsSentStatus(prId, sent);
    try { console.log(`[IPC] updatePurchaseRequestEmailsSentStatus result prId=${prId} result=${JSON.stringify(result)}`); } catch (e) {}
    return result;
  } catch (err) {
    logErrorToFile('updatePurchaseRequestEmailsSentStatus error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    try { console.error('[IPC] updatePurchaseRequestEmailsSentStatus error:', err && err.message ? err.message : err); } catch (e) {}
    return { error: 'Failed to update emails_sent status' };
  }
});

ipcMain.handle('updatePurchaseRequestEmailsSentStatusForce', async (event, prId, sent) => {
  try {
    try { console.log(`[IPC] updatePurchaseRequestEmailsSentStatusForce called prId=${prId} sent=${sent}`); } catch (e) {}
    const result = await db.updatePurchaseRequestEmailsSentStatusForce(prId, sent);
    try { console.log(`[IPC] updatePurchaseRequestEmailsSentStatusForce result prId=${prId} result=${JSON.stringify(result)}`); } catch (e) {}
    return result;
  } catch (err) {
    logErrorToFile('updatePurchaseRequestEmailsSentStatusForce error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to update emails_sent status' };
  }
});

// Exit app handler
ipcMain.handle('exit-app', async () => {
  app.quit();
  return { success: true };
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

