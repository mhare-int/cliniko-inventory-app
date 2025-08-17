// createSupplierOrderFiles.js
// Clean implementation that supports optional template rendering and PDF generation (Electron)
const fs = require('fs');
const path = require('path');

// Simple debug logger for PO generation
function poDebugLog(msg) {
  try {
    const p = path.join(__dirname, 'create_po_debug.log');
    const line = `[${new Date().toISOString()}] ${String(msg)}\n`;
    fs.appendFileSync(p, line, { encoding: 'utf8' });
  } catch (e) {
    // swallow logging errors
  }
}

async function createSupplierOrderFiles(items, outputFolder, opts = { format: 'html' }) {
  const isPreview = opts && opts.previewOnly === true;
  if (!Array.isArray(items) || (!isPreview && !outputFolder)) {
    poDebugLog(`Invalid arguments passed to createSupplierOrderFiles - itemsType:${typeof items} itemsLen:${Array.isArray(items)?items.length:'NA'} outputFolder:${outputFolder} isPreview:${isPreview}`);
    throw new Error('Invalid arguments');
  }

  poDebugLog(`createSupplierOrderFiles called with items=${items.length}, outputFolder=${outputFolder}, opts=${JSON.stringify(opts)}`);

  const groups = {};
  for (const it of items) {
    const s = it['Supplier Name'] || 'Unknown Supplier';
    if (!groups[s]) groups[s] = [];
    groups[s].push(it);
  }

  const created = [];
  const today = new Date();
  const dateStr = today.toISOString().replace(/[:.]/g, '-');

  const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'Unknown';

  for (const [supplier, orders] of Object.entries(groups)) {
    if (!orders || orders.length === 0) continue;
    // Debug: log a sample order object so we can detect field names present in incoming PR items
    try {
      poDebugLog(`Order sample for supplier ${supplier}: ${JSON.stringify(orders[0])}`);
    } catch (e) {
      poDebugLog(`Order sample logging failed for supplier ${supplier}: ${e && e.message ? e.message : e}`);
    }
    const safe = sanitize(supplier);
    const folder = !isPreview ? path.join(outputFolder, safe) : null;
    if (!isPreview) {
      try {
        fs.mkdirSync(folder, { recursive: true });
        poDebugLog(`Created folder: ${folder}`);
      } catch (e) {
        poDebugLog(`Failed to create folder ${folder}: ${e && e.message ? e.message : e}`);
        // continue - writer will likely fail below but we want to log the error
      }
    }
  const poNumber = orders[0]['PUR Number'] || orders[0]['PR Number'] || '';
  // Use PR identifier in filename when available so repeated generation for the same
  // PR and supplier overwrites the previous file instead of creating timestamped duplicates.
  const filename = `${safe}_PurchaseOrder_${poNumber ? poNumber : dateStr}.html`;
  const filePath = !isPreview ? path.join(folder, filename) : null;
    const account = orders.map(o => o['Account Number'] || o.accountNumber || o.account_number).filter(Boolean)[0] || '';

    const company = (opts && opts.company) ? opts.company : {};
    const companyName = company.name || 'Good Life Clinic';
    const companyAddress = company.address || '123 Wellness Way\nMelbourne VIC 3000';
    const companyPhone = company.phone || '';
    const companyEmail = company.email || '';
  // Company-level special instructions (fallback)
  const companySpecialInstructions = (company.special_instructions || company.specialInstructions || (opts && opts.company && opts.company.special_instructions)) || '';

    // build logo data uri
    let logoDataUri = null;
    try {
      const logo = company.logo || company.logoPath || null;
      if (logo) {
        let full = logo;
        if (!path.isAbsolute(full)) full = path.join(__dirname, 'uploads', logo);
        if (fs.existsSync(full)) {
          const buf = fs.readFileSync(full);
          const ext = path.extname(full).toLowerCase();
          let mime = 'image/png';
          if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          else if (ext === '.svg') mime = 'image/svg+xml';
          const b64 = buf.toString('base64');
          logoDataUri = `data:${mime};base64,${b64}`;
        }
      }
    } catch (e) {
      logoDataUri = null;
    }

    // rows
    let rows = '';
    let subtotal = 0;

    // Helper: find first numeric-looking field from a list of candidate keys
    const findNumber = (obj, keys) => {
      for (const k of keys) {
        if (!obj) continue;
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const raw = obj[k];
        if (raw === undefined || raw === null) continue;
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        // If string, strip currency/thousands characters and parse
        if (typeof raw === 'string') {
          const cleaned = raw.replace(/[,\s\$£€\(\)]/g, '').replace(/–/g, '-');
          const n = parseFloat(cleaned);
          if (!Number.isNaN(n) && Number.isFinite(n)) return n;
        }
      }
      return 0;
    };

    orders.forEach((o, i) => {
      const qty = findNumber(o, ['No. to Order', 'No to Order', 'NoToOrder', 'Quantity', 'quantity', 'no_to_order', 'qty']);
      const product = o['Product Name'] || o.product_name || o.name || '';
      const unit = o['Unit'] || o.unit || o.unitOfMeasure || '';

  // Try multiple possible keys for unit price so uploaded/old PRs are handled
  let price = findNumber(o, ['Unit Price', 'unit_price', 'unitPrice', 'Price', 'price', 'Cost', 'cost', 'unitprice', 'unit_cost', 'unitcost']);

  // If the importer already has a precomputed line total field, prefer that
  const precomputedLine = findNumber(o, ['line_total', 'lineTotal', 'Line Total']);

  // If price missing but precomputed line exists and qty > 0, derive unit price
  const derivedPrice = (precomputedLine > 0 && qty > 0) ? (precomputedLine / qty) : 0;
  if ((!price || price === 0) && derivedPrice) price = derivedPrice;

  const line = precomputedLine > 0 ? precomputedLine : (Number(qty) * Number(price || 0));
      subtotal += Number(line) || 0;

      // Always render numeric values with two decimals (show 0.00 when empty)
      const priceText = Number.isFinite(price) ? Number(price).toFixed(2) : '0.00';
      const lineText = Number.isFinite(line) ? Number(line).toFixed(2) : '0.00';

      rows += `<tr><td>${i + 1}</td><td>${qty}</td><td>${escapeHtml(unit)}</td><td>${escapeHtml(product)}</td><td style="text-align:right">${priceText}</td><td style="text-align:right">${lineText}</td></tr>`;
    });

    const gst = 0;
    const total = subtotal + gst;

    // Determine notes: supplier-level overrides company-level; if neither present, notesText will be empty
    const supplierLevelInstructions = (function(){
      try {
        const first = orders && orders[0] ? orders[0] : null;
        if (first) {
          const supplierLevel = first.supplier_special_instructions || first.supplierSpecialInstructions || first.special_instructions || first.specialInstructions || (first.supplier && (first.supplier.special_instructions || first.supplier.specialInstructions));
          if (supplierLevel && String(supplierLevel).trim() !== '') return String(supplierLevel);
        }
      } catch (e) {}
      return null;
    })();

    const notesText = supplierLevelInstructions || companySpecialInstructions || '';

  // Templates are ignored — use the application's hardcoded/default PO HTML layout
  // (This preserves the original hardcoded PO structure and prevents admin-supplied
  // template fragments from changing the generated output.)

    // default layout (matches the tested HTML structure)
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Order - ${escapeHtml(safe)}</title>
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
      ${account ? `<div style="margin-top:6px">Account Number: <strong>${escapeHtml(account)}</strong></div>` : ''}
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
${rows}
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
    <div>${escapeHtml(notesText)}</div>
    ${notesText ? '' : '<div style="margin-top:12px">Please deliver to the address above. This purchase order is subject to our standard terms.</div>'}
  </div>

</body>
</html>`;

    if (isPreview) {
      // Return the rendered default HTML for preview (first supplier only)
      return html;
    }

    try {
      fs.writeFileSync(filePath, html, 'utf8');
      poDebugLog(`Wrote HTML file: ${filePath}`);
    } catch (e) {
      poDebugLog(`Error writing HTML file ${filePath}: ${e && e.message ? e.message : e}`);
      // still attempt to continue to next supplier
    }

    // If PDF requested and running under Electron, attempt to generate PDF
  const entry = { supplier, file: path.relative(outputFolder, filePath), path: filePath };
    if (opts && String(opts.format).toLowerCase() === 'pdf') {
      // Check electron availability explicitly and log clear reasons why PDF may be skipped
      let electronAvailable = true;
      try {
        const maybe = require('electron');
        if (!maybe || !maybe.BrowserWindow) {
          electronAvailable = false;
          poDebugLog('Electron present but BrowserWindow missing - cannot generate PDF');
        }
      } catch (e) {
        electronAvailable = false;
        poDebugLog('Electron module not available in this process; skipping PDF generation: ' + (e && e.message ? e.message : e));
      }

      if (electronAvailable) {
        try {
          const { BrowserWindow } = require('electron');
          const win = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
          const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
          await win.loadURL(dataUrl);
          await new Promise((res) => win.webContents.once('did-finish-load', res));
          const pdfBuf = await win.webContents.printToPDF({ printBackground: true });
          const pdfName = filename.replace(/\.html?$/i, '.pdf');
          const pdfPath = path.join(folder, pdfName);
          try {
            fs.writeFileSync(pdfPath, pdfBuf);
            poDebugLog(`Wrote PDF file: ${pdfPath}`);
          } catch (e) {
            poDebugLog(`Error writing PDF file ${pdfPath}: ${e && e.message ? e.message : e}`);
          }
          try { win.close(); } catch (e) { poDebugLog(`Error closing BrowserWindow: ${e && e.message ? e.message : e}`); }
          entry.pdf = path.relative(outputFolder, pdfPath);
          entry.pdfPath = pdfPath;
        } catch (e) {
          poDebugLog(`PDF generation error for supplier ${supplier}: ${e && e.message ? e.message : e}`);
        }
      } else {
        poDebugLog(`Skipping PDF generation for supplier ${supplier} because Electron/BrowserWindow not available`);
      }
    }

    created.push(entry);
  }

  return created;
}

function renderSimpleTemplate(tpl, ctx, logoDataUri) {
  let out = String(tpl || '');
  // Insert logo placeholder (unescaped, expects data URI)
  out = out.replace(/\{\{\s*logo\s*\}\}/g, logoDataUri || '');
  // Insert raw items HTML first
  out = out.replace(/\{\{\s*items\s*\}\}/g, ctx.items || '');

  // Helper: convert snake/hyphen to camelCase (company_address -> companyAddress)
  const toCamelCase = (s) => String(s || '').split(/[_-]/).map((part, i) => i === 0 ? part : (part.charAt(0).toUpperCase() + part.slice(1))).join('');

  // Common alias mapping (template aliases -> ctx keys)
  const alias = {
    orderNumber: 'poNumber',
    order_number: 'poNumber',
    orderNum: 'poNumber',
    orderNo: 'poNumber',
    orderId: 'poNumber',
    supplierName: 'supplier',
    supplier_name: 'supplier',
    orderTable: 'items',
    order_table: 'items',
    itemsTable: 'items',
    company: 'companyName'
  };

  out = out.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (m, key) => {
    try {
      // If alias exists, map to canonical key
      if (alias[key]) {
        const mapped = alias[key];
        // items already inserted as raw, treat logo handled above
        if (mapped === 'items') return ctx.items || '';
        const valA = ctx[mapped];
        return valA !== undefined && valA !== null ? escapeHtml(String(valA)) : '';
      }

      // try camelCase version
      const camel = toCamelCase(key);
      if (ctx[camel] !== undefined && ctx[camel] !== null) return escapeHtml(String(ctx[camel]));

      // try direct key
      if (ctx[key] !== undefined && ctx[key] !== null) return escapeHtml(String(ctx[key]));

      // fallback to empty
      return '';
    } catch (e) {
      return '';
    }
  });

  return out;
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = createSupplierOrderFiles;
