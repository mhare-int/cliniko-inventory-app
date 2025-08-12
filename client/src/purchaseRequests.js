import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";



function PurchaseRequests() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState([]);
  const [vendorData, setVendorData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState([]); // For PR tab
  const [expandedVendor, setExpandedVendor] = useState([]); // For Vendor tab
  const [selectedIds, setSelectedIds] = useState([]);
  const [editing, setEditing] = useState({}); // For PR tab
  const [vendorEditing, setVendorEditing] = useState({}); // For Vendor tab
  const [savingId, setSavingId] = useState(null);
  const [savingVendor, setSavingVendor] = useState(null);
  const [tab, setTab] = useState("pr"); // "pr" or "vendor"

  // Typeahead state
  const [prSearch, setPrSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [prSuggestions, setPrSuggestions] = useState([]);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);


  useEffect(() => {
    fetchData(tab);
    // eslint-disable-next-line
  }, [tab]);

  const fetchData = async (tabType) => {
    setLoading(true);
    if (!window.api || !window.api.getPurchaseRequests) {
      setLoading(false);
      return;
    }
    if (tabType === "pr") {
      const res = await window.api.getPurchaseRequests(true, undefined);
      setPrs(res);
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
    } else {
      const res = await window.api.getPurchaseRequests(true, "vendor");
      // Only show vendors with at least one item outstanding
      const filteredVendorData = {};
      Object.entries(res).forEach(([vendor, items]) => {
        const hasOutstanding = items.some(item => {
          const ordered = item["No. to Order"] ?? item.no_to_order ?? 0;
          const received = item["received_so_far"] ?? item.received_so_far ?? 0;
          return received < ordered;
        });
        if (hasOutstanding) {
          filteredVendorData[vendor] = items;
        }
      });
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
      
      items.forEach((item, idx) => {
        if (!prGroups[item.pr_id]) prGroups[item.pr_id] = [];
        const receivedQty = Number(receivedArr[idx]);
        const productName = item["Product Name"] ?? item.name;
        
        prGroups[item.pr_id].push({
          productName: productName,
          ordered: item["No. to Order"] ?? item.no_to_order ?? 0,
          receivedSoFar: item["received_so_far"] ?? item.received_so_far ?? 0,
          outstanding: typeof item["outstanding"] !== "undefined"
            ? item["outstanding"]
            : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0)),
          newlyReceived: receivedQty,
        });
        
        // Prepare Cliniko stock update for items with received quantities
        if (receivedQty > 0 && productName) {
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
        await window.api.updatePurchaseRequestReceived(prId, prGroups[prId]);
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

  // Helper: Determine if this is a full receive or partial
  const getReceiveType = (pr) => {
    const receivedArr = getReceivedArr(pr);
    const allMatch = pr.items.every(
      (item, idx) => Number(receivedArr[idx]) === (
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
      (item, idx) => Number(receivedArr[idx]) === (
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
      
      const lines = pr.items.map((item, idx) => ({
        productName: item["Product Name"] ?? item.name,
        ordered: item["No. to Order"] ?? item.no_to_order ?? 0,
        receivedSoFar: item["received_so_far"] ?? item.received_so_far ?? 0,
        outstanding: typeof item["outstanding"] !== "undefined"
          ? item["outstanding"]
          : ((item["No. to Order"] ?? item.no_to_order ?? 0) - (item["received_so_far"] ?? item.received_so_far ?? 0)),
        newlyReceived: Number(receivedArr[idx]),
      }));
      
      console.log('lines to process:', lines);
      
      if (!window.api || !window.api.updatePurchaseRequestReceived || !window.api.getPurchaseRequestById || !window.api.setPurchaseRequestReceived) {
        console.error('Required API methods not available');
        alert('Error: Required API methods not available');
        setSavingId(null);
        return;
      }
      
      // Update the purchase order received quantities
      console.log('Updating purchase order received quantities...');
      await window.api.updatePurchaseRequestReceived(pr.id, lines);
      
      // Also update Cliniko stock for each received item
      const stockUpdateResults = [];
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const receivedQty = Number(receivedArr[idx]);
        
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
      
      <h2 style={{ textAlign: "center", color: "#1867c0", fontWeight: 700 }}>Active Purchase Orders</h2>
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
                <th style={{ border: "1px solid #ccc", padding: 8, fontWeight: 600, color: "#246aa8" }}>PO ID</th>
                <th style={{ border: "1px solid #ccc", padding: 8, fontWeight: 600, color: "#246aa8" }}>Date</th>
                <th style={{ border: "1px solid #ccc", width: 44, textAlign: "center" }}></th>
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
                    <td style={{ border: "1px solid #ccc", padding: 8, fontWeight: 700, color: "#1867c0", textAlign: "center" }}>
                      {pr.id}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "center" }}>
                      {pr.date_created
                        ? new Date(pr.date_created).toLocaleString()
                        : pr.date_received
                        ? new Date(pr.date_received).toLocaleString()
                        : "—"}
                    </td>
                    <td style={{ textAlign: "center", border: "1px solid #ccc", fontSize: 18, color: "#555" }}>
                      {expanded.includes(pr.id) ? "▲" : "▼"}
                    </td>
                  </tr>
                  {expanded.includes(pr.id) && (
                    <tr>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <div style={{ padding: 12, background: "#fafdff" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ border: "1px solid #ccc" }}>Product Name</th>
                                <th style={{ border: "1px solid #ccc" }}>Supplier</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Ordered</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Previously Received</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Outstanding</th>
                                <th style={{ border: "1px solid #ccc", textAlign: "center" }}>Newly Receiving</th>
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
                                const supplier = item["Supplier Name"] ?? item.supplier_name ?? "-";
                                const val =
                                  editing[pr.id] && typeof editing[pr.id][idx] !== "undefined"
                                    ? editing[pr.id][idx]
                                    : maxQty;
                                return (
                                  <tr key={idx}>
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
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxQty}
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
                      
                      // Update purchase order
                      await window.api.updatePurchaseRequestReceived(pr.id, lines.map((item, idx) => ({
                        productName: item.productName,
                        ordered: pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0,
                        receivedSoFar: pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0,
                        outstanding: typeof pr.items[idx]["outstanding"] !== "undefined"
                          ? pr.items[idx]["outstanding"]
                          : ((pr.items[idx]["No. to Order"] ?? pr.items[idx].no_to_order ?? 0) - (pr.items[idx]["received_so_far"] ?? pr.items[idx].received_so_far ?? 0)),
                        newlyReceived: item.newlyReceived,
                      })));
                      
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
                  {vendor} {expandedVendor.includes(vendor) ? "▲" : "▼"}
                </h3>
                {expandedVendor.includes(vendor) && (
                  <div style={{ padding: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ border: "1px solid #ccc" }}>Product Name</th>
                          <th style={{ border: "1px solid #ccc" }}>Ordered</th>
                          <th style={{ border: "1px solid #ccc" }}>Previously Received</th>
                          <th style={{ border: "1px solid #ccc" }}>Outstanding</th>
                          <th style={{ border: "1px solid #ccc" }}>Newly Receiving</th>
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
                              <td style={{ border: "1px solid #ccc", padding: 4 }}>{prodName}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{ordered}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{prevReceived}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{outstanding}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={outstanding}
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
  );
}

export default PurchaseRequests;
