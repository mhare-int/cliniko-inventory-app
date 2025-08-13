
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
  const [editingBarcodes, setEditingBarcodes] = useState({});
  const [hiddenProducts, setHiddenProducts] = useState(new Set());
  const [showRestorePopup, setShowRestorePopup] = useState(false);
  
  // Initialize with proper sorting - use a more robust approach
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

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

  // Force re-render when sort changes to ensure proper sorting
  useEffect(() => {
    // This effect ensures the component re-renders when sort state changes
  }, [sortField, sortDirection]);

  // Ensure proper initial sort when products are loaded
  useEffect(() => {
    if (products.length > 0) {
      // Force a proper initial sort by triggering the sort function
      setTimeout(() => {
        setSortField('name');
        setSortDirection('asc');
      }, 100);
    }
  }, [products]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Clear any cached data first
      setProducts([]);
      setEditingLevels({});
      setEditingBarcodes({});
      
      console.log(`[DEBUG Frontend] Fetching fresh products from API...`);
      
      // Fetch products and purchase requests in parallel
      const [productsRes, pursRes] = await Promise.all([
        window.api.getAllProducts(),
        window.api.getPurchaseRequests(true, false) // active only
      ]);
      
      // Extract products array from API response and ensure cliniko_ids are strings
      const productsArray = (productsRes || []).map(p => ({
        ...p,
        cliniko_id: String(p.cliniko_id) // Ensure precision preservation
      }));
      
      console.log(`[DEBUG Frontend] Fetched ${productsArray.length} products. Sample products:`, 
        productsArray.slice(0, 3).map(p => ({ cliniko_id: p.cliniko_id, name: p.name, id_type: typeof p.cliniko_id })));
      
      setProducts(productsArray);
      
      // Set up editing levels using string keys
      const levels = {};
      productsArray.forEach(p => {
        const idStr = String(p.cliniko_id);
        levels[idStr] = p.reorder_level || 0;
      });
      setEditingLevels(levels);
      
      // Initialize editable barcodes map using string keys
      const barcodes = {};
      productsArray.forEach(p => {
        const idStr = String(p.cliniko_id);
        barcodes[idStr] = p.barcode || '';
      });
      setEditingBarcodes(barcodes);
      
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
      
      // Ensure initial sort is properly applied
      setSortField('name');
      setSortDirection('asc');
      
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
    // First check if product is hidden (ensure string comparison)
    if (hiddenProducts.has(String(p.cliniko_id))) {
      return false;
    }
    
    let matchesProduct = true;
    let matchesSupplier = true;

    if (productFilter) {
      matchesProduct = String(p.cliniko_id) === String(productFilter.value);
    }
    if (supplierFilter) {
      matchesSupplier = p.supplier_name === supplierFilter.value;
    }
    return matchesProduct && matchesSupplier;
  }).sort((a, b) => {
    // Dynamic sorting based on sortField and sortDirection
    let aValue = '';
    let bValue = '';
    
    if (sortField === 'name') {
      // Clean and normalize the names for better sorting
      aValue = (a.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      bValue = (b.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    } else if (sortField === 'supplier_name') {
      aValue = (a.supplier_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      bValue = (b.supplier_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
    
    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSelectRow = (cliniko_id) => {
    const idStr = String(cliniko_id); // Ensure string key
    setSelectedIds(ids =>
      ids.includes(idStr)
        ? ids.filter(id => id !== idStr)
        : [...ids, idStr]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => String(p.cliniko_id))); // Ensure string IDs
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleReorderLevelChange = (cliniko_id, value) => {
    const idStr = String(cliniko_id); // Ensure string key
    const intVal = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setEditingLevels(levels => ({ ...levels, [idStr]: intVal }));
  };

  const handleReorderLevelBlur = async (id) => {
    // Ensure ID is treated as string to preserve precision
    const idStr = String(id);
    const newLevel = editingLevels[idStr];
    console.log(`[DEBUG Frontend] handleReorderLevelBlur called with id: ${idStr} (original: ${id}, type: ${typeof id}), newLevel: ${newLevel}`);
    
    try {
      if (!window.api || !window.api.updateProductReorderLevel) throw new Error("updateProductReorderLevel not available");
      console.log(`[DEBUG Frontend] Calling updateProductReorderLevel with id: ${idStr}, newLevel: ${newLevel}`);
      await window.api.updateProductReorderLevel(idStr, newLevel);
      setProducts(products.map(p => String(p.cliniko_id) === idStr ? { ...p, reorder_level: newLevel } : p));
      setEditingLevels(levels => ({ ...levels, [idStr]: newLevel }));
      console.log(`[DEBUG Frontend] Successfully updated reorder level for product ${idStr}`);
    } catch (err) {
      console.error(`[DEBUG Frontend] Failed to update reorder level for product ${idStr}:`, err);
      alert('Failed to update reorder level');
    }
  };

  const handleBarcodeChange = (cliniko_id, value) => {
    const idStr = String(cliniko_id); // Ensure string key
    setEditingBarcodes(prev => ({ ...prev, [idStr]: value }));
  };

  const handleBarcodeBlur = async (cliniko_id) => {
    const idStr = String(cliniko_id); // Ensure string key
    const newBarcode = editingBarcodes[idStr];
    try {
      if (!window.api || !window.api.updateProductBarcode) throw new Error('updateProductBarcode not available');
      const res = await window.api.updateProductBarcode(idStr, newBarcode || null);
      if (res && res.error) throw new Error(res.error);
      // reflect in local products array
      setProducts(prev => prev.map(p => String(p.cliniko_id) === idStr ? { ...p, barcode: newBarcode || null } : p));
      setEditingBarcodes(prev => ({ ...prev, [idStr]: newBarcode || null }));
    } catch (err) {
      console.error('Failed to update barcode', err);
      alert('Failed to update barcode');
    }
  };

  const handleHideProduct = (cliniko_id) => {
    const idStr = String(cliniko_id); // Ensure string key
    setHiddenProducts(prev => new Set([...prev, idStr]));
    // Also remove from selected if it was selected
    setSelectedIds(prev => prev.filter(id => id !== idStr));
  };

  const handleRestoreProducts = (productIds) => {
    setHiddenProducts(prev => {
      const newSet = new Set(prev);
      productIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    setShowRestorePopup(false);
  };

  const handleRemoveSelected = () => {
    if (selectedIds.length > 0) {
      setHiddenProducts(prev => new Set([...prev, ...selectedIds]));
      setSelectedIds([]); // Clear selection after removing
    }
  };

  const getHiddenProductsList = () => {
    return products.filter(p => hiddenProducts.has(String(p.cliniko_id))); // Ensure string comparison
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

      {/* Custom upload UI - Single horizontal line */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 20, minHeight: 48 }}>
        {/* Choose File Button - 28% */}
        <button
          type="button"
          onClick={handleFakeButtonClick}
          style={{
            background: "#e8f0fe",
            color: "#1867c0",
            padding: "0 16px",
            borderRadius: 4,
            border: "1px solid #1867c0",
            fontWeight: 600,
            fontSize: "1em",
            cursor: "pointer",
            boxSizing: "border-box",
            width: "28%",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          Choose File
        </button>
        
        {/* Filename field - 28% */}
        <span style={{
          fontSize: "1em",
          color: fileInput ? "#222" : "#999",
          fontStyle: fileInput ? "normal" : "italic",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          background: "#f6fafd",
          borderRadius: 4,
          border: "1px solid #ccc",
          boxSizing: "border-box",
          width: "28%",
          display: "flex",
          alignItems: "center",
          height: 48,
          paddingLeft: 12,
          paddingRight: 12
        }}>
          {fileInput ? fileInput.name : "No file chosen"}
        </span>
        
        {/* Upload Button - 18% */}
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          style={{
            padding: "0 16px",
            fontSize: "1em",
            fontWeight: 600,
            background: uploading ? "#999" : "#1867c0",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: uploading ? "wait" : "pointer",
            transition: "background 0.2s",
            boxSizing: "border-box",
            width: "18%",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {uploading ? "Uploading..." : "Update Reorder Levels from File"}
        </button>
        
        {/* Template Button - 26% (expanded from 13% + removed 13% refresh button) */}
        <button
          onClick={handleDownloadTemplate}
          style={{
            background: "#f0f9ff",
            color: "#0369a1",
            padding: "0 12px",
            borderRadius: 4,
            border: "1px solid #0369a1",
            fontWeight: 600,
            fontSize: "1em",
            cursor: "pointer",
            boxSizing: "border-box",
            width: "26%",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          📥 Template
        </button>
      </div>
      
      {/* Instructions and upload message */}
      <div style={{ marginBottom: 4 }}>
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

      {/* Action Bar - Above search bars, with remove selected (left) and hidden products (right) */}
      {(selectedIds.length > 0 || hiddenProducts.size > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", margin: 0, padding: 0, lineHeight: 1 }}>
        {/* Remove Selected Button - Left side */}
        <div style={{ flex: "0 0 auto" }}>
          {selectedIds.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "flex-end", // KEY: Perfect baseline alignment
              gap: 8,
              width: "fit-content"
            }}>
              <span style={{
                fontSize: 11,
                color: "#721c24",
                background: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: 4,
                fontWeight: 600,
                whiteSpace: "nowrap",
                height: 32, // Fixed height (number, not string)
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                paddingRight: 10,
                boxSizing: "border-box"
              }}>
                {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleRemoveSelected}
                style={{
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 9,
                  cursor: "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  padding: "0 6px", // Simplified padding
                  height: 32, // Same height as span
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box"
                }}
              >
                Remove Selected
              </button>
            </div>
          )}
        </div>

        {/* Hidden Products Indicator - Right side */}
        <div style={{ flex: "0 0 auto" }}>
          {hiddenProducts.size > 0 && (
            <div style={{
              display: "flex",
              alignItems: "flex-end", // KEY: Perfect baseline alignment
              gap: 8,
              width: "fit-content"
            }}>
              <span style={{
                fontSize: 11,
                color: "#856404",
                background: "#fff3cd",
                border: "1px solid #ffeaa7",
                borderRadius: 4,
                fontWeight: 600,
                whiteSpace: "nowrap",
                height: 32, // Fixed height (number, not string)
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                paddingRight: 10,
                boxSizing: "border-box"
              }}>
                📦 {hiddenProducts.size} product{hiddenProducts.size !== 1 ? 's' : ''} hidden
              </span>
              <button
                onClick={() => setShowRestorePopup(true)}
                style={{
                  background: "#856404",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 9,
                  cursor: "pointer",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  padding: "0 6px", // Simplified padding
                  height: 32, // Same height as span
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box"
                }}
              >
                Manage Hidden Items
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Two AsyncSelects side by side */}
      <div style={{ 
        display: "flex", 
        gap: 16, 
        marginTop: (selectedIds.length > 0 || hiddenProducts.size > 0) ? 4 : 8, 
        marginBottom: 20 
      }}>
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
              zIndex: 11,
              cursor: "pointer",
              userSelect: "none"
            }}
            onClick={() => handleSort('name')}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Product Name
                <span style={{ marginLeft: 4, fontSize: 12 }}>
                  {sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </div>
            </th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11,
              cursor: "pointer",
              userSelect: "none"
            }}
            onClick={() => handleSort('supplier_name')}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Supplier
                <span style={{ marginLeft: 4, fontSize: 12 }}>
                  {sortField === 'supplier_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </div>
            </th>
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
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc",
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Barcode</th>
            <th style={{ 
              padding: 8, 
              border: "1px solid #ccc", 
              textAlign: "center",
              width: 40,
              position: "sticky",
              top: 0,
              backgroundColor: "#f0f0f0",
              zIndex: 11
            }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#999" }}>
                No products found.
              </td>
            </tr>
          )}

          {filteredProducts.map(p => {
            const idStr = String(p.cliniko_id); // Ensure string key
            const reorderLevel = editingLevels[idStr];
            // If reorderLevel is not set or is falsy (null, undefined, 0, ""), No. to Order should be 0
            const noToOrder = !reorderLevel ? 0 : Math.max(0, reorderLevel - (p.stock ?? 0));
            const isSelected = selectedIds.includes(idStr);
            const onOrderQty = onOrderQuantities[p.name] || 0;

            return (
              <tr key={idStr} style={{ backgroundColor: isSelected ? "#e6f0fa" : "transparent" }}>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectRow(idStr)}
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
                    onChange={e => handleReorderLevelChange(idStr, e.target.value)}
                    onBlur={() => handleReorderLevelBlur(idStr)}
                    style={{ width: 70, textAlign: "center", fontSize: 14 }}
                  />
                </td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>{noToOrder}</td>
                <td style={{ padding: 8, border: "1px solid #ccc" }}>
                  <input
                    type="text"
                    value={editingBarcodes[idStr] ?? ''}
                    onChange={e => handleBarcodeChange(idStr, e.target.value)}
                    onBlur={() => handleBarcodeBlur(idStr)}
                    placeholder="Scan or type barcode"
                    style={{ width: 160, fontSize: 14 }}
                  />
                </td>
                <td style={{ padding: 8, border: "1px solid #ccc", textAlign: "center" }}>
                  <button
                    onClick={() => handleHideProduct(idStr)}
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      lineHeight: 1,
                      margin: "0 auto"
                    }}
                    title="Hide product from list"
                  >
                    ×
                  </button>
                </td>
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
      
      {/* Restore Products Popup */}
      {showRestorePopup && (
        <RestoreProductsPopup
          hiddenProducts={getHiddenProductsList()}
          onRestore={handleRestoreProducts}
          onClose={() => setShowRestorePopup(false)}
        />
      )}
    </div>
  );
}

// RestoreProductsPopup Component
function RestoreProductsPopup({ hiddenProducts, onRestore, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelectAll = () => {
    if (selectedIds.length === hiddenProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(hiddenProducts.map(p => p.cliniko_id));
    }
  };

  const handleSelectProduct = (cliniko_id) => {
    setSelectedIds(prev => 
      prev.includes(cliniko_id) 
        ? prev.filter(id => id !== cliniko_id)
        : [...prev, cliniko_id]
    );
  };

  const handleRestore = () => {
    if (selectedIds.length > 0) {
      onRestore(selectedIds);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: 8,
        padding: 24,
        maxWidth: 600,
        width: "90%",
        maxHeight: "80vh",
        overflow: "auto",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)"
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end", // KEY: Perfect baseline alignment
          justifyContent: "space-between",
          marginBottom: 20,
          borderBottom: "1px solid #eee",
          paddingBottom: 16,
          minHeight: 32
        }}>
          <h3 style={{ 
            margin: 0, 
            color: "#333", 
            height: 32,
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box"
          }}>
            Restore Hidden Products ({hiddenProducts.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "#666",
              height: 32,
              width: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              boxSizing: "border-box"
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 600, paddingLeft: 12 }}>
            <input
              type="checkbox"
              checked={selectedIds.length === hiddenProducts.length && hiddenProducts.length > 0}
              onChange={handleSelectAll}
            />
            Select All
          </label>
        </div>

        <div style={{ 
          maxHeight: 300, 
          overflowY: "auto", 
          border: "1px solid #ddd", 
          borderRadius: 4,
          marginBottom: 20
        }}>
          {hiddenProducts.map(product => (
            <div
              key={product.cliniko_id}
              style={{
                padding: 12,
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                gap: 12,
                backgroundColor: selectedIds.includes(product.cliniko_id) ? "#f0f8ff" : "white"
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(product.cliniko_id)}
                onChange={() => handleSelectProduct(product.cliniko_id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Supplier: {product.supplier_name || "N/A"} | Stock: {product.stock}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid #ddd",
              borderRadius: 4,
              background: "white",
              color: "#333",
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={selectedIds.length === 0}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: 4,
              background: selectedIds.length === 0 ? "#ccc" : "#28a745",
              color: "white",
              cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Restore Selected ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default MasterStockList;
