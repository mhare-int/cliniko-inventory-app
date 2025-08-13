// --- Electron/Node.js requires at the very top ---
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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

// --- Open .eml file in default email client ---
ipcMain.handle('openEmlFile', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    logErrorToFile('openEmlFile error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { success: false, error: err.message };
  }
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

// --- Auto-Updater Configuration Function ---
async function initializeAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[Auto-Updater] Development mode - auto-updater disabled');
    return;
  }

  console.log('[Auto-Updater] Initializing auto-updater in production mode...');
  
  try {
    const updateConfig = {
      provider: 'github',
      owner: 'mhare-int',
      repo: 'cliniko-inventory-app',
      private: true
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
  createWindow();
  
  // Initialize auto-updater after app is ready and database is available
  await initializeAutoUpdater();
  
  // Check for updates after initialization (in production only)
  if (app.isPackaged) {
    setTimeout(() => {
      console.log('[Auto-Updater] Performing initial update check...');
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000); // Wait 5 seconds after startup to ensure everything is initialized
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

// Email functionality - creates email drafts using Outlook COM on Windows, .eml files on other platforms
ipcMain.handle('sendSupplierEmails', async (event, emailData) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const mimeTypes = require('mime-types');
    
    let sentCount = 0;
    const errors = [];
    const emlFiles = [];

    // Check if we're on Windows and can use Outlook COM
    const isWindows = os.platform() === 'win32';
    let outlookApp = null;
    
    if (isWindows) {
      try {
        // Try to create Outlook COM object
        const { spawn } = require('child_process');
        // We'll use a PowerShell script to create Outlook emails
      } catch (comError) {
        console.log('Outlook COM not available, falling back to .eml files');
      }
    }

    for (const email of emailData) {
      try {
        const { vendorName, email: toEmail, subject, message, fallbackMessage, attachmentFile } = email;
        
        if (!toEmail || !toEmail.trim()) {
          errors.push(`No email address provided for ${vendorName}`);
          continue;
        }

        if (isWindows) {
          // Use PowerShell to create Outlook COM email (more reliable than direct COM in Node.js)
          const sanitizedVendorName = vendorName.replace(/[<>:"/\\|?*]/g, '_');
          
          // Create PowerShell script content
          const powershellScript = `
try {
    $outlook = New-Object -ComObject Outlook.Application
    $mail = $outlook.CreateItem(0)
    
    $mail.To = "${toEmail.replace(/"/g, '""')}"
    $mail.Subject = "${subject.replace(/"/g, '""')}"
    
    # Set HTML body with full formatting
    $htmlBody = @"
${message.replace(/"/g, '""')}
"@
    
    $mail.HTMLBody = $htmlBody
    
    # Add attachment if provided
    ${attachmentFile && fs.existsSync(attachmentFile) ? `
    $attachmentPath = "${attachmentFile.replace(/\\/g, '\\\\').replace(/"/g, '""')}"
    if (Test-Path $attachmentPath) {
        $mail.Attachments.Add($attachmentPath)
    }` : ''}
    
    # Display the email as editable draft
    $mail.Display()
    
    Write-Host "SUCCESS: Email draft created for ${vendorName.replace(/"/g, '""')}"
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}`;
          
          // Save PowerShell script to temp file
          const tempDir = os.tmpdir();
          const scriptPath = path.join(tempDir, `outlook_email_${Date.now()}.ps1`);
          fs.writeFileSync(scriptPath, powershellScript, 'utf8');
          
          // Execute PowerShell script
          const { spawn } = require('child_process');
          const powershell = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath
          ], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let scriptOutput = '';
          let scriptError = '';
          
          powershell.stdout.on('data', (data) => {
            scriptOutput += data.toString();
          });
          
          powershell.stderr.on('data', (data) => {
            scriptError += data.toString();
          });
          
          await new Promise((resolve, reject) => {
            powershell.on('close', (code) => {
              // Clean up temp script file
              try {
                fs.unlinkSync(scriptPath);
              } catch (e) {}
              
              if (code === 0 && scriptOutput.includes('SUCCESS')) {
                console.log(`✅ Created Outlook draft for ${vendorName}`);
                sentCount++;
                emlFiles.push({
                  vendor: vendorName,
                  email: toEmail,
                  file: `Outlook Draft - ${vendorName}`,
                  filename: `Draft created in Outlook for ${vendorName}`,
                  isOutlookDraft: true
                });
                resolve();
              } else {
                console.error(`❌ PowerShell error for ${vendorName}: ${scriptError || scriptOutput}`);
                errors.push(`Failed to create Outlook draft for ${vendorName}: ${scriptError || 'Unknown error'}`);
                resolve(); // Continue with other emails
              }
            });
            
            powershell.on('error', (err) => {
              console.error(`❌ PowerShell spawn error for ${vendorName}:`, err);
              errors.push(`Failed to launch PowerShell for ${vendorName}: ${err.message}`);
              resolve(); // Continue with other emails
            });
          });
          
        } else {
          // Non-Windows: Create .eml file (existing logic)
          const sanitizedVendorName = vendorName.replace(/[<>:"/\\|?*]/g, '_');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const emlFilename = `PO_${sanitizedVendorName}_${timestamp}.eml`;
          
          // Use the same output folder that was selected for Excel files, or get from first file
          let outputFolder = '';
          if (attachmentFile) {
            outputFolder = path.dirname(attachmentFile);
          } else {
            // If no attachment file, try to find output folder from other emails in this batch
            const fileWithAttachment = emailData.find(e => e.attachmentFile);
            if (fileWithAttachment) {
              outputFolder = path.dirname(fileWithAttachment.attachmentFile);
            } else {
              // Fallback to desktop if no output folder can be determined
              outputFolder = require('os').homedir();
            }
          }
          
          const emlFilePath = path.join(outputFolder, emlFilename);

          // Create proper .eml file content (RFC 2822 email format)
          let emlContent = '';
          
          // Add X-Unsent header to make it open as editable draft in Outlook
          emlContent += `X-Unsent: 1\r\n`;
          
          // Standard email headers
          emlContent += `From: "The Good Life Clinic" <noreply@goodlifeclinic.com.au>\r\n`;
          emlContent += `To: ${toEmail}\r\n`;
          emlContent += `Subject: ${subject}\r\n`;
          emlContent += `Date: ${new Date().toUTCString()}\r\n`;
          emlContent += `MIME-Version: 1.0\r\n`;
          
          // Handle attachments if present
          if (attachmentFile && fs.existsSync(attachmentFile)) {
            const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            emlContent += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
            emlContent += `\r\n`;
            emlContent += `This is a multi-part message in MIME format.\r\n`;
            emlContent += `\r\n`;
            emlContent += `--${boundary}\r\n`;
            emlContent += `Content-Type: text/html; charset="utf-8"\r\n`;
            emlContent += `Content-Transfer-Encoding: quoted-printable\r\n`;
            emlContent += `\r\n`;
            emlContent += message.replace(/=/g, '=3D');
            emlContent += `\r\n`;
            emlContent += `\r\n`;
            emlContent += `--${boundary}\r\n`;
            
            const attachmentName = path.basename(attachmentFile);
            const mimeType = mimeTypes.lookup(attachmentFile) || 'application/octet-stream';
            const attachmentData = fs.readFileSync(attachmentFile);
            const base64Data = attachmentData.toString('base64');
            
            emlContent += `Content-Type: ${mimeType}; name="${attachmentName}"\r\n`;
            emlContent += `Content-Transfer-Encoding: base64\r\n`;
            emlContent += `Content-Disposition: attachment; filename="${attachmentName}"\r\n`;
            emlContent += `\r\n`;
            
            // Split base64 data into 76-character lines
            const lines = base64Data.match(/.{1,76}/g);
            if (lines) {
              emlContent += lines.join('\r\n');
            }
            emlContent += `\r\n`;
            emlContent += `\r\n`;
            emlContent += `--${boundary}--\r\n`;
          } else {
            // Simple HTML email without attachments
            emlContent += `Content-Type: text/html; charset="utf-8"\r\n`;
            emlContent += `Content-Transfer-Encoding: quoted-printable\r\n`;
            emlContent += `\r\n`;
            emlContent += message.replace(/=/g, '=3D');
          }

          // Write .eml file
          fs.writeFileSync(emlFilePath, emlContent);
          
          emlFiles.push({
            vendor: vendorName,
            email: toEmail,
            file: emlFilePath,
            filename: emlFilename
          });
          
          sentCount++;
          console.log(`✅ Created .eml file for ${vendorName}: ${emlFilename}`);
        }
        
      } catch (emailError) {
        console.error(`❌ Error creating email for ${email.vendorName}:`, emailError);
        errors.push(`Failed to create email for ${email.vendorName}: ${emailError.message}`);
      }
    }

    const result = {
      success: true,
      sentCount,
      totalCount: emailData.length,
      errors,
      emlFiles,
      message: isWindows 
        ? `Created ${sentCount} editable email draft(s) in Outlook. Check your Outlook drafts folder.`
        : `Created ${sentCount} email template file(s). Double-click any .eml file to open in your email client.`
    };

    console.log(`📧 Email generation complete: ${sentCount}/${emailData.length} files created`);
    return result;

  } catch (err) {
    console.error('sendSupplierEmails error:', err);
    logErrorToFile('sendSupplierEmails error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return {
      success: false,
      error: 'Failed to create email files: ' + (err && err.message ? err.message : 'Unknown error'),
      sentCount: 0,
      totalCount: emailData ? emailData.length : 0,
      errors: [err && err.message ? err.message : 'Unknown error'],
      emlFiles: []
    };
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

ipcMain.handle('addSupplier', async (event, name, email, contactName, comments) => {
  try {
    return await db.addSupplier(name, email, contactName, comments);
  } catch (err) {
    logErrorToFile('addSupplier error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err.error || 'Failed to add supplier' };
  }
});

ipcMain.handle('updateSupplier', async (event, id, name, email, contactName, comments) => {
  try {
    return await db.updateSupplier(id, name, email, contactName, comments);
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

