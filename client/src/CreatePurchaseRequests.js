import React, { useState, useEffect, useRef } from "react";
import AsyncSelect from "react-select/async";
import "./App.css";
import ApiKeyModal from "./ApiKeyModal";
import { useNavigate, useLocation } from "react-router-dom";

const TickIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <polyline points="4 11 9 16 16 6" fill="none" stroke="#14B800" strokeWidth="2.2"/>
  </svg>
);
const CrossIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <line x1="5" y1="5" x2="15" y2="15" stroke="#FF4D4F" strokeWidth="2.2"/>
    <line x1="15" y1="5" x2="5" y2="15" stroke="#FF4D4F" strokeWidth="2.2"/>
  </svg>
);


function CreatePurchaseRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  // Remove outputFolder and downloadLinks, not needed for PR creation only
  const [products, setProducts] = React.useState([]);
  const [includeNegative, setIncludeNegative] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [selectedRows, setSelectedRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activePRs, setActivePRs] = React.useState([]);
  const [onOrderMap, setOnOrderMap] = React.useState({});
  const [addingRow, setAddingRow] = React.useState(false);
  const [addRow, setAddRow] = React.useState({ product: null, noToOrder: "" });




  // Helper to check if API key is set and non-empty/whitespace (from backend)
  const [apiKeySet, setApiKeySet] = React.useState(false);
  const [checkingApiKey, setCheckingApiKey] = React.useState(true);

  // Always check API key from backend on mount and after set/remove
  const fetchApiKey = async () => {
    setCheckingApiKey(true);
    try {
      if (window.api && window.api.getApiKey) {
        const res = await window.api.getApiKey();
        setApiKeySet(!!(res && res.api_key));
      } else {
        setApiKeySet(false);
      }
    } catch {
      setApiKeySet(false);
    }
    setCheckingApiKey(false);
  };

  React.useEffect(() => {
    fetchApiKey();
    // eslint-disable-next-line
  }, []);

  // Handler for setting API key (calls backend)
  const handleSetApiKey = async (key) => {
    if (window.api && window.api.setApiKey) {
      await window.api.setApiKey(key);
      fetchApiKey();
    }
  };

  // Handler for logging out (clearing API key)
  const handleLogout = async () => {
    if (window.api && window.api.setApiKey) {
      await window.api.setApiKey("");
      fetchApiKey();
    }
    navigate("/");
  };

  React.useEffect(() => {
    if (items.length > 0) {
      if (!window.api || !window.api.getPurchaseRequests) {
        setOnOrderMap({});
        return;
      }
      window.api.getPurchaseRequests(true, undefined)
        .then((res) => {
          setActivePRs(res);
          const map = {};
          res.forEach((pr) => {
            pr.items.forEach((item) => {
              const prodName = item["Product Name"] || item.name;
              const qty = item["No. to Order"] || item.no_to_order || 0;
              map[prodName] = (map[prodName] || 0) + qty;
            });
          });
          setOnOrderMap(map);
        })
        .catch(() => setOnOrderMap({}));
    } else {
      setOnOrderMap({});
    }
  }, [items]);

  React.useEffect(() => {
    // Fetch products from backend on mount
    if (!window.api || !window.api.getAllProducts) {
      setProducts([]);
      return;
    }
    window.api.getAllProducts()
      .then(res => {
        setProducts(res);
        
        // Check if we have pre-selected items from Master List
        const preSelectedItems = location.state?.preSelectedItems;
        const fromMasterList = location.state?.fromMasterList;
        
        if (fromMasterList && preSelectedItems && preSelectedItems.length > 0) {
          console.log('Pre-selected items from Master List:', preSelectedItems);
          setItems(preSelectedItems);
          setSelectedRows(preSelectedItems.map((_, idx) => idx));
          setError("");
        } else {
          setItems([]);
          setSelectedRows([]);
          setError("");
        }
      })
      .catch(() => setProducts([]));
  }, [location.state]);

  const handleNoToOrderChange = (idx, newValue) => {
    setItems((items) =>
      items.map((item, i) =>
        i === idx ? { ...item, ["No. to Order"]: Number(newValue) } : item
      )
    );
  };

  const handleSelectRow = (idx) => {
    setSelectedRows((rows) =>
      rows.includes(idx) ? rows.filter((i) => i !== idx) : [...rows, idx]
    );
  };

  const handleDelete = () => {
    setItems((items) => items.filter((_, i) => !selectedRows.includes(i)));
    setSelectedRows([]);
  };


  // No handleSubmit needed for PR creation only

  // Create Purchase Request for selected items
  const handleCreatePR = async () => {
    if (selectedRows.length === 0) {
      alert("Please select at least one item to create a purchase request.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!window.api || !window.api.createPurchaseRequest) throw new Error("createPurchaseRequest not available");
      // Combine items with the same product (by Product Name and Supplier Name)
      const selectedItems = selectedRows.map((i) => items[i]);
      const combinedMap = {};
      selectedItems.forEach(item => {
        const prodName = item["Product Name"] || item.name;
        const supplier = item["Supplier Name"] || item.supplier_name || "";
        const key = prodName + "__" + supplier;
        if (!combinedMap[key]) {
          combinedMap[key] = { ...item };
        } else {
          // Sum No. to Order
          const prev = combinedMap[key]["No. to Order"] ?? combinedMap[key].no_to_order ?? 0;
          const add = item["No. to Order"] ?? item.no_to_order ?? 0;
          combinedMap[key]["No. to Order"] = Number(prev) + Number(add);
        }
      });
      const prItems = Object.values(combinedMap);
      await window.api.createPurchaseRequest({ items: prItems });
      alert("Purchase Request created successfully!");
      // Optionally refresh PR map after creation
      if (window.api.getPurchaseRequests) {
        const res = await window.api.getPurchaseRequests(true, undefined);
        const map = {};
        res.forEach((pr) => {
          pr.items.forEach((item) => {
            const prodName = item["Product Name"] || item.name;
            const qty = item["No. to Order"] || item.no_to_order || 0;
            map[prodName] = (map[prodName] || 0) + qty;
          });
        });
        setOnOrderMap(map);
      }
      navigate("/generate-supplier-files");
    } catch (err) {
      setError("Failed to create purchase request.");
    }
    setLoading(false);
  };

  // --- Add Line Feature --- //
  // Fetch product options async from backend
  const loadProductOptions = async (inputValue, callback) => {
    try {
      if (!window.api || !window.api.getProductOptions) throw new Error("getProductOptions not available");
      const resp = await window.api.getProductOptions(inputValue || "");
      callback(resp || []);
    } catch (err) {
      callback([]);
    }
  };

  // When a product is selected in the add row
  const handleProductSelect = (selectedOption) => {
    setAddRow(row => ({
      ...row,
      product: selectedOption ? selectedOption.data : null,
      noToOrder: ""
    }));
  };

  // Handle entering "No. to Order" in the add row
  const handleAddRowNoToOrder = (e) => {
    setAddRow(row => ({
      ...row,
      noToOrder: e.target.value
    }));
  };

  // Add the new row to items
  const handleAddRowSubmit = (e) => {
    if (e) e.preventDefault();
    if (!addRow.product || !addRow.noToOrder || Number(addRow.noToOrder) <= 0) return;
    // Flatten the structure for backend
    const prod = addRow.product;
    const item = {
      "Id": prod.cliniko_id || prod.id, // both possible
      "Product Name": prod.name,
      "Supplier Name": prod.supplier_name,
      "Stock": prod.stock,
      "Reorder Level": prod.reorder_level,
      ["No. to Order"]: Number(addRow.noToOrder)
    };
    setItems(prev => [...prev, item]);
    setAddingRow(false);
    setAddRow({ product: null, noToOrder: "" });
    setSelectedRows(prev => [...prev, items.length]);
  };

  // Handle Add Line button click with scroll to bottom
  const handleAddLineClick = () => {
    setAddingRow(true);
    // Scroll to bottom after a short delay to allow the row to render
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  // Run Stock Comparison (populate items)
  const handleRunStockComparison = () => {
    setError("");
    setLoading(true);
    setItems([]);
    setSelectedRows([]);
    // Filter products based on includeNegative and calculate No. to Order
    const filtered = products.filter(p => {
      if (!includeNegative && p.stock < 0) return false;
      return (p.reorder_level - p.stock > 0);
    });
    const processedItems = filtered.map(i => ({
      ...i,
      ["No. to Order"]: Number(i.reorder_level - i.stock)
    }));
    setItems(processedItems);
    setSelectedRows(processedItems.map((_, idx) => idx));
    setLoading(false);
  };



  return (
    <>
      <ApiKeyModal
        open={!apiKeySet && !checkingApiKey}
        isAdmin={true}
        onGoToAdmin={() => navigate("/admin/users")}
        onLogout={handleLogout}
        onSetApiKey={handleSetApiKey}
      />
      <div className="center-card">
        <img
          src={"goodlife.png"}
          alt="The Good Life Clinic"
          style={{
            width: 220,
            maxWidth: "70%",
            display: "block",
            margin: "0 auto 38px auto",
            boxShadow: "0 6px 26px 2px rgba(0,0,0,0.08)",
            borderRadius: "18px",
            background: "#fff",
          }}
        />
        <div style={{ marginBottom: 38 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16, color: "#006bb6" }}>
            Create Purchase Requests
          </h2>
          {location.state?.fromMasterList ? (
            <p
              style={{
                fontSize: "1.13em",
                margin: 0,
                color: "#232323",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              ✅ <strong>{items.length} items selected</strong> from Master Stock List and ready to order!
            </p>
          ) : (
            <p
              style={{
                fontSize: "1.13em",
                margin: 0,
                color: "#232323",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              Click Run Stock Comparison to determine what is below the reorder points.
            </p>
          )}
        </div>
        {!location.state?.fromMasterList && (
          <>
            <button
              style={{
                background: "#006bb6",
                color: "#fff",
                fontWeight: 600,
                padding: "10px 28px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "1rem",
                marginBottom: 24
              }}
              onClick={() => navigate("/master-list")}
            >
              Go to Master Stock List
            </button>
            <form>
              <label
                style={{
                  marginTop: 8,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeNegative}
                  onChange={(e) => setIncludeNegative(e.target.checked)}
                />
                Include negative stock
              </label>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => {
                    // Clear any existing data and start fresh
                    setItems([]);
                    setSelectedRows([]);
                    setError("");
                    // Start with a new row for adding items
                    setAddingRow(true);
                    setAddRow({ product: null, noToOrder: "" });
                    // Scroll to bottom after a short delay to allow the row to render
                    setTimeout(() => {
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }, 100);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "background 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#218838";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "#28a745";
                  }}
                >
                  Start New Purchase Request
                </button>
                <button
                  type="button"
                  disabled={loading || products.length === 0 || !apiKeySet}
                  onClick={handleRunStockComparison}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    opacity: products.length === 0 || loading || !apiKeySet ? 0.48 : 1,
                    cursor: products.length === 0 || loading || !apiKeySet ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "16px",
                    transition: "background 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && products.length > 0 && apiKeySet) {
                      e.target.style.background = "#0056b3";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && products.length > 0 && apiKeySet) {
                      e.target.style.background = "#007bff";
                    }
                  }}
                >
                  {loading ? "Processing..." : "Run Stock Reorder Point Comparison"}
                </button>
              </div>
            </form>
          </>
        )}
        {(items.length > 0 || addingRow) && (
            <>
              <h4 style={{ marginTop: 36, textAlign: "center" }}>Items to Reorder</h4>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                marginTop: "20px",
                background: "#fff"
              }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ backgroundColor: "#f3f7fb" }}>
                    <th style={{ 
                      padding: "12px 8px", 
                      border: "1px solid #dee2e6", 
                      textAlign: "center", 
                      width: 40,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#f3f7fb",
                      zIndex: 11,
                      fontWeight: 600,
                      color: "#246aa8"
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedRows.length === items.length}
                        onChange={() => {
                          if (selectedRows.length === items.length) {
                            setSelectedRows([]);
                          } else {
                            setSelectedRows(items.map((_, idx) => idx));
                          }
                        }}
                      />
                    </th>
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
                    }}>Stock</th>
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
                    }}>On Order</th>
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
                    }}>Total Stock</th>
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
                    }}>Reorder Level</th>
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
                    }}>No. to Order</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const prodName = item["Product Name"] || item.name;
                    const supplier = item["Supplier Name"] || item.supplier_name;
                    const stock = item["Stock"] ?? item.stock ?? 0;
                    const reorderLevel = item["Reorder Level"] ?? item.reorder_level ?? 0;
                    const noToOrder = item["No. to Order"] ?? item.no_to_order ?? 0;
                    const onOrderQty = onOrderMap[prodName] || 0;
                    const totalStock = (parseInt(stock, 10) || 0) + (parseInt(onOrderQty, 10) || 0);
                    return (
                      <tr key={idx} style={{ 
                        backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb"
                      }}>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(idx)}
                            onChange={() => handleSelectRow(idx)}
                          />
                        </td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6" 
                        }}>{prodName}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6" 
                        }}>{supplier}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>{stock}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>{onOrderQty}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>{totalStock}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>{reorderLevel}</td>
                        <td style={{ 
                          padding: "12px 8px", 
                          border: "1px solid #dee2e6", 
                          textAlign: "center" 
                        }}>
                          <input
                            type="number"
                            value={noToOrder}
                            min={0}
                            style={{ width: 65, textAlign: "center" }}
                            onChange={(e) => handleNoToOrderChange(idx, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {addingRow && (
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6" 
                      }}></td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6",
                        minWidth: 220, 
                        maxWidth: 240, 
                        width: 240 
                      }}>
                        <AsyncSelect
                          cacheOptions
                          loadOptions={loadProductOptions}
                          value={
                            addRow.product
                              ? {
                                  label: addRow.product.name,
                                  value: addRow.product.id,
                                  data: addRow.product
                                }
                              : null
                          }
                          onChange={handleProductSelect}
                          placeholder="Select Product..."
                          styles={{
                            container: base => ({
                              ...base,
                              minWidth: 200,
                              maxWidth: 240,
                              width: "100%"
                            }),
                            menu: base => ({
                              ...base,
                              zIndex: 9999
                            }),
                            control: base => ({
                              ...base,
                              minHeight: 32,
                              fontSize: 15
                            })
                          }}
                          isClearable
                          menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                          menuPlacement="auto"
                        />
                      </td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6" 
                      }}>{addRow.product ? addRow.product.supplier_name : "-"}</td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6", 
                        textAlign: "center" 
                      }}>{addRow.product ? addRow.product.stock : "-"}</td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6", 
                        textAlign: "center" 
                      }}>{addRow.product ? (onOrderMap[addRow.product.name] || 0) : "-"}</td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6", 
                        textAlign: "center" 
                      }}>{addRow.product ? ((parseInt(addRow.product.stock, 10) || 0) + (onOrderMap[addRow.product.name] || 0)) : "-"}</td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6", 
                        textAlign: "center" 
                      }}>{addRow.product ? addRow.product.reorder_level : "-"}</td>
                      <td style={{ 
                        padding: "12px 8px", 
                        border: "1px solid #dee2e6", 
                        verticalAlign: "top", 
                        width: 90, 
                        minWidth: 90 
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <input
                            type="number"
                            min={1}
                            value={addRow.noToOrder}
                            onChange={handleAddRowNoToOrder}
                            style={{ width: 65, textAlign: "center", marginBottom: 2 }}
                            disabled={!addRow.product}
                            placeholder="Qty"
                          />
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 2 }}>
                            <button
                              type="button"
                              onClick={handleAddRowSubmit}
                              style={{
                                background: "#eafbe7",
                                border: "1px solid #14B800",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                marginRight: 1,
                                cursor: addRow.product && addRow.noToOrder > 0 ? "pointer" : "not-allowed",
                                display: "flex",
                                alignItems: "center"
                              }}
                              disabled={!addRow.product || !addRow.noToOrder}
                            >
                              <TickIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingRow(false);
                                setAddRow({ product: null, noToOrder: "" });
                              }}
                              style={{
                                background: "#fff0f0",
                                border: "1px solid #FF4D4F",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center"
                              }}
                            >
                              <CrossIcon />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        {error && <div className="error-msg" style={{ marginTop: 28 }}>{error}</div>}
        
        {/* Floating Action Buttons */}
        {(items.length > 0 || addingRow) && (
          <>
            {/* Floating Delete Selected Button */}
            {selectedRows.length > 0 && (
              <div
                style={{
                  position: "fixed",
                  bottom: "180px",
                  right: "24px",
                  zIndex: 1000
                }}
              >
                <button
                  onClick={handleDelete}
                  style={{
                    background: "#ff5b5b",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50px",
                    padding: "12px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(255, 91, 91, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    minWidth: "160px",
                    justifyContent: "center"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#e54545";
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(255, 91, 91, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "#ff5b5b";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(255, 91, 91, 0.3)";
                  }}
                >
                  Delete Selected
                </button>
              </div>
            )}

            {/* Floating Add Line Button */}
            {!addingRow && (
              <div
                style={{
                  position: "fixed",
                  bottom: selectedRows.length > 0 ? "250px" : "180px",
                  right: "24px",
                  zIndex: 1000,
                  transition: "bottom 0.3s ease"
                }}
              >
                <button
                  onClick={handleAddLineClick}
                  style={{
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50px",
                    padding: "12px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(40, 167, 69, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    minWidth: "140px",
                    justifyContent: "center"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#218838";
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(40, 167, 69, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "#28a745";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(40, 167, 69, 0.3)";
                  }}
                >
                  Add Line
                </button>
              </div>
            )}

            {/* Floating Create Purchase Request Button */}
            <div
              style={{
                position: "fixed",
                bottom: "110px",
                right: "24px",
                zIndex: 1000
              }}
            >
              <button
                onClick={handleCreatePR}
                disabled={loading || selectedRows.length === 0}
                style={{
                  background: selectedRows.length === 0 ? "#ccc" : "#006bb6",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50px",
                  padding: "16px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: selectedRows.length === 0 ? "not-allowed" : "pointer",
                  boxShadow: selectedRows.length === 0 ? "none" : "0 4px 12px rgba(0, 107, 182, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  minWidth: "200px",
                  justifyContent: "center"
                }}
                onMouseEnter={(e) => {
                  if (selectedRows.length > 0) {
                    e.target.style.background = "#005a9a";
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(0, 107, 182, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedRows.length > 0) {
                    e.target.style.background = "#006bb6";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(0, 107, 182, 0.3)";
                  }
                }}
              >
                Create Purchase Request
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CreatePurchaseRequests;
