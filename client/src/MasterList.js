
import React, { useEffect, useRef, useState } from "react";
import AsyncSelect from "react-select/async";
import { useNavigate } from "react-router-dom";

function MasterStockList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingLevels, setEditingLevels] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [fileInput, setFileInput] = useState(null);
  const [onOrderQuantities, setOnOrderQuantities] = useState({});

  const fileInputRef = useRef();

  const [productFilter, setProductFilter] = useState(null);
  const [supplierFilter, setSupplierFilter] = useState(null);

  const handleFileChange = (e) => {
    setFileInput(e.target.files[0]);
    setUploadMessage("");
  };

  const handleFakeButtonClick = () => {
    fileInputRef.current && fileInputRef.current.click();
  };

  const handleUploadClick = async () => {
    if (!fileInput) {
      setUploadMessage("Please select a file first.");
      return;
    }
    setUploading(true);
    setUploadMessage("");
    try {
      if (!window.api || !window.api.updateReorderLevelsFromFile) throw new Error("updateReorderLevelsFromFile not available");
      
      // Read file content as ArrayBuffer
      const arrayBuffer = await fileInput.arrayBuffer();
      const fileData = {
        name: fileInput.name,
        content: Array.from(new Uint8Array(arrayBuffer)), // Convert to regular array for IPC
        type: fileInput.type
      };
      
      const result = await window.api.updateReorderLevelsFromFile(fileData);
      setUploadMessage(result.message || "Upload successful.");
      fetchProducts();
    } catch (err) {
      setUploadMessage(err?.error || err?.message || "Upload failed. Please check your file.");
    }
    setUploading(false);
    setFileInput(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadTemplate = async () => {
    try {
      const result = await window.api.generateReorderLevelsTemplate();
      if (result.error) {
        setUploadMessage(result.error);
        return;
      }
      
      // Create blob and download file
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setUploadMessage("Template downloaded successfully!");
    } catch (err) {
      setUploadMessage("Failed to download template.");
      console.error("Template download error:", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Fetch products and purchase requests in parallel
      const [productsRes, pursRes] = await Promise.all([
        window.api.getAllProducts(),
        window.api.getPurchaseRequests(true, false) // active only
      ]);
      
      // Extract products array from API response
      const productsArray = productsRes || [];
      setProducts(productsArray);
      
      // Set up editing levels
      const levels = {};
      productsArray.forEach(p => {
        levels[p.cliniko_id] = p.reorder_level || 0;
      });
      setEditingLevels(levels);
      
      // Calculate on-order quantities for each product
      const onOrder = {};
      if (Array.isArray(pursRes)) {
        pursRes.forEach(pur => {
          if (pur.items && Array.isArray(pur.items)) {
            pur.items.forEach(item => {
              const prodName = item["Product Name"] || item.name;
              const qty = item["No. to Order"] || item.no_to_order || 0;
              onOrder[prodName] = (onOrder[prodName] || 0) + qty;
            });
          }
        });
      }
      setOnOrderQuantities(onOrder);
      
    } catch (error) {
      console.error("Failed to fetch products", error);
    }
    setLoading(false);
  };

  const loadProductOptions = async (inputValue) => {
    if (!inputValue) return [];
    try {
      if (!window.api || !window.api.getProductOptions) throw new Error("getProductOptions not available");
      const res = await window.api.getProductOptions(inputValue);
      return res.map(p => ({ label: p.label, value: String(p.value), data: p.data }));
    } catch {
      return [];
    }
  };

  const loadSupplierOptions = async (inputValue) => {
    if (!inputValue) return [];
    const suppliers = [...new Set(products.map(p => p.supplier_name).filter(Boolean))];
    const filtered = suppliers
      .filter(s => s.toLowerCase().includes(inputValue.toLowerCase()))
      .map(s => ({ label: s, value: s }));
    return filtered;
  };

  const filteredProducts = products.filter(p => {
    let matchesProduct = true;
    let matchesSupplier = true;

    if (productFilter) {
      matchesProduct = String(p.cliniko_id) === String(productFilter.value);
    }
    if (supplierFilter) {
      matchesSupplier = p.supplier_name === supplierFilter.value;
    }
    return matchesProduct && matchesSupplier;
  });

  const handleSelectRow = (cliniko_id) => {
    setSelectedIds(ids =>
      ids.includes(cliniko_id)
        ? ids.filter(id => id !== cliniko_id)
        : [...ids, cliniko_id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.cliniko_id));
    }
  };

  const handleReorderLevelChange = (cliniko_id, value) => {
    const intVal = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setEditingLevels(levels => ({ ...levels, [cliniko_id]: intVal }));
  };

  const handleReorderLevelBlur = async (id) => {
    const newLevel = editingLevels[id];
    try {
      if (!window.api || !window.api.updateProductReorderLevel) throw new Error("updateProductReorderLevel not available");
      await window.api.updateProductReorderLevel(id, newLevel);
      setProducts(products.map(p => p.cliniko_id === id ? { ...p, reorder_level: newLevel } : p));
      setEditingLevels(levels => ({ ...levels, [id]: newLevel }));
    } catch (err) {
      console.error('Failed to update reorder level', err);
      alert('Failed to update reorder level');
    }
  };

  const handleCreatePurchaseRequest = () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one product to create a purchase request.");
      return;
    }

    // Get all selected products - include them regardless of calculated need
    const selectedProducts = filteredProducts
      .filter(p => selectedIds.includes(p.cliniko_id))
      .map(p => {
        const reorderLevel = editingLevels[p.cliniko_id] || 0;
        const calculatedNeed = !reorderLevel ? 0 : Math.max(0, reorderLevel - (p.stock ?? 0));
        
        return {
          ...p,
          ["No. to Order"]: calculatedNeed > 0 ? calculatedNeed : 1 // Default to 1 if no calculated need
        };
      });

    // Navigate to Create Purchase Request with pre-selected items
    navigate("/create-pr", { 
      state: { 
        preSelectedItems: selectedProducts,
        fromMasterList: true 
      } 
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: "20px auto", padding: 20, background: "#fff", borderRadius: 8 }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>Master Stock List</h2>

      {/* Custom upload UI */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
        marginBottom: 20,
        justifyContent: "flex-start",
        flexWrap: "wrap"
      }}>
        {/* Choose File Button */}
        <button
          type="button"
          onClick={handleFakeButtonClick}
          style={{
            background: "#e8f0fe",
            color: "#1867c0",
            minWidth: 120,
            height: 44,
            borderRadius: 8,
            border: "1.5px solid #1867c0",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box"
          }}
        >
          Choose File
        </button>
        
        {/* Filename field */}
        <div style={{
          minWidth: 260,
          maxWidth: 400,
          height: 44,
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          fontSize: 16,
          color: fileInput ? "#222" : "#999",
          fontStyle: fileInput ? "normal" : "italic",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          background: "#f6fafd",
          borderRadius: 8,
          padding: "0 14px",
          border: "1.5px solid #e3e3e3",
          boxSizing: "border-box",
          userSelect: "text"
        }}>
          {fileInput ? fileInput.name : "No file chosen"}
        </div>
        
        {/* Upload Button */}
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          style={{
            padding: "0 32px",
            height: 44,
            fontSize: 16,
            fontWeight: 700,
            background: "#1867c0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(24,103,192,0.09)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 320,
            cursor: uploading ? "wait" : "pointer",
            transition: "background 0.2s",
            boxSizing: "border-box"
          }}
        >
          {uploading ? "Uploading..." : "Update Reorder Levels from File"}
        </button>
        
        {/* Small Template Button */}
        <button
          onClick={handleDownloadTemplate}
          style={{
            background: "#f0f9ff",
            color: "#0369a1",
            height: 36,
            borderRadius: 6,
            border: "1px solid #0369a1",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            boxSizing: "border-box"
          }}
        >
          📥 Template
        </button>
      </div>
      
      {/* Instructions and upload message */}
      <div style={{ marginBottom: 20 }}>
        {uploadMessage && (
          <div style={{ 
            marginBottom: 10,
            color: uploadMessage.includes("failed") || uploadMessage.includes("error") ? "red" : "green",
            fontWeight: 600,
            fontSize: 14
          }}>
            {uploadMessage}
          </div>
        )}
        <div style={{ 
          fontSize: 14, 
          color: "#666", 
          background: "#f8f9fa", 
          padding: "12px 16px", 
          borderRadius: 8,
          border: "1px solid #e9ecef"
        }}>
          <strong>How to use:</strong>
          <ol style={{ margin: "8px 0 0 20px", padding: 0 }}>
            <li>Click "Download Template" to get a CSV with all your current products</li>
            <li>Open the CSV file and update the "Reorder Level" column as needed</li>
            <li>Save the file and click "Choose File" to select it</li>
            <li>Click "Update Reorder Levels from File" to apply the changes</li>
          </ol>
          <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
            <strong>Supported formats:</strong> .csv, .xlsx, .xls
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
      />

      {/* Two AsyncSelects side by side */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <AsyncSelect
          cacheOptions
          loadOptions={loadProductOptions}
          defaultOptions
          value={productFilter}
          onChange={setProductFilter}
          placeholder="Search Product..."
          isClearable
          styles={{
            container: base => ({ ...base, flex: 1 }),
            menu: base => ({ ...base, zIndex: 1200 })
          }}
        />
        <AsyncSelect
          cacheOptions
          loadOptions={loadSupplierOptions}
          defaultOptions
          value={supplierFilter}
          onChange={setSupplierFilter}
          placeholder="Search Supplier..."
          isClearable
          styles={{
            container: base => ({ ...base, flex: 1 }),
            menu: base => ({ ...base, zIndex: 1200 })
          }}
        />
      </div>

      {loading && <p>Loading products...</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center", 
              width: 40,
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>
              <input
                type="checkbox"
                checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                onChange={handleSelectAll}
              />
            </th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Product Name</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Supplier</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Stock</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>On Order</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Reorder Level</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>No. to Order</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#999" }}>
                No products found.
              </td>
            </tr>
          )}

          {filteredProducts.map(p => {
            const reorderLevel = editingLevels[p.cliniko_id];
            // If reorderLevel is not set or is falsy (null, undefined, 0, ""), No. to Order should be 0
            const noToOrder = !reorderLevel ? 0 : Math.max(0, reorderLevel - (p.stock ?? 0));
            const isSelected = selectedIds.includes(p.cliniko_id);
            const onOrderQty = onOrderQuantities[p.name] || 0;

            return (
              <tr key={p.cliniko_id} style={{ backgroundColor: isSelected ? "#e6f0fa" : "transparent" }}>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectRow(p.cliniko_id)}
                  />
                </td>
                <td style={{ padding: 8, border: "1px solid #ccc" }}>{p.name}</td>
                <td style={{ padding: 8, border: "1px solid #ccc" }}>{p.supplier_name || "-"}</td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>{p.stock}</td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center", color: onOrderQty > 0 ? "#00a86b" : "#999" }}>
                  {onOrderQty}
                </td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>
                  <input
                    type="number"
                    min="0"
                    value={reorderLevel === 0 ? "" : reorderLevel}
                    onChange={e => handleReorderLevelChange(p.cliniko_id, e.target.value)}
                    onBlur={() => handleReorderLevelBlur(p.cliniko_id)}
                    style={{ width: 70, textAlign: "center", fontSize: 14 }}
                  />
                </td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>{noToOrder}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Floating Create Purchase Request Button */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1000
        }}
      >
        <button
          onClick={handleCreatePurchaseRequest}
          disabled={selectedIds.length === 0}
          style={{
            background: selectedIds.length === 0 ? "#ccc" : "#006bb6",
            color: "#fff",
            border: "none",
            borderRadius: "50px",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
            boxShadow: selectedIds.length === 0 ? "none" : "0 4px 12px rgba(0, 107, 182, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            minWidth: "200px",
            justifyContent: "center"
          }}
          onMouseEnter={(e) => {
            if (selectedIds.length > 0) {
              e.target.style.background = "#005a9a";
              e.target.style.transform = "translateY(-2px)";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedIds.length > 0) {
              e.target.style.background = "#006bb6";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          <span style={{ fontSize: "18px" }}>📝</span>
          Create Purchase Request ({selectedIds.length})
        </button>
      </div>
    </div>
  );
}

export default MasterStockList;
