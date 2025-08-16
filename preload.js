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
  updateReorderLevelsFromFile: (fileData) => ipcRenderer.invoke('updateReorderLevelsFromFile', fileData),
  generateReorderLevelsTemplate: () => ipcRenderer.invoke('generateReorderLevelsTemplate'),
  updateProductReorderLevel: (product_id, new_level) => ipcRenderer.invoke('updateProductReorderLevel', product_id, new_level),
  updateProductBarcode: (product_id, new_barcode) => ipcRenderer.invoke('updateProductBarcode', product_id, new_barcode),
  createPurchaseRequest: (data) => ipcRenderer.invoke('createPurchaseRequest', data),
  getPurchaseRequests: (active_only, group_by) => ipcRenderer.invoke('getPurchaseRequests', active_only, group_by),
  getPurchaseRequestById: (pr_id) => ipcRenderer.invoke('getPurchaseRequestById', pr_id),
  setPurchaseRequestReceived: (pr_id, updates) => ipcRenderer.invoke('setPurchaseRequestReceived', pr_id, updates),
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
  updatePurchaseRequestSupplierFilesStatus: (pr_id, created) => ipcRenderer.invoke('updatePurchaseRequestSupplierFilesStatus', pr_id, created),
  updatePurchaseRequestOftFilesStatus: (pr_id, created) => ipcRenderer.invoke('updatePurchaseRequestOftFilesStatus', pr_id, created),
  hasVendorOftFilesCreated: (pr_id, vendorName) => ipcRenderer.invoke('hasVendorOftFilesCreated', pr_id, vendorName),
  markVendorOftFilesCreated: (pr_id, vendorName, filename, filePath) => ipcRenderer.invoke('markVendorOftFilesCreated', pr_id, vendorName, filename, filePath),
  getVendorsWithOftFiles: (pr_id) => ipcRenderer.invoke('getVendorsWithOftFiles', pr_id),
  fileExists: (filePath) => ipcRenderer.invoke('fileExists', filePath),
  listFiles: (dirPath, pattern) => ipcRenderer.invoke('listFiles', dirPath, pattern),
  hasVendorFilesCreated: (pr_id, vendorName, fileType) => ipcRenderer.invoke('hasVendorFilesCreated', pr_id, vendorName, fileType),
  markVendorFilesCreated: (pr_id, vendorName, fileType, filename, filePath, fileSize) => ipcRenderer.invoke('markVendorFilesCreated', pr_id, vendorName, fileType, filename, filePath, fileSize),
  getGeneratedFiles: (pr_id, fileType) => ipcRenderer.invoke('getGeneratedFiles', pr_id, fileType),
  getFileStats: (filePath) => ipcRenderer.invoke('getFileStats', filePath),
  deleteGeneratedFile: (prId, vendorName, fileType, filename) => ipcRenderer.invoke('deleteGeneratedFile', prId, vendorName, fileType, filename),
  deleteFileFromDisk: (filePath) => ipcRenderer.invoke('deleteFileFromDisk', filePath),
  openOftFile: (filePath) => ipcRenderer.invoke('openOftFile', filePath),
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
  // Send supplier emails using system default email client
  sendSupplierEmails: (emailData, outputFolder) => ipcRenderer.invoke('sendSupplierEmails', emailData, outputFolder),
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
  
  // Supplier management APIs
  getAllSuppliers: () => ipcRenderer.invoke('getAllSuppliers'),
  addSupplier: (name, email, contactName, comments, accountNumber) => ipcRenderer.invoke('addSupplier', name, email, contactName, comments, accountNumber),
  updateSupplier: (id, name, email, contactName, comments, accountNumber) => ipcRenderer.invoke('updateSupplier', id, name, email, contactName, comments, accountNumber),
  deleteSupplier: (id) => ipcRenderer.invoke('deleteSupplier', id),
  deactivateSupplier: (id) => ipcRenderer.invoke('deactivateSupplier', id),
  getSupplierByName: (name) => ipcRenderer.invoke('getSupplierByName', name),
  
  // Supplier status management APIs
  getInactiveSuppliers: () => ipcRenderer.invoke('getInactiveSuppliers'),
  getSupplierUsageSummary: () => ipcRenderer.invoke('getSupplierUsageSummary'),
  deleteInactiveSuppliers: (forceDelete) => ipcRenderer.invoke('deleteInactiveSuppliers', forceDelete),
  reactivateSupplier: (supplierId) => ipcRenderer.invoke('reactivateSupplier', supplierId),
  
  // Email template management APIs
  saveEmailTemplate: (templateData) => ipcRenderer.invoke('saveEmailTemplate', templateData),
  getEmailTemplate: () => ipcRenderer.invoke('getEmailTemplate'),
  
  // Email file handling
  openEmlFile: (filePath) => ipcRenderer.invoke('openEmlFile', filePath),
  
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
