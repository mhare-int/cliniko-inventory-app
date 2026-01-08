const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  changeUserPassword: (userId, newPassword) => ipcRenderer.invoke('changeUserPassword', userId, newPassword),
  getSessionTimeout: () => ipcRenderer.invoke('getSessionTimeout'),
  setSessionTimeout: (hours) => ipcRenderer.invoke('setSessionTimeout', hours),
  getAllProducts: () => ipcRenderer.invoke('getAllProducts'),
  getAllProductsWithWrapper: () => ipcRenderer.invoke('getAllProductsWithWrapper'),
  getProductCount: () => ipcRenderer.invoke('getProductCount'),
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
  // Product audit timeline for a product (by cliniko_id or product name)
  getProductAudit: (productId, opts) => ipcRenderer.invoke('getProductAudit', productId, opts),
  downloadFile: (filename) => ipcRenderer.invoke('downloadFile', filename),
  getProductSales: (start_date, end_date) => ipcRenderer.invoke('getProductSales', start_date, end_date),
  getSalesInsights: (limit, offset) => ipcRenderer.invoke('getSalesInsights', limit, offset),
  getSalesInsightsWithCustomRanges: (customRanges, limit, offset) => ipcRenderer.invoke('getSalesInsightsWithCustomRanges', customRanges, limit, offset),
  logout: () => ipcRenderer.invoke('logout'),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),
  setApiKey: (newKey) => ipcRenderer.invoke('setApiKey', newKey),
  testApiKey: (apiKey) => ipcRenderer.invoke('testApiKey', apiKey),
  updatePurchaseRequestReceived: (pr_id, lines, receivedBy = null, comment = '') => ipcRenderer.invoke('updatePurchaseRequestReceived', pr_id, lines, receivedBy, comment),
  updatePurchaseRequestWithComment: (pr_id, updates, changedBy, comment) => ipcRenderer.invoke('updatePurchaseRequestWithComment', pr_id, updates, changedBy, comment),
  updatePurchaseRequestItemsWithComment: (pr_id, lines, changedBy, comment) => ipcRenderer.invoke('updatePurchaseRequestItemsWithComment', pr_id, lines, changedBy, comment),
  updatePurchaseRequestItemsEditWithComment: (pr_id, edits, changedBy, comment) => ipcRenderer.invoke('updatePurchaseRequestItemsEditWithComment', pr_id, edits, changedBy, comment),
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
  // Expose createSupplierOrderFilesForVendors to frontend (accepts optional client options as 3rd arg)
  createSupplierOrderFilesForVendors: (items, outputFolder, clientOpts) => ipcRenderer.invoke('createSupplierOrderFilesForVendors', items, outputFolder, clientOpts),
  // Render PO preview using backend renderer (returns { success, html } )
  renderPoPreview: (items, opts) => ipcRenderer.invoke('renderPoPreview', items, opts),
  // Send supplier emails using system default email client
  sendSupplierEmails: (emailData, outputFolder) => ipcRenderer.invoke('sendSupplierEmails', emailData, outputFolder),
  // Get active PURs for a barcode
  getActivePURsForBarcode: (barcode) => ipcRenderer.invoke('getActivePURsForBarcode', barcode),
  
  // File management APIs for supplier files
  getGeneratedFiles: (prId, fileType) => ipcRenderer.invoke('getGeneratedFiles', prId, fileType),
  getPoChangeLog: (prId, limit) => ipcRenderer.invoke('getPoChangeLog', prId, limit),
  deleteGeneratedFile: (prId, vendorName, fileType, filename) => ipcRenderer.invoke('deleteGeneratedFile', prId, vendorName, fileType, filename),
  markVendorFilesCreated: (prId, vendorName, fileType, filename, filePath, fileSize) => ipcRenderer.invoke('markVendorFilesCreated', prId, vendorName, fileType, filename, filePath, fileSize),
  hasVendorFilesCreated: (prId, vendorName, fileType) => ipcRenderer.invoke('hasVendorFilesCreated', prId, vendorName, fileType),
  updatePurchaseRequestSupplierFilesStatus: (prId, hasFiles) => ipcRenderer.invoke('updatePurchaseRequestSupplierFilesStatus', prId, hasFiles),
  updatePurchaseRequestOftFilesStatus: (prId, hasFiles) => ipcRenderer.invoke('updatePurchaseRequestOftFilesStatus', prId, hasFiles),
  fileExists: (filePath) => ipcRenderer.invoke('fileExists', filePath),
  deleteFileFromDisk: (filePath) => ipcRenderer.invoke('deleteFileFromDisk', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('getFileStats', filePath),
  downloadGeneratedFile: (filename, filePath) => ipcRenderer.invoke('downloadGeneratedFile', filename, filePath),
  
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
  addSupplier: (name, email, contactName, comments, accountNumber = '') => ipcRenderer.invoke('addSupplier', name, email, contactName, comments, accountNumber),
  updateSupplier: (id, name, email, contactName, comments, accountNumber = '') => ipcRenderer.invoke('updateSupplier', id, name, email, contactName, comments, accountNumber),
  deleteSupplier: (id) => ipcRenderer.invoke('deleteSupplier', id),
  getSupplierByName: (name) => ipcRenderer.invoke('getSupplierByName', name),
  getInactiveSuppliers: () => ipcRenderer.invoke('getInactiveSuppliers'),
  reactivateSupplier: (supplierId) => ipcRenderer.invoke('reactivateSupplier', supplierId),
  deactivateSupplier: (supplierId) => ipcRenderer.invoke('deactivateSupplier', supplierId),
  // Product activation/deactivation functions  
  activateProduct: (clinikoId) => ipcRenderer.invoke('activateProduct', clinikoId),
  deactivateProduct: (clinikoId) => ipcRenderer.invoke('deactivateProduct', clinikoId),
  // Demand and supplier lead-time helpers
  getAverageDailyDemand: (productId, days = 90) => ipcRenderer.invoke('getAverageDailyDemand', productId, days),
  getSupplierLeadTime: (supplierName) => ipcRenderer.invoke('getSupplierLeadTime', supplierName),
  setSupplierLeadTime: (supplierName, days) => ipcRenderer.invoke('setSupplierLeadTime', supplierName, days),
  getSuppliersWithLeadTime: () => ipcRenderer.invoke('getSuppliersWithLeadTime'),
  getReorderSuggestion: (productId, opts = {}) => ipcRenderer.invoke('getReorderSuggestion', productId, opts),
  getVendorConsolidation: (windowDays = 14, opts = {}) => ipcRenderer.invoke('getVendorConsolidation', windowDays, opts),
  // Discounts
  addSupplierProductDiscount: (discount) => ipcRenderer.invoke('addSupplierProductDiscount', discount),
  updateSupplierProductDiscount: (id, updates) => ipcRenderer.invoke('updateSupplierProductDiscount', id, updates),
  deleteSupplierProductDiscount: (id) => ipcRenderer.invoke('deleteSupplierProductDiscount', id),
  listSupplierProductDiscounts: (filter) => ipcRenderer.invoke('listSupplierProductDiscounts', filter),
  findApplicableDiscount: (query) => ipcRenderer.invoke('findApplicableDiscount', query),
  
  // Email template management APIs
  saveEmailTemplate: (templateData) => ipcRenderer.invoke('saveEmailTemplate', templateData),
  getEmailTemplate: () => ipcRenderer.invoke('getEmailTemplate'),
  // PO template management APIs (separate)
  savePoTemplate: (templateData) => ipcRenderer.invoke('savePoTemplate', templateData),
  getPoTemplate: (name) => ipcRenderer.invoke('getPoTemplate', name),
  // App settings and uploads
  getAppSetting: (key) => ipcRenderer.invoke('getAppSetting', key),
  setAppSetting: (key, value) => ipcRenderer.invoke('setAppSetting', key, value),
  uploadFile: (fileObj) => ipcRenderer.invoke('uploadFile', fileObj),
  listUploads: () => ipcRenderer.invoke('listUploads'),
  
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
  ,
  // Open a file on disk (uses main process to call shell.openPath)
  openOftFile: (filePath) => ipcRenderer.invoke('openOftFile', filePath)
  ,
  // Update emails_sent flag on a purchase request
  updatePurchaseRequestEmailsSentStatus: (prId, sent) => ipcRenderer.invoke('updatePurchaseRequestEmailsSentStatus', prId, sent),
  // More robust update which tries trimmed / LIKE matches
  updatePurchaseRequestEmailsSentStatusForce: (prId, sent) => ipcRenderer.invoke('updatePurchaseRequestEmailsSentStatusForce', prId, sent)
  // Add more functions here as you expose them in main.js
});
