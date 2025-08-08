// --- Electron/Node.js requires at the very top ---
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Set up database path for production
if (app.isPackaged) {
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
}

// Import backend logic (after setting DB_PATH)
const db = require('./backend/db');

// Global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logErrorToFile('Unhandled Promise Rejection: ' + (reason && reason.stack ? reason.stack : JSON.stringify(reason)));
  console.error('Unhandled Promise Rejection:', reason);
});

// Helper to log errors to a file in the user data directory
function logErrorToFile(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'backend-error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {
    // Fallback: console error
    console.error('Failed to write to backend-error.log:', e);
  }
}

let mainWindow;

function createWindow() {
  console.log('[Electron] Creating main window...');
  
  try {
    mainWindow = new BrowserWindow({
      width: 1600,
      height: 1200,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    const htmlPath = path.join(__dirname, 'client', 'build', 'index.html');
    console.log('[Electron] Loading HTML from:', htmlPath);
    
    // Load the React build directly from the build folder
    mainWindow.loadFile(htmlPath);
    
    // Open Developer Tools for debugging (only in development)
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
    
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
  } catch (error) {
    console.error('[Electron] Error creating window:', error);
    logErrorToFile('Error creating window: ' + error.message);
  }
}

// --- Get active PURs for a barcode ---
ipcMain.handle('getActivePURsForBarcode', async (event, barcode) => {
  try {
    return await db.getActivePURsForBarcode(barcode);
  } catch (err) {
    logErrorToFile('getActivePURsForBarcode error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to get active PURs for barcode', details: err.details || err.message || err };
  }
});

// --- Supplier Order File Creation ---
ipcMain.handle('createSupplierOrderFilesForVendors', async (event, items, outputFolder) => {
  try {
    return await db.createSupplierOrderFilesForVendors(items, outputFolder);
  } catch (err) {
    logErrorToFile('createSupplierOrderFilesForVendors error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to create supplier order files', details: err.details || err.message || err };
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
  try {
    return await db.updateSalesDataFromCliniko(startDate, endDate);
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

// --- Auto-Updater Configuration ---
// Configure auto-updater for GitHub releases
if (!app.isPackaged) {
  // Development mode - disable auto-updater
  console.log('[Auto-Updater] Development mode - auto-updater disabled');
} else {
  // Production mode - enable auto-updater
  (async () => {
    const updateConfig = {
      provider: 'github',
      owner: 'mhare-int', // Your GitHub username
      repo: 'cliniko-inventory-app', // Your repo name
      private: true // Mark as private repository
    };

    // Add GitHub token if available (required for private repos)
    let githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    
    // If no environment token, try to get from database/settings
    if (!githubToken) {
      try {
        const tokenResult = await db.getGitHubToken();
        if (tokenResult && tokenResult.token) {
          githubToken = tokenResult.token;
          console.log('[Auto-Updater] Using GitHub token from app settings');
        }
      } catch (err) {
        console.warn('[Auto-Updater] Could not retrieve GitHub token from settings:', err.message);
      }
    }
    
    if (githubToken) {
      updateConfig.token = githubToken;
      console.log('[Auto-Updater] Using GitHub token for private repository access');
    } else {
      console.warn('[Auto-Updater] No GitHub token found. Private repository updates may fail.');
      console.warn('[Auto-Updater] Set GH_TOKEN environment variable or configure in app settings.');
    }

    autoUpdater.setFeedURL(updateConfig);

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('[Auto-Updater] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Auto-Updater] Update available:', info.version);
      // Show notification to user through main window
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
      // Send progress to renderer
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Auto-Updater] Update downloaded:', info.version);
      // Show "restart to install" dialog
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info.version);
      }
    });
  })().catch(err => {
    console.error('[Auto-Updater] Initialization error:', err);
  });
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

app.on('ready', () => {
  console.log('[Electron] App ready. Starting backend...');
  createWindow();
  
  // Check for updates after app is ready (in production only)
  if (app.isPackaged) {
    setTimeout(() => {
      console.log('[Auto-Updater] Checking for updates...');
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000); // Wait 3 seconds after startup
  }
});

// --- IPC handlers for backend logic ---
ipcMain.handle('deleteUser', async (event, userId) => {
  return await db.deleteUser(userId);
});

ipcMain.handle('changeUserPassword', async (event, userId, newPassword) => {
  return await db.changeUserPassword(userId, newPassword);
});

ipcMain.handle('updatePurchaseRequestReceived', async (event, prId, lines) => {
  return await db.updatePurchaseRequestReceived(prId, lines);
});

ipcMain.handle('receiveItemById', async (event, itemId, quantityReceived) => {
  try {
    return await db.receiveItemById(itemId, quantityReceived);
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
  return await db.setSessionTimeout(hours);
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

ipcMain.handle('downloadFile', async (event, filename) => {
  return await db.downloadFile(filename);
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
ipcMain.handle('updateClinikoStock', async (event, productName, quantityToAdd, purNumber = null) => {
  try {
    return await db.updateClinikoStock(productName, quantityToAdd, purNumber);
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

ipcMain.handle('setSmartPromptsSetting', async (event, enabled) => {
  try {
    return await db.setSmartPromptsSetting(enabled);
  } catch (err) {
    logErrorToFile('setSmartPromptsSetting error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to set Smart Prompts setting' };
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

