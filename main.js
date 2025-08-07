// --- Electron/Node.js requires at the very top ---
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
// Import backend logic
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
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // Load the React build directly from the build folder
  mainWindow.loadFile(path.join(__dirname, 'client', 'build', 'index.html'));
  
  // Open Developer Tools for debugging (comment out for production)
  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Electron] Window failed to load: ${errorDescription} (${errorCode})`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Main window finished loading.');
  });
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

// --- Update sales data from Cliniko API ---
ipcMain.handle('updateSalesDataFromCliniko', async (event, startDate = null, endDate = null) => {
  try {
    return await db.updateSalesDataFromCliniko(startDate, endDate);
  } catch (err) {
    logErrorToFile('updateSalesDataFromCliniko error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: err && err.error ? err.error : 'Failed to update sales data from Cliniko' };
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
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mhare-int', // Your GitHub username
    repo: 'cliniko-inventory-app' // Your repo name
  });

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

// --- User Behavior Logging ---
ipcMain.handle('startUserSession', async (event, userId, sessionId) => {
  try {
    return await db.startUserSession(userId, sessionId);
  } catch (err) {
    logErrorToFile('startUserSession error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to start user session' };
  }
});

ipcMain.handle('endUserSession', async (event, sessionId) => {
  try {
    return await db.endUserSession(sessionId);
  } catch (err) {
    logErrorToFile('endUserSession error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to end user session' };
  }
});

ipcMain.handle('logUserBehavior', async (event, userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata) => {
  try {
    return await db.logUserBehavior(userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata);
  } catch (err) {
    logErrorToFile('logUserBehavior error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to log user behavior' };
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
    return { error: 'Failed to get user behavior analytics' };
  }
});

ipcMain.handle('getAllUsersBehaviorInsights', async (event, daysPast) => {
  try {
    return await db.getAllUsersBehaviorInsights(daysPast);
  } catch (err) {
    logErrorToFile('getAllUsersBehaviorInsights error: ' + (err && err.message ? err.message : JSON.stringify(err)));
    return { error: 'Failed to get all users behavior insights' };
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

