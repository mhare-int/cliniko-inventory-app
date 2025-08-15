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
              // Group by vendor
              const vendor = item.supplier_name ?? item["Supplier Name"] ?? "Unknown Vendor";
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
                      </tr>
                      {expanded.includes(pr.id) && (
                        <tr>
                          <td colSpan={4} style={{ background: "#f6f9fb", padding: 0 }}>
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
                                  }}>Total Received</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pr.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Product Name"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["Supplier Name"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["No. to Order"]}</td>
                                    <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["received_so_far"] ?? item["No. to Order"]}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                          }}>Total Received</th>
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
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["No. to Order"]}</td>
                              <td style={{ border: "1px solid #ccc", padding: 4, textAlign: "center" }}>{item["received_so_far"] ?? item["No. to Order"]}</td>
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
    </div>
  );
}

export default ArchivedPurchaseRequests;
