// createSupplierOrderFiles.js
// Utility to create supplier order Excel files in a user-selected output folder
// Usage: createSupplierOrderFiles(items, outputFolder)
// items: array of { 'Supplier Name', ... }
// outputFolder: absolute path to base output directory

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

/**
 * Creates supplier order Excel files in subfolders under the output folder.
 * @param {Array<Object>} items - List of order items, each with 'Supplier Name' and other fields.
 * @param {string} outputFolder - Absolute path to the output directory.
 * @returns {Promise<Array<{supplier: string, file: string}>>} - List of created files (relative to outputFolder).
 */
async function createSupplierOrderFiles(items, outputFolder) {
  if (!Array.isArray(items) || !outputFolder) throw new Error('Invalid arguments');
  // Group items by supplier
  const supplierGroups = {};
  for (const item of items) {
    const supplier = item['Supplier Name'] || 'Unknown Supplier';
    if (!supplierGroups[supplier]) supplierGroups[supplier] = [];
    supplierGroups[supplier].push(item);
  }
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB').replace(/\//g, '-') + '_T' + today.toTimeString().slice(0,8).replace(/:/g, '');
  const createdFiles = [];
  for (const [supplier, orders] of Object.entries(supplierGroups)) {
    if (!orders.length) continue;
    const supplierFolder = path.join(outputFolder, supplier);
    fs.mkdirSync(supplierFolder, { recursive: true });
    const orderFilename = `${supplier}_Order_${dateStr}.xlsx`;
    const orderPath = path.join(supplierFolder, orderFilename);
    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reorders');
    // Add header row
    const columns = Object.keys(orders[0] || {});
    worksheet.columns = columns.map(col => ({ header: col, key: col }));
    // Add data rows
    orders.forEach(order => worksheet.addRow(order));
    await workbook.xlsx.writeFile(orderPath);
    createdFiles.push({ supplier, file: path.relative(outputFolder, orderPath) });
  }
  return createdFiles;
}

module.exports = createSupplierOrderFiles;
