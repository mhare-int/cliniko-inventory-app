// createSupplierOrderFiles.js
// Utility to create supplier order Excel files in a user-selected output folder
// Usage: createSupplierOrderFiles(items, outputFolder)
// items: array of { 'Supplier Name', ... }
// outputFolder: absolute path to base output directory

const fs = require('fs');
const path = require('path');
// We'll generate a simple, print-friendly HTML purchase order per supplier.
// This avoids Excel dependency for a proper-looking PO document.

/**
 * Creates supplier order Excel files in subfolders under the output folder.
 * @param {Array<Object>} items - List of order items, each with 'Supplier Name' and other fields.
 * @param {string} outputFolder - Absolute path to the output directory.
 * @returns {Promise<Array<{supplier: string, file: string}>>} - List of created files (relative to outputFolder).
 */
async function createSupplierOrderFiles(items, outputFolder, opts = { format: 'html' }) {
  if (!Array.isArray(items) || !outputFolder) throw new Error('Invalid arguments');
  // Group items by supplier
  const supplierGroups = {};
  for (const item of items) {
    const supplier = item['Supplier Name'] || 'Unknown Supplier';
    if (!supplierGroups[supplier]) supplierGroups[supplier] = [];
    supplierGroups[supplier].push(item);
  }
  const today = new Date();
  const dateStr = today.toISOString().replace(/[:.]/g, '-');
  const createdFiles = [];

  // Helper to sanitize file/folder names
  const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'Unknown';

  for (const [supplier, orders] of Object.entries(supplierGroups)) {
    if (!orders.length) continue;
    const supplierNameSafe = sanitize(supplier);
    const supplierFolder = path.join(outputFolder, supplierNameSafe);
    fs.mkdirSync(supplierFolder, { recursive: true });
    const orderFilename = `${supplierNameSafe}_PurchaseOrder_${dateStr}.html`;
    const orderPath = path.join(supplierFolder, orderFilename);

    // Allow overrides from opts.company and opts.template
    const poNumber = orders[0]['PUR Number'] || orders[0]['PR Number'] || '';
    const accountNumbers = orders.map(o => o['Account Number'] || o.accountNumber || o.account_number).filter(Boolean);
    const accountNumber = accountNumbers.length ? accountNumbers[0] : '';

    const companyFromOpts = (opts && opts.company) ? opts.company : {};
    const companyName = companyFromOpts.name || 'Good Life Clinic';
    const companyAddress = companyFromOpts.address || '123 Wellness Way, Suite 5\nMelbourne VIC 3000';
    const companyPhone = companyFromOpts.phone || '02 9000 0000';
    const companyEmail = companyFromOpts.email || 'orders@goodlifeclinic.example';

    // Logo embedding: prefer explicit logoPath, otherwise company.logo filename under backend/uploads
    let logoDataUri = null;
    try {
      const logoPathCandidate = (opts && opts.company && opts.company.logoPath) || (opts && opts.company && opts.company.logo);
      if (logoPathCandidate) {
        let logoFullPath = logoPathCandidate;
        if (!path.isAbsolute(logoFullPath)) {
          // Assume uploads folder
          logoFullPath = path.join(__dirname, 'uploads', logoPathCandidate);
        }
        if (fs.existsSync(logoFullPath)) {
          const imgBuf = fs.readFileSync(logoFullPath);
          const ext = path.extname(logoFullPath).toLowerCase();
          let mime = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          else if (ext === '.svg') mime = 'image/svg+xml';
          else if (ext === '.gif') mime = 'image/gif';
          const b64 = imgBuf.toString('base64');
          logoDataUri = `data:${mime};base64,${b64}`;
        }
      }
    } catch (e) {
      console.warn('Failed to load logo for embedding:', e && e.message ? e.message : e);
      logoDataUri = null;
    }

  const htmlHeader = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Order - ${escapeHtml(supplierNameSafe)}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color:#222 }
    .top { display:flex; justify-content:space-between; align-items:flex-start }
    .company-block { font-weight:700; font-size:18px }
    .company-meta { margin-top:6px; font-size:0.95em }
    .po-box { border:1px solid #2a7ae2; padding:12px; border-radius:6px; background:linear-gradient(180deg,#fff,#f7fbff) }
    .po-title { color:#2a7ae2; font-size:20px; font-weight:700 }
    .supplier-block { margin-top:18px; display:flex; justify-content:space-between }
    .supplier-details { border:1px solid #e6e6e6; padding:12px; width:48% }
    table.po-table { width:100%; border-collapse:collapse; margin-top:18px }
    table.po-table th, table.po-table td { border:1px solid #ddd; padding:10px; }
    table.po-table th { background:#f0f4fb; text-align:left }
    .totals { margin-top:12px; float:right; width:320px; }
    .totals table { width:100%; border-collapse:collapse }
    .totals td { padding:6px }
    .notes { clear:both; margin-top:36px; font-size:0.95em }
    @media print { .no-print { display:none } }
  </style>
</head>
<body>
  <div class="top">
    <div style="display:flex; align-items:flex-start; gap:14px">
      ${logoDataUri ? `<div style="max-width:160px; margin-right:12px"><img src="${logoDataUri}" style="max-width:160px; height:auto; object-fit:contain"/></div>` : ''}
      <div>
        <div class="company-block">${escapeHtml(companyName)}</div>
        <div class="company-meta">${escapeHtml(companyAddress).replace(/\n/g,'<br/>')}<br/>Phone: ${escapeHtml(companyPhone)}<br/>Email: ${escapeHtml(companyEmail)}</div>
      </div>
    </div>
    <div class="po-box">
      <div class="po-title">PURCHASE ORDER</div>
      <div style="margin-top:6px">PO Number: <strong>${escapeHtml(poNumber)}</strong></div>
      <div>Date: <strong>${escapeHtml(today.toLocaleDateString())}</strong></div>
    </div>
  </div>

  <div class="supplier-block">
  <div class="supplier-details">
      <div style="font-weight:700">Supplier</div>
      <div style="margin-top:6px">${escapeHtml(supplier)}</div>
  ${accountNumber ? `<div style="margin-top:6px">Account Number: <strong>${escapeHtml(accountNumber)}</strong></div>` : ''}
    </div>
    <div class="supplier-details">
      <div style="font-weight:700">Delivery / Billing</div>
      <div style="margin-top:6px">${escapeHtml(companyName)}</div>
      <div>${escapeHtml(companyAddress).replace(/\n/g,'<br/>')}</div>
    </div>
  </div>

  <table class="po-table">
    <thead>
      <tr>
        <th style="width:6%">Line</th>
        <th style="width:8%">Qty</th>
        <th style="width:12%">Unit</th>
        <th>Description</th>
        <th style="width:14%">Unit Price</th>
        <th style="width:14%">Line Total</th>
      </tr>
    </thead>
    <tbody>
`;

    let rowHtml = '';
    let subtotal = 0;
    orders.forEach((order, idx) => {
      const qty = Number(order['No. to Order'] ?? order['No. To Order'] ?? order['Quantity'] ?? order.no_to_order ?? order.quantity ?? 0) || 0;
      const product = order['Product Name'] || order.product_name || order.name || '';
      const unit = order['Unit'] || order.unit || '';
      const price = Number(order['Unit Price'] || order.unit_price || 0) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      rowHtml += `<tr>
        <td>${idx + 1}</td>
        <td>${qty}</td>
        <td>${escapeHtml(unit)}</td>
        <td>${escapeHtml(product)}</td>
        <td style="text-align:right">${price ? price.toFixed(2) : ''}</td>
        <td style="text-align:right">${lineTotal ? lineTotal.toFixed(2) : ''}</td>
      </tr>`;
    });

    const gst = 0; // placeholder
    const total = subtotal + gst;

    const htmlFooter = `
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal:</td><td style="text-align:right">${subtotal ? subtotal.toFixed(2) : '0.00'}</td></tr>
      <tr><td>GST:</td><td style="text-align:right">${gst.toFixed(2)}</td></tr>
      <tr><td style="font-weight:700">Total:</td><td style="text-align:right;font-weight:700">${total ? total.toFixed(2) : '0.00'}</td></tr>
    </table>
  </div>

  <div class="notes">
    <strong>Special Instructions / Notes:</strong>
    <div>${escapeHtml((orders[0] && (orders[0].special_instructions || orders[0].specialInstructions)) || '')}</div>
    <div style="margin-top:12px">Please deliver to the address above. This purchase order is subject to our standard terms.</div>
  </div>

</body>
</html>`;

    const content = htmlHeader + rowHtml + htmlFooter;

    // Remove any previous PO files for this supplier to avoid accumulating old files
    try {
      const existing = fs.readdirSync(supplierFolder).filter(f => {
        const lower = f.toLowerCase();
        return lower.startsWith(`${supplierNameSafe.toLowerCase()}_purchaseorder_`) && (lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.pdf'));
      });
      existing.forEach(f => {
        try {
          fs.unlinkSync(path.join(supplierFolder, f));
          console.log(`Removed old PO file for ${supplier}: ${f}`);
        } catch (e) {
          console.warn(`Failed to remove old PO file ${f} for ${supplier}:`, e && e.message ? e.message : e);
        }
      });
    } catch (e) {
      // If reading dir fails, log and continue; do not block generation
      console.warn('Could not clean old PO files for', supplier, e && e.message ? e.message : e);
    }

    fs.writeFileSync(orderPath, content, { encoding: 'utf8' });

    const relative = path.relative(outputFolder, orderPath);
    const entry = { supplier, file: relative, path: orderPath };

    // If PDF requested and running inside Electron main process, generate PDF using a headless BrowserWindow
    if (opts && String(opts.format).toLowerCase() === 'pdf') {
      try {
        // Try to require electron - will throw if not running in Electron
        const { BrowserWindow } = require('electron');
        // Create an offscreen / hidden window to render the HTML
        const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
        // Load the HTML via data URL to avoid writing extra files
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(content);
        await win.loadURL(dataUrl);
        // Wait for finish
        await new Promise((res) => win.webContents.once('did-finish-load', res));
        // Print to PDF
        const pdfBuffer = await win.webContents.printToPDF({ printBackground: true });
        const pdfFilename = orderFilename.replace(/\.html?$/i, '.pdf');
        const pdfPath = path.join(supplierFolder, pdfFilename);
        fs.writeFileSync(pdfPath, pdfBuffer);
        // Close the window
        try { win.close(); } catch (e) { /* ignore */ }
        // Add PDF info to entry
        entry.pdf = path.relative(outputFolder, pdfPath);
        entry.pdfPath = pdfPath;
      } catch (e) {
        // Not running in Electron or PDF generation failed - keep HTML only
        console.warn('PDF generation unavailable or failed for', supplier, e && e.message ? e.message : e);
      }
    }

    createdFiles.push(entry);
  }
  return createdFiles;

  // helper: escape HTML
  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

module.exports = createSupplierOrderFiles;
