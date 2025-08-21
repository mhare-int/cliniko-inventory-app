import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";



function PurchaseRequests() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState([]);
  const [vendorData, setVendorData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState([]); // For PR tab
  const [expandedVendor, setExpandedVendor] = useState([]); // For Vendor tab
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedLines, setSelectedLines] = useState({}); // { prId: [bool, bool, ...] }
  const [editing, setEditing] = useState({}); // For PR tab
  const [selectedVendorLines, setSelectedVendorLines] = useState({}); // { vendor: [bool,...] }
  const [vendorEditing, setVendorEditing] = useState({}); // For Vendor tab
  const [savingId, setSavingId] = useState(null);
  const [savingVendor, setSavingVendor] = useState(null);
  const [tab, setTab] = useState("pr"); // "pr" or "vendor"

  // Typeahead state
  const [prSearch, setPrSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [prSuggestions, setPrSuggestions] = useState([]);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [suppliersMap, setSuppliersMap] = useState({});

  const fmtCurrency = (n) => {
    if (n === null || typeof n === 'undefined' || n === '') return '—';
    const num = Number(n) || 0;
    return `$${num.toFixed(2)}`;
  };

  // Compute PR-level total when backend doesn't supply `total_cost`.
  // Prefer explicit pr.total_cost/pr.totalCost, otherwise sum item.line_total or
  // fall back to (unit_cost * No. to Order) per item.
  const computePrTotal = (pr) => {
    if (!pr) return '';
    const explicit = pr.total_cost ?? pr.totalCost;
    if (typeof explicit !== 'undefined' && explicit !== null) return explicit;
    if (!Array.isArray(pr.items)) return '';
    const total = pr.items.reduce((acc, item) => {
      const line = Number(item.line_total ?? item.lineTotal ?? NaN);
      if (!Number.isNaN(line)) return acc + line;
      const unit = Number(item.unit_cost ?? item.unitCost ?? item.unit_price ?? item.unitPrice ?? 0) || 0;
      const qty = Number(item["No. to Order"] ?? item.no_to_order ?? item.quantity ?? 0) || 0;
      return acc + unit * qty;
    }, 0);
    return total;
  };

  // Compute total for an array of items (used in Vendor view header)
  const computeItemsTotal = (items) => {
    if (!Array.isArray(items)) return '';
    const total = items.reduce((acc, item) => {
      const line = Number(item.line_total ?? item.lineTotal ?? NaN);
      if (!Number.isNaN(line)) return acc + line;
      const unit = Number(item.unit_cost ?? item.unitCost ?? item.unit_price ?? item.unitPrice ?? 0) || 0;
      const qty = Number(item["No. to Order"] ?? item.no_to_order ?? item.quantity ?? 0) || 0;
      return acc + unit * qty;
    }, 0);
    return total;
  };

  const getSupplierName = (item) => {
    if (!item) return "-";
    const nameFromItem = item["Supplier Name"] || item.supplier_name || item.vendor_name || null;
    if (nameFromItem) return nameFromItem;
    const supplierId = item["Supplier Id"] || item.supplier_id || item.supplierId || item.supplier || null;
    if (supplierId && suppliersMap[supplierId]) return suppliersMap[supplierId];
    return "-";
  };

  // Modal-based reason prompt (replaces window.prompt which is not supported in Electron renderer)
  const [reasonModalState, setReasonModalState] = useState({ visible: false, title: '', defaultText: '' });
  const reasonResolveRef = useRef(null);
  const [reasonText, setReasonText] = useState('');

  // Helper: resolve a short identifier for the current user to store in change logs
  const resolveCurrentUserIdentifier = async () => {
    try {
      if (window.api && window.api.getCurrentUser) {
        const token = localStorage.getItem('token');
        const u = await window.api.getCurrentUser(token);
        if (u) {
          // Prefer a username or display name; avoid falling back to numeric id-only values.
          // Typical user object fields: { id, username, display_name, name, email }
          return (u.username || u.display_name || u.name || u.email || null);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  // History modal state for viewing po_change_log entries
  const [historyModalState, setHistoryModalState] = useState({ visible: false, prId: null, entries: [] });
  const [editModalState, setEditModalState] = useState({ visible: false, prId: null, items: [] });
  const [savingEdit, setSavingEdit] = useState(false);

  const requestReason = (title, defaultText = '') => {
    return new Promise((resolve, reject) => {
      reasonResolveRef.current = { resolve, reject };
  setReasonModalState({ visible: true, title, defaultText });
  setReasonText(defaultText || '');
    });
  };

  const submitReasonModal = (value) => {
    setReasonModalState({ visible: false, title: '', defaultText: '' });
    if (reasonResolveRef.current) {
      reasonResolveRef.current.resolve(value);
      reasonResolveRef.current = null;
    }
  };

  const cancelReasonModal = () => {
    setReasonModalState({ visible: false, title: '', defaultText: '' });
    if (reasonResolveRef.current) {
      reasonResolveRef.current.reject(new Error('Cancelled'));
      reasonResolveRef.current = null;
    }
  };

  // Open history modal and load entries from backend
  const openHistoryModal = async (prId) => {
    setHistoryModalState({ visible: true, prId, entries: [] });
    try {
      if (!window.api) {
        setHistoryModalState({ visible: true, prId, entries: [] });
        return;
      }

      // Load change log rows (audited DB entries)
      let rows = [];
      if (window.api.getPoChangeLog) {
        try {
          rows = await window.api.getPoChangeLog(prId, 200);
        } catch (e) {
          console.warn('getPoChangeLog failed for', prId, e);
          rows = [];
        }
      }

      // Also load any generated files for this PR (PO HTML, .oft, etc.) and synthesize history entries
      let fileEntries = [];
      if (window.api.getGeneratedFiles) {
        try {
          const files = await window.api.getGeneratedFiles(prId);
          if (Array.isArray(files)) {
            fileEntries = files.map((f, idx) => {
              const tsRaw = f.created || f.created_at || f.mtime || f.ts || f.timestamp || f.time || null;
              const timestamp = tsRaw ? (new Date(tsRaw).toISOString()) : new Date().toISOString();
              const name = f.file || f.filename || f.name || f.file_name || (`file-${idx}`);
              const ftype = (String(f.file_type || f.type || '').toLowerCase());
              const prettyType = ftype.includes('oft') ? '.oft' : (ftype.includes('html') ? 'PO (html)' : (ftype || 'file'));
              const comment = `Generated ${prettyType} file: ${name}`;
              return { id: `genfile-${idx}-${name}`, timestamp, changed_by: null, comment, before_json: null, after_json: null };
            });
          }
        } catch (e) {
          console.warn('getGeneratedFiles failed for', prId, e);
          fileEntries = [];
        }
      }

      // Merge and sort newest-first by timestamp
      const merged = ([...(Array.isArray(rows) ? rows : []), ...fileEntries]).sort((a, b) => {
        const ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });

      setHistoryModalState({ visible: true, prId, entries: merged });
    } catch (e) {
      console.error('Failed to load PO change log:', e);
      setHistoryModalState({ visible: true, prId, entries: [] });
    }
  };

  const toggleHistoryRaw = (id) => {
  // raw view removed
  };

  const closeHistoryModal = () => setHistoryModalState({ visible: false, prId: null, entries: [] });

  const openEditModal = async (pr) => {
    // load items from pr into modal state with editable fields
    const items = (pr.items || []).map(i => ({ id: i.id, productName: i['Product Name'] || i.product_name || i.name, no_to_order: i['No. to Order'] ?? i.no_to_order ?? i.quantity ?? 0, unit_cost: Number(i.unit_cost ?? i.unitCost ?? i.UnitCost ?? 0) || 0, delete: false }));
    setEditModalState({ visible: true, prId: pr.id, items });
  };

  const closeEditModal = () => setEditModalState({ visible: false, prId: null, items: [] });

  const handleEditItemChange = (idx, field, value) => {
    setEditModalState(s => {
      const copy = { ...s, items: [...s.items] };
      copy.items[idx] = { ...copy.items[idx], [field]: value };
      return copy;
    });
  };

  const saveEditModal = async () => {
  const prId = editModalState.prId;
  if (!prId) return;
  console.log('saveEditModal invoked for prId=', prId);
  setSavingEdit(true);
    // Build edits array for backend
    const edits = editModalState.items.map(it => ({ id: it.id, productName: it.productName, no_to_order: Number(it.no_to_order || 0), unit_cost: Number(it.unit_cost || 0), delete: !!it.delete }));

    // Request reason
    let reason;
    try {
      reason = await requestReason(`Enter reason for editing PO ${prId} (required):`, 'Edit PO');
    } catch (e) {
      alert('A short reason is required to edit the purchase order. Edit cancelled.');
      return;
    }
    if (!reason || String(reason).trim().length < 3) {
      alert('A short reason is required to edit the purchase order. Edit cancelled.');
      return;
    }

    try {
      console.log('Calling backend API to save edits, edits:', edits);
      if (window.api && window.api.updatePurchaseRequestItemsEditWithComment) {
        const changedBy = await resolveCurrentUserIdentifier();
        const res = await window.api.updatePurchaseRequestItemsEditWithComment(prId, edits, changedBy, reason);
        console.log('updatePurchaseRequestItemsEditWithComment response:', res);
        if (res && res.error) {
          alert('Failed to save edits: ' + (res.error || 'unknown'));
        } else {
          alert('PO edits saved.');
          closeEditModal();
          fetchData('pr');
        }
      } else if (window.api && window.api.updatePurchaseRequestItemsWithComment) {
        // Fallback: try the receive API if edit API not available
        console.warn('updatePurchaseRequestItemsEditWithComment not available, using fallback updatePurchaseRequestItemsWithComment');
        const changedBy = await resolveCurrentUserIdentifier();
        const res = await window.api.updatePurchaseRequestItemsWithComment(prId, edits.map(e => ({ productName: e.productName, newlyReceived: 0 })), changedBy, reason);
        console.log('Fallback updatePurchaseRequestItemsWithComment response:', res);
        if (res && res.error) {
          alert('Failed to save edits (fallback): ' + (res.error || 'unknown'));
        } else {
          alert('PO edits saved (fallback).');
          closeEditModal();
          fetchData('pr');
        }
      } else {
        console.error('API not available on window.api for edits');
        alert('Unable to save edits: API not available (window.api.updatePurchaseRequestItemsEditWithComment missing)');
      }
    } catch (err) {
      console.error('Failed to save PO edits:', err);
      alert('Failed to save edits: ' + (err && err.message ? err.message : JSON.stringify(err)));
    }
    finally {
      setSavingEdit(false);
    }
  };

  // Load data when tab changes or on mount
  useEffect(() => {
    fetchData(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Listen for cross-component updates to purchase requests (e.g. emails_sent toggled elsewhere)
  useEffect(() => {
    const handler = async (e) => {
      try {
        // Simple re-fetch of PR data when notified
        await fetchData('pr');
      } catch (err) {
        console.warn('Failed to refresh PRs after external change', err);
      }
    };
    window.addEventListener('purchaseRequestsChanged', handler);
    return () => window.removeEventListener('purchaseRequestsChanged', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load suppliers map once on mount so we can resolve supplier_id -> name
  useEffect(() => {
    if (window.api && window.api.getAllSuppliers) {
      window.api.getAllSuppliers()
        .then(suppliers => {
          const map = {};
          (suppliers || []).forEach(s => {
            const id = s.id ?? s.cliniko_id ?? s.supplier_id;
            if (id != null) map[id] = s.name || s.supplier_name || s.display_name || s.label || "";
          });
          setSuppliersMap(map);
        })
        .catch(() => setSuppliersMap({}));
    }
  }, []);

  const fetchData = async (tabType) => {
    setLoading(true);
    if (!window.api || !window.api.getPurchaseRequests) {
      setLoading(false);
      return;
    }
    if (tabType === "pr") {
      const res = await window.api.getPurchaseRequests(true, undefined);
      // Apply any local overrides saved by other components (optimistic UI)
      try {
        const raw = localStorage.getItem('prEmailsSentOverrides');
        if (raw) {
          const overrides = JSON.parse(raw);
          if (Array.isArray(res)) {
            res.forEach(pr => {
              if (overrides && typeof overrides[pr.id] !== 'undefined') {
                pr.emails_sent = overrides[pr.id] ? 1 : 0;
              }
            });
          }
        }
      } catch (e) { /* ignore */ }
      // Ensure supplier_files_created and oft_files_created reflect actual generated files
      try {
        if (window.api && window.api.getGeneratedFiles) {
          const augmented = await Promise.all(res.map(async pr => {
            try {
              const files = await window.api.getGeneratedFiles(pr.id);
              // Detect POs stored as HTML on the backend (file_type === 'html') or plain .html files.
              const hasPo = Array.isArray(files) && files.some(f => (
                f.file_type === 'html' ||
                (f.type === 'file' && !(f.isOutlookTemplate)) ||
                (f.file && /\.html?$/i.test(f.file))
              ));
              const hasOft = Array.isArray(files) && files.some(f => (f.file_type === 'oft' || (f.type === 'email' && f.isOutlookTemplate) || (f.file && f.file.toLowerCase().endsWith('.oft'))));
              // Only set the flags true if files actually exist. If the API returned no files, ensure flags are false to avoid stale UI.
              return { ...pr, supplier_files_created: !!hasPo, oft_files_created: !!hasOft };
            } catch (err) {
              return pr;
            }
          }));
          setPrs(augmented);
        } else {
          setPrs(res);
        }
      } catch (e) {
        setPrs(res);
      }
      // Set editing state for all PRs and all lines, default to outstanding value
      const obj = {};
      res.forEach(pr => {
        obj[pr.id] = pr.items.map(i =>
          typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0))
        );
      });
      setEditing(obj);
      // Initialize per-line selection for PRs (default: select lines with outstanding > 0)
      const sel = {};
      res.forEach(pr => {
        sel[pr.id] = pr.items.map(i => {
          const outstanding = typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0));
          return Number(outstanding) > 0;
        });
      });
      setSelectedLines(sel);
    } else {
      const res = await window.api.getPurchaseRequests(true, "vendor");
      // Support two backend shapes:
      // - An object mapping vendor -> items (newer behavior)
      // - An array of PRs with items (older behavior)
      const filteredVendorData = {};

      if (res && typeof res === 'object' && !Array.isArray(res)) {
        // Already grouped by vendor
        Object.entries(res).forEach(([vendor, items]) => {
          if (!Array.isArray(items)) return;
          const outstandingItems = items.filter(item => {
            const ordered = Number(item["No. to Order"] ?? item.no_to_order ?? 0);
            const received = Number(item["received_so_far"] ?? item.received_so_far ?? 0);
            return received < ordered;
          });
          if (outstandingItems.length > 0) filteredVendorData[vendor] = outstandingItems;
        });
      } else if (Array.isArray(res)) {
        // Older shape: array of PRs
        (res || []).forEach(pr => {
          const items = pr.items || [];
          items.forEach(item => {
            const ordered = Number(item["No. to Order"] ?? item.no_to_order ?? 0);
            const received = Number(item["received_so_far"] ?? item.received_so_far ?? 0);
            if (received < ordered) {
              const vendor = item["Supplier Name"] || item.supplier_name || item.vendor_name || pr.supplier_name || pr.vendor_name || 'Unknown';
              if (!filteredVendorData[vendor]) filteredVendorData[vendor] = [];
              // Attach PR id and date for context if available
              filteredVendorData[vendor].push({ ...item, pr_id: pr.id ?? pr.pr_id, date_created: pr.date_created });
            }
          });
        });
      }

      setVendorData(filteredVendorData);

      // Set editing state for all vendors and all lines, default to outstanding value
      const obj = {};
      Object.entries(filteredVendorData).forEach(([vendor, items]) => {
        obj[vendor] = items.map(i =>
          typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0))
        );
      });
      setVendorEditing(obj);

      // Initialize per-line selection for vendors (default: select lines with outstanding > 0)
      const vsel = {};
      Object.entries(filteredVendorData).forEach(([vendor, items]) => {
        vsel[vendor] = items.map(i => {
          const outstanding = typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0));
          return Number(outstanding) > 0;
        });
      });
      setSelectedVendorLines(vsel);
    }
    setLoading(false);
  };

  // Vendor tab expand/collapse
  const handleVendorExpand = (vendor) => {
    setExpandedVendor(exp =>
      exp.includes(vendor) ? exp.filter(v => v !== vendor) : [...exp, vendor]
    );
  };

  // Vendor tab line change
  const handleVendorLineChange = (vendor, idx, value) => {
    let v = Math.max(0, Number(value) || 0);
    setVendorEditing((editing) => {
      const arr = [...editing[vendor]];
      arr[idx] = v;
      return { ...editing, [vendor]: arr };
    });
  };

  // Vendor tab: get editable array for each vendor
  const getVendorReceivedArr = (vendor, items) => (
    vendorEditing[vendor] && vendorEditing[vendor].length === items.length
      ? vendorEditing[vendor]
      : items.map(i =>
          typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0))
        )
  );

  // Vendor tab: Save receipt for all items in a vendor group
  const saveVendorReceived = async (vendor, items) => {
    console.log('saveVendorReceived called for vendor:', vendor);
    setSavingVendor(vendor);
    
    try {
      const receivedArr = getVendorReceivedArr(vendor, items);
      console.log('vendor receivedArr:', receivedArr);
      
      // Group by PR id
      const prGroups = {};
      const stockUpdateResults = [];
      
      const perVendorSel = selectedVendorLines[vendor] || [];
      const anySelected = perVendorSel.some(Boolean);
      items.forEach((item, idx) => {
        if (!prGroups[item.pr_id]) prGroups[item.pr_id] = [];
        const receivedQty = Number(receivedArr[idx]);
        const include = anySelected ? Boolean(perVendorSel[idx]) : true;
        const productName = item["Product Name"] ?? item.name;
        
        if (include) {
          prGroups[item.pr_id].push({
          productName: productName,
          ordered: item["No. to Order"] ?? item.no_to_order ?? 0,
          receivedSoFar: item["received_so_far"] ?? item.received_so_far ?? 0,
          outstanding: typeof item["outstanding"] !== "undefined"
            ? item["outstanding"]
            : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0)),
          newlyReceived: receivedQty,
          });
        }
        
        // Prepare Cliniko stock update for items with received quantities
  if (include && receivedQty > 0 && productName) {
          stockUpdateResults.push({
            product: productName,
            quantity: receivedQty,
            prId: item.pr_id,
            toUpdate: true
          });
        }
      });
      
      console.log('prGroups:', prGroups);
      console.log('stockUpdateResults:', stockUpdateResults);
      
      // For each PR, send receipt update
      if (!window.api || !window.api.updatePurchaseRequestReceived) {
        console.error('updatePurchaseRequestReceived API not available');
        alert('Error: updatePurchaseRequestReceived API not available');
        setSavingVendor(null);
        return;
      }
      
      for (const prId of Object.keys(prGroups)) {
        console.log('Updating PR:', prId, 'with:', prGroups[prId]);
        // Ask for reason once per PR (modal)
        let reasonForPr;
        try {
          reasonForPr = await requestReason(`Enter reason for receiving items for PR ${prId} (required):`, 'Receiving vendor items');
        } catch (e) {
          alert('A short reason is required to update the purchase order. Update cancelled for this PR.');
          continue;
        }
        if (!reasonForPr || String(reasonForPr).trim().length < 3) {
          alert('A short reason is required to update the purchase order. Update cancelled for this PR.');
          continue;
        }
        try {
          const changedBy = await resolveCurrentUserIdentifier();
          await window.api.updatePurchaseRequestItemsWithComment(prId, prGroups[prId].map(l => ({ productName: l.productName, newlyReceived: l.newlyReceived })), changedBy, reasonForPr);
        } catch (e) {
          console.warn('updatePurchaseRequestItemsWithComment failed, falling back to legacy:', e);
          try {
            const changedBy = await resolveCurrentUserIdentifier();
            await window.api.updatePurchaseRequestReceived(prId, prGroups[prId], changedBy, reasonForPr);
          } catch (e2) {
            console.warn('Failed to include changedBy in fallback updatePurchaseRequestReceived:', e2);
            await window.api.updatePurchaseRequestReceived(prId, prGroups[prId], null, reasonForPr);
          }
        }
      }
      
      // Update Cliniko stock for all received items
      for (const stockUpdate of stockUpdateResults) {
        if (stockUpdate.toUpdate) {
          try {
            console.log('Updating Cliniko stock for product:', stockUpdate.product, 'quantity:', stockUpdate.quantity);
            const stockResult = await window.api.updateClinikoStock(stockUpdate.product, stockUpdate.quantity, stockUpdate.prId);
            stockUpdate.result = stockResult;
            console.log('Cliniko stock update result:', stockResult);
          } catch (stockError) {
            console.error('Failed to update Cliniko stock:', stockError);
            stockUpdate.error = stockError.message || 'Failed to update Cliniko stock';
          }
        }
      }
      
      // Show detailed success message including stock update results
      let message = `Items for vendor "${vendor}" updated successfully.`;
      const updatedStock = stockUpdateResults.filter(r => r.result && r.result.updated);
      const skippedStock = stockUpdateResults.filter(r => r.result && !r.result.updated);
      const failedStock = stockUpdateResults.filter(r => r.error);
      
      if (updatedStock.length > 0) {
        message += `\n✅ Updated Cliniko stock for ${updatedStock.length} product(s).`;
      }
      if (skippedStock.length > 0) {
        message += `\n⚠️ Cliniko stock updates disabled - ${skippedStock.length} product(s) not updated.`;
      }
      if (failedStock.length > 0) {
        message += `\n❌ Failed to update Cliniko stock for ${failedStock.length} product(s).`;
      }
      
      alert(message);
      setSavingVendor(null);
  // Clear vendor selections for that vendor
  setSelectedVendorLines(s => ({ ...s, [vendor]: (s[vendor] || []).map(() => false) }));
      fetchData('vendor');
    } catch (error) {
      console.error('Error in saveVendorReceived:', error);
      alert(`Error updating vendor items: ${error.message}`);
      setSavingVendor(null);
    }
  };

  const handleExpand = (id) => {
    setExpanded(exp =>
      exp.includes(id) ? exp.filter(eid => eid !== id) : [...exp, id]
    );
  };

  const handleSelect = (id, checked) => {
    setSelectedIds(ids =>
      checked ? [...ids, id] : ids.filter(selectedId => selectedId !== id)
    );
    // Also set per-line selections for this PR: toggle all lines on/off when PR checkbox clicked
    const pr = prs.find(p => p.id === id);
    if (pr) {
      const allTrue = pr.items.map(() => !!checked);
      setSelectedLines(sel => ({ ...sel, [id]: allTrue }));
    }
  };

  const handleDelete = async () => {
    if (
      selectedIds.length > 0 &&
      window.confirm(`Delete ${selectedIds.length} purchase order(s)?`)
    ) {
      if (!window.api || !window.api.deletePurchaseRequest) return;
      for (const prId of selectedIds) {
        await window.api.deletePurchaseRequest(prId);
      }
      setSelectedIds([]);
      fetchData('pr');
    }
  };
  const handleLineChange = (prId, idx, value) => {
    let v = Math.max(0, Number(value) || 0);
    setEditing((editing) => {
      const arr = [...editing[prId]];
      arr[idx] = v;
      return { ...editing, [prId]: arr };
    });
  };

  const toggleLineSelection = (prId, idx, checked) => {
    setSelectedLines(sel => {
      const arr = sel[prId] ? [...sel[prId]] : [];
      arr[idx] = checked;
      return { ...sel, [prId]: arr };
    });
  };

  const toggleVendorLineSelection = (vendor, idx, checked) => {
    setSelectedVendorLines(sel => {
      const arr = sel[vendor] ? [...sel[vendor]] : [];
      arr[idx] = checked;
      return { ...sel, [vendor]: arr };
    });
  };

  // Helper: Get editable array for each PR, fallback to outstanding
  const getReceivedArr = (pr) => (
    editing[pr.id] && editing[pr.id].length === pr.items.length
      ? editing[pr.id]
      : pr.items.map(i =>
          typeof i["outstanding"] !== "undefined"
            ? i["outstanding"]
            : ((i["No. to Order"] ?? i.no_to_order ?? 0) - (i["received_so_far"] ?? i.received_so_far ?? 0))
        )
  );

  // Summarize differences between two JSON blobs (before/after).
  // Focused rules: detect quantity change (no_to_order / "No. to Order" / quantity)
  // and deletions of line items. Return concise before/after strings.
  const summarizeChange = (beforeJson, afterJson) => {
    try {
      const before = beforeJson ? JSON.parse(beforeJson) : null;
      const after = afterJson ? JSON.parse(afterJson) : null;

      const beforeItems = Array.isArray(before && before.items) ? before.items : [];
      const afterItems = Array.isArray(after && after.items) ? after.items : [];

      const keyFor = (it) => {
        if (!it) return null;
        return String(it.id ?? it.product_id ?? it.productId ?? it.product_name ?? it.productName ?? it['Product Name'] ?? it['product_name'] ?? it['productName'] ?? '').trim();
      };

      // Quantity ordered (what was requested)
      const qtyFor = (it) => {
        if (!it) return 0;
        const possible = [it.no_to_order, it['No. to Order'], it.quantity, it['quantity'], it.qty, it['Qty']];
        for (const p of possible) {
          if (typeof p !== 'undefined' && p !== null && p !== '') return Number(p) || 0;
        }
        return 0;
      };

      // Quantity received so far (used to detect receive actions)
      const receivedFor = (it) => {
        if (!it) return 0;
        const possible = [it.received_so_far, it.receivedSoFar, it.received, it['received_so_far']];
        for (const p of possible) {
          if (typeof p !== 'undefined' && p !== null && p !== '') return Number(p) || 0;
        }
        return 0;
      };

      const costFor = (it) => {
        if (!it) return null;
        const possible = [it.unit_cost, it.unitCost, it.unit_price, it.unitPrice, it.price, it.cost];
        for (const p of possible) {
          if (typeof p !== 'undefined' && p !== null && p !== '') return Number(p) || 0;
        }
        return null;
      };

      const nameFor = (it) => {
        if (!it) return '';
        return String(it.product_name ?? it.productName ?? it['Product Name'] ?? '').trim();
      };

      const beforeMap = {};
      beforeItems.forEach(it => {
        const k = keyFor(it) || nameFor(it) || JSON.stringify(it).slice(0, 40);
        beforeMap[k] = it;
      });

      const afterMap = {};
      afterItems.forEach(it => {
        const k = keyFor(it) || nameFor(it) || JSON.stringify(it).slice(0, 40);
        afterMap[k] = it;
      });

      const changes = [];

      // Detect deletions, ordered quantity changes and received quantity changes
      Object.keys(beforeMap).forEach(k => {
        const b = beforeMap[k];
        const a = afterMap[k];
        const productLabel = nameFor(b) || k;
        const beforeQty = qtyFor(b);
        const label = productLabel;
        if (!a) {
          changes.push({ path: `${label}`, before: `${beforeQty} ${productLabel}`, after: 'DELETED' });
        } else {
          // Ordered quantity changed?
          const afterQty = qtyFor(a);
          if (Number(beforeQty) !== Number(afterQty)) {
            changes.push({ path: `${label}`, before: `${beforeQty} ${productLabel}`, after: `${afterQty} ${productLabel}` });
          }

          // Received quantity changed? (this catches receipt operations)
          const beforeReceived = receivedFor(b);
          const afterReceived = receivedFor(a);
          if (Number(beforeReceived) !== Number(afterReceived)) {
            changes.push({ path: `${label} (received)`, before: `Received ${beforeReceived} ${productLabel}`, after: `Received ${afterReceived} ${productLabel}` });
          }

          // detect unit/cost price changes
          const beforeCost = costFor(b);
          const afterCost = costFor(a);
          if (beforeCost !== null && afterCost !== null && Number(beforeCost) !== Number(afterCost)) {
            const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
            changes.push({ path: `${label} (cost)`, before: `Unit cost ${fmt(beforeCost)} ${productLabel}`, after: `Unit cost ${fmt(afterCost)} ${productLabel}` });
          }
        }
      });

      // Optionally detect added lines
      Object.keys(afterMap).forEach(k => {
        if (!beforeMap[k]) {
            const a = afterMap[k];
            const productLabel = nameFor(a) || k;
            const afterQty = qtyFor(a);
            const label = productLabel;
            changes.push({ path: `${label}`, before: 'ADDED', after: `${afterQty} ${productLabel}` });
            // if added line includes a unit cost, show it
            const addedCost = costFor(a);
            if (addedCost !== null) {
              const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
              changes.push({ path: `${label} (cost)`, before: '—', after: `Unit cost ${fmt(addedCost)} ${productLabel}` });
            }
          }
      });

    if (changes.length === 0) return { beforeSummary: '—', afterSummary: '—' };

    const beforeLines = changes.map(c => `${c.before}`);
    const afterLines = changes.map(c => `${c.after}`);
    return { beforeSummary: beforeLines.join('\n'), afterSummary: afterLines.join('\n') };
    } catch (e) {
      // Fallback to raw trimmed JSON
      const trim = (s) => {
        if (!s) return '—';
        try { return JSON.stringify(JSON.parse(s), null, 2).slice(0, 800); } catch (e) { return String(s).slice(0, 800); }
      };
      return { beforeSummary: trim(beforeJson), afterSummary: trim(afterJson) };
    }
  };

  // Helper: Determine if this is a full receive or partial
  const getReceiveType = (pr) => {
    const receivedArr = getReceivedArr(pr);
    const allMatch = pr.items.every(
      (item, idx) => Number(receivedArr[idx]) >= (
        typeof item["outstanding"] !== "undefined"
          ? item["outstanding"]
          : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0))
      )
    );
    return allMatch ? "Full Receive Order" : "Partially Receive Order";
  };

  // Button color helper
  const getButtonColor = (pr) => {
    const receivedArr = getReceivedArr(pr);
    const allMatch = pr.items.every(
      (item, idx) => Number(receivedArr[idx]) >= (
        typeof item["outstanding"] !== "undefined"
          ? item["outstanding"]
          : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0))
      )
    );
    return allMatch ? "#28a745" : "#ff9800";
  };

  // Save receipt for this PR
  const saveReceived = async (pr) => {
    console.log('saveReceived called for PR:', pr.id);
    setSavingId(pr.id);
    
    try {
      const receivedArr = getReceivedArr(pr);
      console.log('receivedArr:', receivedArr);
      
      // Build lines but only include ones that are selected (if any selections exist)
      const perLineSel = selectedLines[pr.id] || [];
      const anySelected = perLineSel.some(Boolean);
      const lines = pr.items.map((item, idx) => ({
        productName: item["Product Name"] ?? item.name,
        ordered: item["No. to Order"] ?? item.no_to_order ?? 0,
        receivedSoFar: item["received_so_far"] ?? item.received_so_far ?? 0,
        outstanding: typeof item["outstanding"] !== "undefined"
          ? item["outstanding"]
          : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0)),
        newlyReceived: Number(receivedArr[idx]),
        _selected: perLineSel.length ? Boolean(perLineSel[idx]) : true,
      })).filter(l => anySelected ? l._selected : true);
      
      console.log('lines to process:', lines);
      
      if (!window.api || !window.api.updatePurchaseRequestReceived || !window.api.getPurchaseRequestById || !window.api.setPurchaseRequestReceived) {
        console.error('Required API methods not available');
        alert('Error: Required API methods not available');
        setSavingId(null);
        return;
      }
      
      // Require a reason for making this change via modal
      let reason;
      try {
        reason = await requestReason('Please enter a reason for this update (required):', 'Receiving items');
      } catch (e) {
        alert('A short reason is required to update the purchase order. Update cancelled.');
        setSavingId(null);
        return;
      }
      if (!reason || String(reason).trim().length < 3) {
        alert('A short reason is required to update the purchase order. Update cancelled.');
        setSavingId(null);
        return;
      }

      // Update the purchase order item lines using the audited API
      console.log('Updating purchase order received quantities (audited) ...');
      try {
        const changedBy = await resolveCurrentUserIdentifier();
        await window.api.updatePurchaseRequestItemsWithComment(pr.id, lines.map(l => ({ productName: l.productName, newlyReceived: l.newlyReceived })), changedBy, reason);
      } catch (e) {
        console.warn('Audited update failed, falling back to legacy:', e);
        try {
          const changedBy = await resolveCurrentUserIdentifier();
          await window.api.updatePurchaseRequestReceived(pr.id, lines, changedBy, reason);
        } catch (e) {
          console.warn('Failed to include changedBy for single-PR receive:', e);
          await window.api.updatePurchaseRequestReceived(pr.id, lines, null, reason);
        }
      }
      
      // Also update Cliniko stock for each received item
      const stockUpdateResults = [];
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const receivedQty = line.newlyReceived;
        
        if (receivedQty > 0 && line.productName) {
          try {
            console.log('Updating Cliniko stock for product:', line.productName, 'quantity:', receivedQty);
            const stockResult = await window.api.updateClinikoStock(line.productName, receivedQty, pr.id);
            stockUpdateResults.push({
              product: line.productName,
              quantity: receivedQty,
              result: stockResult
            });
            console.log('Cliniko stock update result:', stockResult);
          } catch (stockError) {
            console.error('Failed to update Cliniko stock:', stockError);
            // Don't fail the whole operation if just stock update fails
            stockUpdateResults.push({
              product: line.productName,
              quantity: receivedQty,
              error: stockError.message || 'Failed to update Cliniko stock'
            });
          }
        }
      }
      
      // After updating, check if all items are now received
      console.log('Checking if all items are received...');
      const updatedPr = await window.api.getPurchaseRequestById(pr.id);
      const allReceived = updatedPr.items.every(i => {
        const ordered = i["No. to Order"] ?? i.no_to_order ?? 0;
        const received = i["received_so_far"] ?? i.received_so_far ?? 0;
        return received >= ordered;
      });
      if (allReceived) {
        // Set date_received and received on purchase_requests
        const now = new Date().toISOString();
        console.log('All items received, marking PR as complete...');
        await window.api.setPurchaseRequestReceived(pr.id, { date_received: now, received: 1 });
      }
      
      // Show detailed success message including stock update results
      let message = `Purchase order ${pr.id} updated successfully.`;
      const updatedStock = stockUpdateResults.filter(r => r.result && r.result.updated);
      const skippedStock = stockUpdateResults.filter(r => r.result && !r.result.updated);
      const failedStock = stockUpdateResults.filter(r => r.error);
      
      if (updatedStock.length > 0) {
        message += `\n✅ Updated Cliniko stock for ${updatedStock.length} product(s).`;
      }
      if (skippedStock.length > 0) {
        message += `\n⚠️ Cliniko stock updates disabled - ${skippedStock.length} product(s) not updated.`;
      }
      if (failedStock.length > 0) {
        message += `\n❌ Failed to update Cliniko stock for ${failedStock.length} product(s).`;
      }
      
      // Show the alert with results
      alert(message);
      
      setEditing((edit) => {
        const copy = { ...edit };
        delete copy[pr.id];
        return copy;
      });
  // Clear selection for PR after processing
  setSelectedLines(sel => ({ ...sel, [pr.id]: (sel[pr.id] || []).map(() => false) }));
      setSavingId(null);
      fetchData('pr');
    } catch (error) {
      console.error('Error in saveReceived:', error);
      alert(`Error updating purchase order: ${error.message}`);
      setSavingId(null);
    }
  };

  // -------- Typeahead Search Handlers --------

  // PR Tab Typeahead
  const handlePrSearch = e => {
    const val = e.target.value;
    setPrSearch(val);
    if (val.trim()) {
      const search = val.trim().toLowerCase();
      setPrSuggestions(
        prs
          .filter(pr =>
            (pr.id && pr.id.toLowerCase().includes(search)) ||
            (pr.date_created && new Date(pr.date_created).toLocaleString().toLowerCase().includes(search)) ||
            (pr.date_received && new Date(pr.date_received).toLocaleString().toLowerCase().includes(search))
          )
          .slice(0, 8)
          .map(pr => ({
            id: pr.id,
            label: `${pr.id} (${pr.date_received ? new Date(pr.date_received).toLocaleString() : new Date(pr.date_created).toLocaleString()})`
          }))
      );
    } else {
      setPrSuggestions([]);
    }
  };

  // Vendor Tab Typeahead
  const handleVendorSearch = e => {
    const val = e.target.value;
    setVendorSearch(val);
    if (val.trim()) {
      const search = val.trim().toLowerCase();
      setVendorSuggestions(
        Object.keys(vendorData)
          .filter(vendor => vendor.toLowerCase().includes(search))
          .slice(0, 8)
      );
    } else {
      setVendorSuggestions([]);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
    <div className="center-card">
      {/* Back to Home Button */}
      <button
        onClick={() => navigate("/")}
        style={{
          position: "fixed",
          top: "100px",
          left: "20px",
          background: "none",
          border: "none",
          color: "#006bb6",
          fontSize: "24px",
          cursor: "pointer",
          padding: "8px",
          lineHeight: 1,
          zIndex: 1000,
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        title="Back to Home"
      >
        ←
      </button>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, color: "#1867c0", fontWeight: 700 }}>Active Purchase Orders</h2>
      </div>
      {/* Tab Navigation */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <button
          style={{
            padding: "10px 32px",
            border: "none",
            borderBottom: tab === "pr" ? "3px solid #1867c0" : "3px solid transparent",
            background: tab === "pr" ? "#fafdff" : "#f6f9fb",
            color: tab === "pr" ? "#1867c0" : "#555",
            fontWeight: tab === "pr" ? 700 : 500,
            fontSize: "1.08em",
            cursor: tab === "pr" ? "default" : "pointer",
            borderRadius: "8px 8px 0 0",
            marginRight: 8,
            outline: "none"
          }}
          disabled={tab === "pr"}
          onClick={() => setTab("pr")}
        >
          By Purchase Order
        </button>
        <button
          style={{
            padding: "10px 32px",
            border: "none",
            borderBottom: tab === "vendor" ? "3px solid #1867c0" : "3px solid transparent",
            background: tab === "vendor" ? "#fafdff" : "#f6f9fb",
            color: tab === "vendor" ? "#1867c0" : "#555",
            fontWeight: tab === "vendor" ? 700 : 500,
            fontSize: "1.08em",
            cursor: tab === "vendor" ? "default" : "pointer",
            borderRadius: "8px 8px 0 0",
            outline: "none"
          }}
          disabled={tab === "vendor"}
          onClick={() => setTab("vendor")}
        >
          By Vendor
        </button>
      </div>

      {/* ---- Typeahead Search Inputs ---- */}
      {tab === "pr" ? (
        <div style={{ marginBottom: 18, textAlign: "center", position: "relative", maxWidth: 600, marginLeft: "auto", marginRight: "auto", zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px', justifyContent: "center" }}>
            <input
              type="text"
              value={prSearch}
              onChange={handlePrSearch}
              placeholder="Search by PO ID or Date..."
              style={{ 
                padding: "8px 12px", 
                borderRadius: 4, 
                border: "1px solid #ccc", 
                fontSize: "1em", 
                width: 320, 
                boxSizing: 'border-box',
                margin: 0,
                outline: 'none'
              }}
              // autoFocus
              autoComplete="off"
            />
            <button
              style={{
                padding: '8px 12px', 
                borderRadius: 4, 
                border: '1px solid #1867c0', 
                background: '#1867c0', 
                color: '#fff', 
                fontWeight: 500, 
                fontSize: '1em', 
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                boxSizing: 'border-box', 
                margin: 0,
                flexShrink: 0,
                width: 'auto'
              }}
              onClick={() => {
                // Navigate to receipt scanner page
                window.location.href = '#/receive-items';
              }}
            >
              Receipt via Scanner
            </button>
          </div>
          {prSearch && prSuggestions.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 40, background: "#fff", border: "1px solid #ccc", borderRadius: 6, zIndex: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              {prSuggestions.map(sug => (
                <div
                  key={sug.id}
                  style={{ padding: "8px 16px", cursor: "pointer", borderBottom: "1px solid #eee" }}
                  onClick={() => {
                    setPrSearch(sug.id);
                    setPrSuggestions([]);
                  }}
                >
                  {sug.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 18, textAlign: "center", position: "relative", maxWidth: 600, marginLeft: "auto", marginRight: "auto", zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px', justifyContent: "center" }}>
            <input
              type="text"
              value={vendorSearch}
              onChange={handleVendorSearch}
              placeholder="Search by Vendor Name..."
              style={{ 
                padding: "8px 12px", 
                borderRadius: 4, 
                border: "1px solid #ccc", 
                fontSize: "1em", 
                width: 320, 
                boxSizing: 'border-box',
                margin: 0,
                outline: 'none'
              }}
              // autoFocus
              autoComplete="off"
            />
            <button
              style={{
                padding: '8px 12px', 
                borderRadius: 4, 
                border: '1px solid #1867c0', 
                background: '#1867c0', 
                color: '#fff', 
                fontWeight: 500, 
                fontSize: '1em', 
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                boxSizing: 'border-box', 
                margin: 0,
                flexShrink: 0,
                width: 'auto'
              }}
              onClick={() => {
                // Navigate to receipt scanner page
                window.location.href = '#/receive-items';
              }}
            >
              Receipt via Scanner
            </button>
          </div>
          {vendorSearch && vendorSuggestions.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 40, background: "#fff", border: "1px solid #ccc", borderRadius: 6, zIndex: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              {vendorSuggestions.map(vendor => (
                <div
                  key={vendor}
                  style={{ padding: "8px 16px", cursor: "pointer", borderBottom: "1px solid #eee" }}
                  onClick={() => {
                    setVendorSearch(vendor);
                    setVendorSuggestions([]);
                  }}
                >
                  {vendor}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Tab Content ---- */}
      {tab === "pr" ? (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr style={{ background: "#f6f9fb" }}>
                <th style={{ width: 40, textAlign: "center", border: "1px solid #ccc" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === prs.length && prs.length > 0}
                    onChange={e =>
                      setSelectedIds(e.target.checked ? prs.map(pr => pr.id) : [])
                    }
                  />
                </th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8" }}>PO ID</th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8" }}>Date</th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8", textAlign: 'center' }}>Total Cost</th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8", textAlign: "center", width: 80 }}>
                  <span style={{ fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }} aria-hidden>
                    📄
                  </span>
                  <span style={{ marginLeft: 6 }}>PO</span>
                </th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8", textAlign: "center", width: 120 }}>
                  <span style={{ fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }} aria-hidden>
                    📧
                  </span>
                  <span style={{ marginLeft: 6 }}>Created</span>
                </th>
                <th style={{ border: "1px solid #ccc", padding: 6, fontWeight: 600, color: "#246aa8", textAlign: "center", width: 80 }}>
                  <span style={{ fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }} aria-hidden>
                    ✉️
                  </span>
                  <span style={{ marginLeft: 6 }}>Sent</span>
                </th>
                <th style={{ width: 44, textAlign: 'center', border: '1px solid #ccc', padding: 4 }} aria-hidden></th>
                {/* Removed trailing expand column to place expand control next to PO ID */}
              </tr>
            </thead>
            <tbody>
              {prs
                .filter(pr => {
                  const search = prSearch.trim().toLowerCase();
                  if (!search) return true;
                  return (
                    (pr.id && pr.id.toLowerCase().includes(search)) ||
                    (pr.date_created && new Date(pr.date_created).toLocaleString().toLowerCase().includes(search)) ||
                    (pr.date_received && new Date(pr.date_received).toLocaleString().toLowerCase().includes(search))
                  );
                })
                .map((pr) => (
                <React.Fragment key={pr.id}>
                  <tr
                    style={{
                      borderBottom: "1px solid #ddd",
                      background: expanded.includes(pr.id) ? "#f2faff" : "#fff",
                      cursor: "pointer"
                    }}
                    onClick={() => handleExpand(pr.id)}
                  >
                    <td style={{ textAlign: "center", border: "1px solid #ccc" }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(pr.id)}
                        onChange={e => handleSelect(pr.id, e.target.checked)}
                      />
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center" }}>
                      <span
                        style={{ cursor: "pointer", color: "#1867c0", fontWeight: 700 }}
                        onClick={e => { e.stopPropagation(); handleExpand(pr.id); }}
                      >
                        {pr.id} {expanded.includes(pr.id) ? '▲' : '▼'}
                      </span>
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center" }}>
                      {pr.date_created
                        ? new Date(pr.date_created).toLocaleString()
                        : pr.date_received
                        ? new Date(pr.date_received).toLocaleString()
                        : "—"}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center", fontWeight: 700 }}>{fmtCurrency(computePrTotal(pr))}</td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center", fontSize: 18, backgroundColor: pr.supplier_files_created ? "#e8f5e8" : "#ffeaea" }}>
                      <span style={{ color: pr.supplier_files_created ? "#28a745" : "#dc3545", fontWeight: "bold", fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}>
                        {pr.supplier_files_created ? "✓" : "✗"}
                      </span>
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center", fontSize: 18, backgroundColor: pr.oft_files_created ? "#e8f5e8" : "#ffeaea" }}>
                      <span style={{ color: pr.oft_files_created ? "#28a745" : "#dc3545", fontWeight: "bold", fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}>
                        {pr.oft_files_created ? "✓" : "✗"}
                      </span>
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center", fontSize: 18, backgroundColor: pr.emails_sent ? "#e8f5e8" : "#ffeaea" }}>
                      <span style={{ color: pr.emails_sent ? "#28a745" : "#dc3545", fontWeight: "bold", fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}>
                        {pr.emails_sent ? "✓" : "✗"}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: 8, textAlign: "center", width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Open in Generate Supplier Files"
                        onClick={(e) => { e.stopPropagation(); navigate(`/generate-supplier-files?prId=${encodeURIComponent(pr.id)}`); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 18,
                          color: '#0369a1',
                          padding: '0 2px',
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: 'none',
                          transform: 'translateY(-14px)',
                          boxShadow: 'none',
                          borderRadius: 0,
                          appearance: 'none',
                          WebkitAppearance: 'none'
                        }}
                      >
                        ›
                      </button>
                    </td>
                    {/* expand arrow moved into PO ID cell above; trailing column removed */}
                  </tr>
                  {expanded.includes(pr.id) && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div style={{ padding: 12, background: "#fafdff" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ border: "1px solid #ccc", textAlign: 'center' }}></th>
                                <th style={{ border: "1px solid #ccc" }}>Product Name</th>
                                <th style={{ border: "1px solid #ccc" }}>Supplier</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Ordered</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Received</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Outstanding</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Unit Cost</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Line Total</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Receiving</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pr.items.map((item, idx) => {
                                const maxQty =
                                  typeof item["outstanding"] !== "undefined"
                                    ? item["outstanding"]
                                    : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0));
                                const prevReceived = item["received_so_far"] ?? item.received_so_far ?? 0;
                                const prodName = item["Product Name"] ?? item.name;
                                const supplier = getSupplierName(item);
                                const val =
                                  editing[pr.id] && typeof editing[pr.id][idx] !== "undefined"
                                    ? editing[pr.id][idx]
                                    : maxQty;
                                return (
                                  <tr key={idx}>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={(selectedLines[pr.id] && selectedLines[pr.id][idx]) || false}
                                        onChange={e => toggleLineSelection(pr.id, idx, e.target.checked)}
                                      />
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4 }}>{prodName}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4 }}>{supplier}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      {item["No. to Order"] ?? item.no_to_order ?? 0}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      {prevReceived}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      {maxQty}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      {fmtCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price ?? item.unitPrice ?? '')}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      {fmtCurrency(item.line_total ?? item.lineTotal ?? '')}
                                    </td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                      <input
                                        type="number"
                                        min={0}
                                        value={val}
                                        onChange={e => handleLineChange(pr.id, idx, e.target.value)}
                                        style={{
                                          width: 44,
                                          textAlign: "center",
                                          fontSize: 16,
                                          padding: "2px 4px",
                                          borderRadius: 4,
                                          border: "1px solid #ccc",
                                          margin: "0 2px"
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button
                              style={{
                                marginTop: 16,
                                background: getButtonColor(pr),
                                color: "#fff",
                                border: "none",
                                padding: "9px 32px",
                                borderRadius: 5,
                                fontWeight: 700,
                                fontSize: "1.12em",
                                boxShadow: "0 2px 10px 0 rgba(0,0,0,0.06)",
                                letterSpacing: "0.03em",
                                cursor: "pointer",
                              }}
                              disabled={savingId === pr.id}
                              onClick={() => saveReceived(pr)}
                            >
                              {savingId === pr.id ? "Saving..." : getReceiveType(pr)}
                            </button>
                            <button
                              style={{
                                marginTop: 16,
                                marginLeft: 12,
                                background: '#007bff',
                                color: '#fff',
                                border: 'none',
                                padding: '9px 18px',
                                borderRadius: 5,
                                fontWeight: 600,
                                fontSize: '1.02em',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => { e.stopPropagation(); openHistoryModal(pr.id); }}
                            >
                              View History
                            </button>
                            <button
                              style={{
                                marginTop: 16,
                                marginLeft: 12,
                                background: '#6c757d',
                                color: '#fff',
                                border: 'none',
                                padding: '9px 18px',
                                borderRadius: 5,
                                fontWeight: 600,
                                fontSize: '1.02em',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => { e.stopPropagation(); openEditModal(pr); }}
                            >
                              Edit PO
                            </button>
                          </div>
                          </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {/* Action Buttons BELOW table, inside the frame, left aligned */}
          <div style={{ display: "flex", gap: "16px", marginTop: 30 }}>
            <button
              style={{
                background: selectedIds.length ? "#28a745" : "#ccc",
                border: "none",
                color: "#fff",
                fontSize: 17,
                fontWeight: 600,
                cursor: selectedIds.length ? "pointer" : "not-allowed",
                outline: "none",
                padding: "13px 38px",
                borderRadius: 6,
                transition: "background 0.2s",
                minWidth: 190,
                boxShadow: "0 2px 8px 0 rgba(50,0,0,0.03)",
              }}
              disabled={selectedIds.length === 0}
              onClick={async () => {
                if (selectedIds.length === 0) return;
                
                if (window.confirm(`Receive all items for ${selectedIds.length} selected purchase order(s)?`)) {
                  let totalStockUpdates = [];
                  
                  // Process each selected PR
                  for (const prId of selectedIds) {
                    const pr = prs.find(p => p.id === prId);
                    if (pr) {
                      const receivedArr = getReceivedArr(pr);
                      const lines = pr.items.map((item, idx) => ({
                        productName: item["Product Name"] ?? item.name,
                        newlyReceived: Number(receivedArr[idx]),
                      }));
                      
                      // Ask for a reason once per PR and use audited API
                      let reasonForPrBulk;
                      try {
                        reasonForPrBulk = await requestReason(`Enter reason for receiving items for PR ${pr.id} (required):`, 'Bulk receive');
                      } catch (e) {
                        // Skip this PR if user cancelled the reason modal
                        console.log('Bulk receive cancelled for PR', pr.id);
                        continue;
                      }
                      if (!reasonForPrBulk || String(reasonForPrBulk).trim().length < 3) {
                        console.log('Insufficient reason provided for PR', pr.id);
                        continue;
                      }
                      try {
                        const changedBy = await resolveCurrentUserIdentifier();
                        await window.api.updatePurchaseRequestItemsWithComment(pr.id, lines.map(l => ({ productName: l.productName, newlyReceived: l.newlyReceived })), changedBy, reasonForPrBulk);
                      } catch (e) {
                        console.warn('Audited bulk update failed, falling back to legacy:', e);
                        try {
                          const changedBy = await resolveCurrentUserIdentifier();
                          await window.api.updatePurchaseRequestReceived(pr.id, lines.map((item, idx) => ({
                            productName: item.productName,
                            ordered: pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0,
                            receivedSoFar: pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0,
                            outstanding: typeof pr.items[idx]["outstanding"] !== "undefined"
                              ? pr.items[idx]["outstanding"]
                              : ((pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0) - (pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0)),
                            newlyReceived: item.newlyReceived,
                          })), changedBy, reasonForPrBulk);
                        } catch (e2) {
                          console.warn('Failed to include changedBy for legacy bulk receive fallback:', e2);
                          await window.api.updatePurchaseRequestReceived(pr.id, lines.map((item, idx) => ({
                            productName: item.productName,
                            ordered: pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0,
                            receivedSoFar: pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0,
                            outstanding: typeof pr.items[idx]["outstanding"] !== "undefined"
                              ? pr.items[idx]["outstanding"]
                              : ((pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0) - (pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0)),
                            newlyReceived: item.newlyReceived,
                          })), null, reasonForPrBulk);
                        }
                      }
                      
                      // Update Cliniko stock for this PR
                      for (const line of lines) {
                        if (line.newlyReceived > 0 && line.productName) {
                          try {
                            console.log('Updating Cliniko stock for product:', line.productName, 'quantity:', line.newlyReceived);
                            const stockResult = await window.api.updateClinikoStock(line.productName, line.newlyReceived, pr.id);
                            totalStockUpdates.push({
                              product: line.productName,
                              quantity: line.newlyReceived,
                              result: stockResult
                            });
                          } catch (stockError) {
                            console.error('Failed to update Cliniko stock:', stockError);
                            totalStockUpdates.push({
                              product: line.productName,
                              quantity: line.newlyReceived,
                              error: stockError.message || 'Failed to update Cliniko stock'
                            });
                          }
                        }
                      }
                      
                      // Check if all items are now received for this PR
                      const updatedPr = await window.api.getPurchaseRequestById(pr.id);
                      const allReceived = updatedPr.items.every(i => {
                        const ordered = i["No. to Order"] ?? i.no_to_order ?? 0;
                        const received = i["received_so_far"] ?? i.received_so_far ?? 0;
                        return received >= ordered;
                      });
                      if (allReceived) {
                        const now = new Date().toISOString();
                        await window.api.setPurchaseRequestReceived(pr.id, { date_received: now, received: 1 });
                      }
                    }
                  }
                  
                  // Show detailed success message including stock update results
                  let message = `${selectedIds.length} purchase order(s) updated successfully.`;
                  const updatedStock = totalStockUpdates.filter(r => r.result && r.result.updated);
                  const skippedStock = totalStockUpdates.filter(r => r.result && !r.result.updated);
                  const failedStock = totalStockUpdates.filter(r => r.error);
                  
                  if (updatedStock.length > 0) {
                    message += `\n✅ Updated Cliniko stock for ${updatedStock.length} product(s).`;
                  }
                  if (skippedStock.length > 0) {
                    message += `\n⚠️ Cliniko stock updates disabled - ${skippedStock.length} product(s) not updated.`;
                  }
                  if (failedStock.length > 0) {
                    message += `\n❌ Failed to update Cliniko stock for ${failedStock.length} product(s).`;
                  }
                  
                  alert(message);
                  setSelectedIds([]);
                  fetchData('pr');
                }
              }}
            >
              Receive All Selected
            </button>
            <button
              style={{
                background: selectedIds.length ? "#d32f2f" : "#ccc",
                border: "none",
                color: "#fff",
                fontSize: 17,
                fontWeight: 600,
                cursor: selectedIds.length ? "pointer" : "not-allowed",
                outline: "none",
                padding: "13px 38px",
                borderRadius: 6,
                transition: "background 0.2s",
                minWidth: 190,
                boxShadow: "0 2px 8px 0 rgba(50,0,0,0.03)",
              }}
              disabled={selectedIds.length === 0}
              onClick={handleDelete}
            >
              Delete Selected
            </button>
          </div>
        </>
      ) : (
        <>
          {/* By Vendor View with expand/collapse, editable, and save */}
          {Object.keys(vendorData)
            .filter(vendor => {
              const search = vendorSearch.trim().toLowerCase();
              if (!search) return true;
              return vendor.toLowerCase().includes(search);
            }).length === 0 ? (
            <div style={{ textAlign: "center", color: "#888", marginTop: 32 }}>No items found for any vendor.</div>
          ) : (
            Object.entries(vendorData)
              .filter(([vendor]) => {
                const search = vendorSearch.trim().toLowerCase();
                if (!search) return true;
                return vendor.toLowerCase().includes(search);
              })
              .map(([vendor, items]) => (
              <div key={vendor} style={{ marginBottom: 32, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fafdff" }}>
                <h3
                  style={{ margin: 0, padding: "16px 24px", background: "#f6f9fb", borderRadius: "8px 8px 0 0", color: "#1867c0", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => handleVendorExpand(vendor)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{vendor}</span>
                      <span style={{ fontSize: 14, color: '#1867c0' }}>{expandedVendor.includes(vendor) ? '▲' : '▼'}</span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#1867c0' }}>{fmtCurrency(computeItemsTotal(items))}</div>
                  </div>
                </h3>
                {expandedVendor.includes(vendor) && (
                  <div style={{ padding: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ border: "1px solid #ccc", textAlign: 'center' }}></th>
                          <th style={{ border: "1px solid #ccc" }}>Product Name</th>
                          <th style={{ border: "1px solid #ccc" }}>Ordered</th>
                          <th style={{ border: "1px solid #ccc" }}>Received</th>
                          <th style={{ border: "1px solid #ccc" }}>Outstanding</th>
                          <th style={{ border: "1px solid #ccc" }}>Unit Cost</th>
                          <th style={{ border: "1px solid #ccc" }}>Line Total</th>
                          <th style={{ border: "1px solid #ccc" }}>Receiving</th>
                          <th style={{ border: "1px solid #ccc" }}>Purchase Order ID</th>
                          <th style={{ border: "1px solid #ccc" }}>Date Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const prodName = item["Product Name"] ?? item.name;
                          const ordered = item["No. to Order"] ?? item.no_to_order ?? 0;
                          const prevReceived = item["received_so_far"] ?? item.received_so_far ?? 0;
                          const outstanding = typeof item["outstanding"] !== "undefined"
                            ? item["outstanding"]
                            : (ordered - prevReceived);
                          const val =
                            vendorEditing[vendor] && typeof vendorEditing[vendor][idx] !== "undefined"
                              ? vendorEditing[vendor][idx]
                              : outstanding;
                          return (
                            <tr key={idx}>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={(selectedVendorLines[vendor] && selectedVendorLines[vendor][idx]) || false}
                                  onChange={e => toggleVendorLineSelection(vendor, idx, e.target.checked)}
                                />
                              </td>
                              <td style={{ border: "1px solid #ccc", padding: 4 }}>{prodName}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{ordered}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{prevReceived}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{outstanding}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                {fmtCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price ?? item.unitPrice ?? '')}
                              </td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                {fmtCurrency(item.line_total ?? item.lineTotal ?? '')}
                              </td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={val}
                                  onChange={e => handleVendorLineChange(vendor, idx, e.target.value)}
                                  style={{
                                    width: 44,
                                    textAlign: "center",
                                    fontSize: 16,
                                    padding: "2px 4px",
                                    borderRadius: 4,
                                    border: "1px solid #ccc",
                                    margin: "0 2px"
                                  }}
                                />
                              </td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item.pr_id}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item.date_created ? new Date(item.date_created).toLocaleString() : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <button
                      style={{
                        marginTop: 16,
                        background: "#28a745",
                        color: "#fff",
                        border: "none",
                        padding: "9px 32px",
                        borderRadius: 5,
                        fontWeight: 700,
                        fontSize: "1.12em",
                        boxShadow: "0 2px 10px 0 rgba(0,0,0,0.06)",
                        letterSpacing: "0.03em",
                        cursor: "pointer",
                      }}
                      disabled={savingVendor === vendor}
                      onClick={() => saveVendorReceived(vendor, items)}
                    >
                      {savingVendor === vendor ? "Saving..." : "Save Received"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
    {/* History Modal */}
    {historyModalState.visible && (
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div style={{ width: '80%', maxHeight: '80%', background: '#fff', borderRadius: 8, padding: 20, overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, position: 'relative' }}>
            <h3 style={{ margin: 0 }}>PO Change History — {historyModalState.prId}</h3>
            <button onClick={closeHistoryModal} title="Close" aria-label="Close history" style={{ marginLeft: 'auto', border: '1px solid #ccc', background: '#eee', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1, color: '#000' }}>✕</button>
          </div>
          {historyModalState.entries.length === 0 ? (
            <div style={{ color: '#666' }}>No history entries found for this PO.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f6f9fb' }}>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>When</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>By</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Comment</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Before (summary)</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>After (summary)</th>
                </tr>
              </thead>
              <tbody>
                {historyModalState.entries.map((row) => (
                  <tr key={row.id}>
                    <td style={{ border: '1px solid #eee', padding: 8, verticalAlign: 'top' }}>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</td>
                    <td style={{ border: '1px solid #eee', padding: 8, verticalAlign: 'top' }}>{row.changed_by || 'System'}</td>
                    <td style={{ border: '1px solid #eee', padding: 8, verticalAlign: 'top' }}>{row.comment}</td>
                    <td style={{ border: '1px solid #eee', padding: 8, verticalAlign: 'top', maxWidth: 240 }}>
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{(() => { const s = summarizeChange(row.before_json, row.after_json); return s.beforeSummary; })()}</pre>
                    </td>
                    <td style={{ border: '1px solid #eee', padding: 8, verticalAlign: 'top', maxWidth: 240 }}>
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{(() => { const s = summarizeChange(row.before_json, row.after_json); return s.afterSummary; })()}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )}
    {/* Reason Modal (used by requestReason) */}
    {reasonModalState.visible && (
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
        <div style={{ width: '480px', maxHeight: '80%', background: '#fff', borderRadius: 8, padding: 18, overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{(reasonModalState.title || 'Reason').replace(/\s*\(required\)\s*:?\s*$/i, '')}</h3>
            <button onClick={() => { cancelReasonModal(); }} title="Close" aria-label="Close reason" style={{ border: '1px solid #ccc', background: '#eee', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1, color: '#000', transform: 'translateY(-12px)' }}>✕</button>
          </div>
          <div style={{ marginBottom: 8 }}>
            <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={6} style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 14 }} placeholder="Enter a short reason (required)"></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => { cancelReasonModal(); }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#333', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { submitReasonModal(reasonText); }} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>Submit</button>
          </div>
        </div>
      </div>
    )}
    {/* Edit PO Modal */}
    {editModalState.visible && (
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div style={{ width: '80%', maxHeight: '80%', background: '#fff', borderRadius: 8, padding: 20, overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, position: 'relative' }}>
            <h3 style={{ margin: 0 }}>Edit Purchase Order — {editModalState.prId}</h3>
            <button onClick={closeEditModal} title="Close" aria-label="Close edit" style={{ marginLeft: 'auto', border: '1px solid #ccc', background: '#eee', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1, transform: 'translateY(-12px)', color: '#000' }}>✕</button>
          </div>
          <div style={{ color: '#666', marginBottom: 12 }}>Modify "No. to Order" or mark lines to delete. A required reason will be requested when saving.</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f6f9fb' }}>
                <th style={{ border: '1px solid #ddd', padding: 8 }}>Delete</th>
                <th style={{ border: '1px solid #ddd', padding: 8 }}>Product</th>
                <th style={{ border: '1px solid #ddd', padding: 8 }}>No. to Order</th>
                <th style={{ border: '1px solid #ddd', padding: 8 }}>Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {editModalState.items.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td style={{ border: '1px solid #eee', padding: 8, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!row.delete} onChange={e => handleEditItemChange(idx, 'delete', e.target.checked)} />
                  </td>
                  <td style={{ border: '1px solid #eee', padding: 8 }}>{row.productName}</td>
                  <td style={{ border: '1px solid #eee', padding: 8, textAlign: 'center' }}>
                    <input type="number" min={0} value={row.no_to_order} onChange={e => handleEditItemChange(idx, 'no_to_order', Number(e.target.value || 0))} style={{ width: 80, textAlign: 'center' }} />
                  </td>
                  <td style={{ border: '1px solid #eee', padding: 8, textAlign: 'center' }}>
                    <input type="number" min={0} step="0.01" value={row.unit_cost} onChange={e => handleEditItemChange(idx, 'unit_cost', Number(e.target.value || 0))} style={{ width: 100, textAlign: 'center' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <button onClick={closeEditModal} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', color: '#333', cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveEditModal} disabled={savingEdit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: savingEdit ? 'wait' : 'pointer' }}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default PurchaseRequests;
