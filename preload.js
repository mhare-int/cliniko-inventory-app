const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  changeUserPassword: (userId, newPassword) => ipcRenderer.invoke('changeUserPassword', userId, newPassword),
  getSessionTimeout: () => ipcRenderer.invoke('getSessionTimeout'),
  setSessionTimeout: (hours) => ipcRenderer.invoke('setSessionTimeout', hours),
  getAllProducts: () => ipcRenderer.invoke('getAllProducts'),
  getAllProductsWithWrapper: () => ipcRenderer.invoke('getAllProductsWithWrapper'),
  getAllUsers: () => ipcRenderer.invoke('getAllUsers'),
  addUser: (username, password_hash, is_admin) => ipcRenderer.invoke('addUser', username, password_hash, is_admin),
  updateReorderLevels: (updates) => ipcRenderer.invoke('updateReorderLevels', updates),
  updateProductReorderLevel: (product_id, new_level) => ipcRenderer.invoke('updateProductReorderLevel', product_id, new_level),
  createPurchaseRequest: (data) => ipcRenderer.invoke('createPurchaseRequest', data),
  getPurchaseRequests: (active_only, group_by) => ipcRenderer.invoke('getPurchaseRequests', active_only, group_by),
  deletePurchaseRequest: (pr_id) => ipcRenderer.invoke('deletePurchaseRequest', pr_id),
  deleteUser: (userId) => ipcRenderer.invoke('deleteUser', userId),
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  getCurrentUser: (token) => ipcRenderer.invoke('getCurrentUser', token),
  // First time setup
  isFirstTimeSetup: () => ipcRenderer.invoke('isFirstTimeSetup'),
  createFirstAdminUser: (username, password) => ipcRenderer.invoke('createFirstAdminUser', username, password),
  resetFirstTimeSetup: () => ipcRenderer.invoke('resetFirstTimeSetup'),
  getProductOptions: (term) => ipcRenderer.invoke('getProductOptions', term),
  downloadFile: (filename) => ipcRenderer.invoke('downloadFile', filename),
  getProductSales: (start_date, end_date) => ipcRenderer.invoke('getProductSales', start_date, end_date),
  getSalesInsights: (limit, offset) => ipcRenderer.invoke('getSalesInsights', limit, offset),
  getSalesInsightsWithCustomRanges: (customRanges, limit, offset) => ipcRenderer.invoke('getSalesInsightsWithCustomRanges', customRanges, limit, offset),
  logout: () => ipcRenderer.invoke('logout'),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),
  setApiKey: (newKey) => ipcRenderer.invoke('setApiKey', newKey),
  updatePurchaseRequestReceived: (pr_id, lines) => ipcRenderer.invoke('updatePurchaseRequestReceived', pr_id, lines),
  receiveItemById: (itemId, quantityReceived) => ipcRenderer.invoke('receiveItemById', itemId, quantityReceived),
  updateStockFromCliniko: () => {
    console.log('updateStockFromCliniko called from frontend');
    return ipcRenderer.invoke('updateStockFromCliniko');
  },
  syncProductsFromCliniko: () => {
    console.log('syncProductsFromCliniko called from frontend');
    return ipcRenderer.invoke('syncProductsFromCliniko');
  },
  updateSalesDataFromCliniko: (startDate = null, endDate = null) => {
    console.log('updateSalesDataFromCliniko called from frontend');
    return ipcRenderer.invoke('updateSalesDataFromCliniko', startDate, endDate);
  },
  previewSalesDataCount: (startDate = null, endDate = null, apiKey = null) => {
    console.log('previewSalesDataCount called from frontend');
    return ipcRenderer.invoke('previewSalesDataCount', startDate, endDate, apiKey);
  },
  // Folder picker for output directory
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  // Expose createSupplierOrderFilesForVendors to frontend
  createSupplierOrderFilesForVendors: (items, outputFolder) => ipcRenderer.invoke('createSupplierOrderFilesForVendors', items, outputFolder),
  // Get active PURs for a barcode
  getActivePURsForBarcode: (barcode) => ipcRenderer.invoke('getActivePURsForBarcode', barcode),
  
  // User behavior tracking APIs
  startUserSession: (userId, sessionId) => ipcRenderer.invoke('startUserSession', userId, sessionId),
  endUserSession: (sessionId) => ipcRenderer.invoke('endUserSession', sessionId),
  logUserBehavior: (userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata) => 
    ipcRenderer.invoke('logUserBehavior', userId, sessionId, actionType, featureAccessed, pageUrl, durationMs, metadata),
  setUserPreference: (userId, key, value) => ipcRenderer.invoke('setUserPreference', userId, key, value),
  getUserPreferences: (userId) => ipcRenderer.invoke('getUserPreferences', userId),
  getUserBehaviorAnalytics: (userId, daysPast) => ipcRenderer.invoke('getUserBehaviorAnalytics', userId, daysPast),
  getAllUsersBehaviorInsights: (daysPast) => ipcRenderer.invoke('getAllUsersBehaviorInsights', daysPast),
  
  // Cliniko stock update APIs
  getClinikoStockUpdateSetting: () => ipcRenderer.invoke('getClinikoStockUpdateSetting'),
  setClinikoStockUpdateSetting: (enabled) => ipcRenderer.invoke('setClinikoStockUpdateSetting', enabled),
  updateClinikoStock: (productName, quantityToAdd) => ipcRenderer.invoke('updateClinikoStock', productName, quantityToAdd),
  
  // Smart Prompts setting APIs
  getSmartPromptsSetting: () => ipcRenderer.invoke('getSmartPromptsSetting'),
  setSmartPromptsSetting: (enabled) => ipcRenderer.invoke('setSmartPromptsSetting', enabled),
  
  // Auto-updater APIs
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // App control
  exitApp: () => ipcRenderer.invoke('exit-app'),
  
  // Listen for update events from main process
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, version) => callback(version));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, version) => callback(version));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  }
  // Add more functions here as you expose them in main.js
});
