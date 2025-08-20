import React, { useEffect, useState } from "react";


function ArchivedPurchaseRequests() {
  const [prs, setPrs] = useState([]);
  const [vendorData, setVendorData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState([]); // For PR tab
  const [expandedVendor, setExpandedVendor] = useState([]); // For Vendor tab
  const [tab, setTab] = useState("pr"); // "pr" or "vendor"
  const [prSearch, setPrSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [prSuggestions, setPrSuggestions] = useState([]);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [suppliersMap, setSuppliersMap] = useState({});
  const [historyModalState, setHistoryModalState] = useState({ visible: false, prId: null, entries: [] });

  const fmtCurrency = (n) => {
    if (n === null || typeof n === 'undefined' || n === '') return '—';
    const num = Number(n) || 0;
    return `$${num.toFixed(2)}`;
  };

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

  const getSupplierName = (item) => {
    if (!item) return "Unknown Vendor";
    const nameFromItem = item["Supplier Name"] || item.supplier_name || item.vendor_name || null;
    if (nameFromItem) return nameFromItem;
    const supplierId = item["Supplier Id"] || item.supplier_id || item.supplierId || null;
    if (supplierId && suppliersMap[supplierId]) return suppliersMap[supplierId];
    return "Unknown Vendor";
  };

  // History modal helpers
  const openHistoryModal = async (prId) => {
    setHistoryModalState({ visible: true, prId, entries: [] });
    try {
      if (!window.api || !window.api.getPoChangeLog) {
        setHistoryModalState({ visible: true, prId, entries: [] });
        return;
      }
      const rows = await window.api.getPoChangeLog(prId, 200);
      setHistoryModalState({ visible: true, prId, entries: Array.isArray(rows) ? rows : [] });
    } catch (e) {
      console.error('Failed to load PO change log:', e);
      setHistoryModalState({ visible: true, prId, entries: [] });
    }
  };

  const closeHistoryModal = () => setHistoryModalState({ visible: false, prId: null, entries: [] });

  // Summarize before/after JSON for History modal (similar to PurchaseRequests)
  const summarizeChange = (beforeJson, afterJson) => {
    try {
      const before = beforeJson ? JSON.parse(beforeJson) : null;
      const after = afterJson ? JSON.parse(afterJson) : null;

      const beforeItems = Array.isArray(before && before.items) ? before.items : [];
      const afterItems = Array.isArray(after && after.items) ? after.items : [];

      const keyFor = (it) => {
        if (!it) return null;
        return String(it.id ?? it.product_id ?? it.productId ?? it.product_name ?? it.productName ?? it['Product Name'] ?? '').trim();
      };

      const qtyFor = (it) => {
        if (!it) return 0;
        const possible = [it.no_to_order, it['No. to Order'], it.quantity, it['quantity'], it.qty, it['Qty']];
        for (const p of possible) {
          if (typeof p !== 'undefined' && p !== null && p !== '') return Number(p) || 0;
        }
        return 0;
      };

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

      Object.keys(beforeMap).forEach(k => {
        const b = beforeMap[k];
        const a = afterMap[k];
        const productLabel = nameFor(b) || k;
        const beforeQty = qtyFor(b);
        const label = productLabel;
        if (!a) {
          changes.push({ path: `${label}`, before: `${beforeQty} ${productLabel}`, after: 'DELETED' });
        } else {
          const afterQty = qtyFor(a);
          if (Number(beforeQty) !== Number(afterQty)) {
            changes.push({ path: `${label}`, before: `${beforeQty} ${productLabel}`, after: `${afterQty} ${productLabel}` });
          }
          const beforeReceived = receivedFor(b);
          const afterReceived = receivedFor(a);
          if (Number(beforeReceived) !== Number(afterReceived)) {
            changes.push({ path: `${label} (received)`, before: `Received ${beforeReceived} ${productLabel}`, after: `Received ${afterReceived} ${productLabel}` });
          }
          const beforeCost = costFor(b);
          const afterCost = costFor(a);
          if (beforeCost !== null && afterCost !== null && Number(beforeCost) !== Number(afterCost)) {
            const fmt = (v) => `$${Number(v || 0).toFixed(2)}`;
            changes.push({ path: `${label} (cost)`, before: `Unit cost ${fmt(beforeCost)} ${productLabel}`, after: `Unit cost ${fmt(afterCost)} ${productLabel}` });
          }
        }
      });

      Object.keys(afterMap).forEach(k => {
        if (!beforeMap[k]) {
          const a = afterMap[k];
          const productLabel = nameFor(a) || k;
          const afterQty = qtyFor(a);
          const label = productLabel;
          changes.push({ path: `${label}`, before: 'ADDED', after: `${afterQty} ${productLabel}` });
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
      const trim = (s) => {
        if (!s) return '—';
        try { return JSON.stringify(JSON.parse(s), null, 2).slice(0, 800); } catch (e) { return String(s).slice(0, 800); }
      };
      return { beforeSummary: trim(beforeJson), afterSummary: trim(afterJson) };
    }
  };

  useEffect(() => {
    fetchData(tab);
    // eslint-disable-next-line
  }, [tab]);

  const fetchData = async (tabType) => {
    setLoading(true);
    try {
      if (!window.api || !window.api.getPurchaseRequests) throw new Error("getPurchaseRequests not available");
      if (tabType === "pr") {
        // Backend already returns only fully received PRs for archive
        const res = await window.api.getPurchaseRequests(false, undefined);
        setPrs(
          Array.isArray(res)
            ? res.map(pr => ({
                ...pr,
                id: pr.id ?? pr.pr_id,
                date: pr.date_received ?? pr.date_created ?? pr.date,
                items: Array.isArray(pr.items) ? pr.items.map(item => ({
                  ...item,
                  "Product Name": item["Product Name"] ?? item.product_name,
                  "Supplier Name": item["Supplier Name"] ?? item.supplier_name,
                  "No. to Order": item["No. to Order"] ?? item.no_to_order,
                  "received_so_far": item["received_so_far"] ?? item.received_so_far,
                })) : []
              }))
            : []
        );
      } else {
        const res = await window.api.getPurchaseRequests(false, "vendor");
        // DEBUG: Output the raw vendor data structure
        console.log("[ArchivedPurchaseRequests] Raw vendor data:", res);
        if (res && typeof res === 'object' && res.error) {
          setVendorData({ error: res.error });
        } else if (Array.isArray(res)) {
          // Group all items by vendor name
          const vendorMap = {};
          // 1. Build a map of all items by pr_id (across all vendors)
          const allItemsByPrId = {};
          res.forEach(pr => {
            if (!Array.isArray(pr.items)) return;
                pr.items.forEach(item => {
                  // Group by vendor using supplier-id-aware lookup
                  const vendor = getSupplierName(item) || "Unknown Vendor";
                  if (!vendorMap[vendor]) vendorMap[vendor] = [];
                  vendorMap[vendor].push({ ...item, pr_id: item.pr_id ?? pr.id, date_created: pr.date_created ?? pr.date });
              // Build pr_id map
              const prId = item.pr_id ?? pr.id;
              if (!allItemsByPrId[prId]) allItemsByPrId[prId] = [];
              allItemsByPrId[prId].push({ ...item, pr_id: prId });
            });
          });

          // 2. Find pr_ids where all items are fully received
          const fullyReceivedPrIds = new Set();
          Object.entries(allItemsByPrId).forEach(([prId, items]) => {
            const allReceived = items.every(i => {
              const ordered = (i["No. to Order"] ?? i.no_to_order ?? 0);
              const received = (i["received_so_far"] ?? i.received_so_far ?? 0);
              return received >= ordered;
            });
            if (allReceived) fullyReceivedPrIds.add(prId);
          });

          // 3. For each vendor, only include items for those fully received pr_ids
          const filteredVendorData = {};
          Object.entries(vendorMap).forEach(([vendor, items]) => {
            const filteredItems = items
              .filter(item => fullyReceivedPrIds.has(item.pr_id))
              .map(item => ({
                ...item,
                "Product Name": item["Product Name"] ?? item.product_name,
                "No. to Order": item["No. to Order"] ?? item.no_to_order,
                "received_so_far": item["received_so_far"] ?? item.received_so_far,
                pr_id: item.pr_id,
                date_created: item.date_created ?? null
              }));
            if (filteredItems.length > 0) {
              filteredVendorData[vendor] = filteredItems;
            }
          });
          setVendorData(filteredVendorData);
        } else {
          setVendorData({});
        }
      }
    } catch (err) {
      setVendorData({ error: err.message });
    }
    setLoading(false);
  };

  // Expand/collapse for PR tab
  const handleExpand = (id) => {
    setExpanded(exp =>
      exp.includes(id) ? exp.filter(eid => eid !== id) : [...exp, id]
    );
  };

  // Expand/collapse for Vendor tab
  const handleVendorExpand = (vendor) => {
    setExpandedVendor(exp =>
      exp.includes(vendor) ? exp.filter(v => v !== vendor) : [...exp, vendor]
    );
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="center-card">
  <h2 style={{ textAlign: "center", color: "#999", fontWeight: 700 }}>Archived Purchase Orders</h2>
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

      {/* Typeahead Search Inputs */}
      {tab === "pr" ? (
        <div style={{ marginBottom: 18, textAlign: "center", position: "relative", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
          <input
            type="text"
            value={prSearch}
            onChange={e => {
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
            }}
            placeholder="Search by PO ID or Date..."
            style={{ padding: "8px 16px", width: "320px", fontSize: "1em", borderRadius: 6, border: "1px solid #ccc" }}
            autoFocus
            autoComplete="off"
          />
          {prSearch && prSuggestions.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 40, background: "#fff", border: "1px solid #ccc", borderRadius: 6, zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
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
        <div style={{ marginBottom: 18, textAlign: "center", position: "relative", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
          <input
            type="text"
            value={vendorSearch}
            onChange={e => {
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
            }}
            placeholder="Search by Vendor Name..."
            style={{ padding: "8px 16px", width: "320px", fontSize: "1em", borderRadius: 6, border: "1px solid #ccc" }}
            autoFocus
            autoComplete="off"
          />
          {vendorSearch && vendorSuggestions.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 40, background: "#fff", border: "1px solid #ccc", borderRadius: 6, zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
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

      {/* Tab Content */}
      {tab === "pr" ? (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: "#f3f7fb" }}>
                <th style={{ 
                  padding: "12px 8px", 
                  border: "1px solid #dee2e6",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f3f7fb",
                  zIndex: 11,
                  fontWeight: 600,
                  color: "#246aa8"
                }}>PO ID</th>
                <th style={{ 
                  padding: "12px 8px", 
                  border: "1px solid #dee2e6",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f3f7fb",
                  zIndex: 11,
                  fontWeight: 600,
                  color: "#246aa8"
                }}>Date Created</th>
                <th style={{ 
                  padding: "12px 8px", 
                  border: "1px solid #dee2e6",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f3f7fb",
                  zIndex: 11,
                  fontWeight: 600,
                  color: "#246aa8"
                }}>Date Received</th>
                <th style={{ 
                  padding: "12px 8px", 
                  border: "1px solid #dee2e6",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f3f7fb",
                  zIndex: 11,
                  fontWeight: 600,
                  color: "#246aa8"
                }}>Items</th>
                <th style={{ 
                  padding: "12px 8px", 
                  border: "1px solid #dee2e6",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "#f3f7fb",
                  zIndex: 11,
                  fontWeight: 600,
                  color: "#246aa8",
                  textAlign: 'center'
                }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(prs) && prs.length > 0 ? (
                prs
                  .filter(pr => {
                    const search = prSearch.trim().toLowerCase();
                    if (!search) return true;
                    return (
                      (pr.id && pr.id.toLowerCase().includes(search)) ||
                      (pr.date_created && new Date(pr.date_created).toLocaleString().toLowerCase().includes(search)) ||
                      (pr.date_received && new Date(pr.date_received).toLocaleString().toLowerCase().includes(search))
                    );
                  })
                  .map(pr => (
                    <React.Fragment key={pr.id}>
                      <tr style={{ background: expanded.includes(pr.id) ? "#fafdff" : "#fff" }}>
                        <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                          <span style={{ cursor: "pointer", color: "#1867c0", fontWeight: 700 }} onClick={() => handleExpand(pr.id)}>
                            {pr.id} {expanded.includes(pr.id) ? "▲" : "▼"}
                          </span>
                        </td>
                        <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{pr.date_created ? new Date(pr.date_created).toLocaleString() : "—"}</td>
                        <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{pr.date_received ? new Date(pr.date_received).toLocaleString() : "—"}</td>
                        <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{Array.isArray(pr.items) ? pr.items.length : 0}</td>
                        <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{fmtCurrency(pr.total_cost ?? pr.totalCost ?? '')}</td>
                      </tr>
                      {expanded.includes(pr.id) && (
                        <tr>
                          <td colSpan={5} style={{ background: "#f6f9fb", padding: 12 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", margin: 0 }}>
                              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                <tr style={{ backgroundColor: "#f3f7fb" }}>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                  }}>Product Name</th>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                  }}>Supplier Name</th>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6", 
                                    textAlign: "center",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                  }}>Ordered</th>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6", 
                                    textAlign: "center",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                    }}>Received</th>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6", 
                                    textAlign: "center",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                  }}>Unit Cost</th>
                                  <th style={{ 
                                    padding: "12px 8px", 
                                    border: "1px solid #dee2e6", 
                                    textAlign: "center",
                                    position: "sticky",
                                    top: 0,
                                    backgroundColor: "#f3f7fb",
                                    zIndex: 11,
                                    fontWeight: 600,
                                    color: "#246aa8"
                                  }}>Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pr.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Product Name"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Supplier Name"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["No. to Order"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["received_so_far"] ?? item["No. to Order"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{fmtCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price ?? '')}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{fmtCurrency(item.line_total ?? item.lineTotal ?? '')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
                              <button
                                style={{
                                  marginTop: 8,
                                  background: '#007bff',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '8px 14px',
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                onClick={(e) => { e.stopPropagation(); openHistoryModal(pr.id); }}
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
              ) : (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#bbb', padding: 12 }}>No archived purchase orders found.</td></tr>
              )}
            </tbody>
          </table>
        </>
      ) : (
        <>
      {/* By Vendor View with expand/collapse */}
      {vendorData && typeof vendorData === 'object' && vendorData.error ? (
        <div style={{ textAlign: 'center', color: '#f00', marginTop: 32 }}>Error: {vendorData.error}</div>
      ) : vendorData && typeof vendorData === 'object' && Object.keys(vendorData).length === 0 ? (
        <div style={{ textAlign: "center", color: "#888", marginTop: 32 }}>No items found for any vendor.</div>
      ) : (
        vendorData && typeof vendorData === 'object' ? (
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
                  {vendor} {expandedVendor.includes(vendor) ? "▲" : "▼"}
                </h3>
                {expandedVendor.includes(vendor) && (
                  <div style={{ padding: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                        <tr style={{ backgroundColor: "#f3f7fb" }}>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Product Name</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Supplier Name</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Ordered</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Received</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Unit Cost</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Line Total</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Purchase Order ID</th>
                          <th style={{ 
                            padding: "12px 8px", 
                            border: "1px solid #dee2e6", 
                            textAlign: "center",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#f3f7fb",
                            zIndex: 11,
                            fontWeight: 600,
                            color: "#246aa8"
                          }}>Date Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(items) && items.length > 0 ? (
                          items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Product Name"]}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Supplier Name"] ?? getSupplierName(item)}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["No. to Order"]}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["received_so_far"] ?? item["No. to Order"]}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{fmtCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price ?? '')}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{fmtCurrency(item.line_total ?? item.lineTotal ?? '')}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item.pr_id}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item.date_created ? new Date(item.date_created).toLocaleString() : "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={5} style={{ textAlign: 'center', color: '#bbb', padding: 12 }}>No items for this vendor.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
        ) : (
          <div style={{ textAlign: 'center', color: '#f00', marginTop: 32 }}>Vendor data is not an object.</div>
        )
      )}
        </>
      )}
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
    </div>
  );
}

export default ArchivedPurchaseRequests;
