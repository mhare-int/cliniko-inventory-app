import React, { useState, useEffect, useRef } from 'react';

// RestoreSuppliersPopup component
function RestoreSuppliersPopup({ 
  suppliers, 
  inactiveSuppliers, 
  inactiveList, // optional: full supplier objects
  onClose, 
  onRestore 
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [supplierProductCounts, setSupplierProductCounts] = useState({});
  
  // If a full inactive list is provided prefer that, otherwise fall back
  // to filtering the suppliers array by the inactive ID set.
  const inactiveSuppliersData = Array.isArray(inactiveList) && inactiveList.length > 0
    ? inactiveList
    : suppliers.filter(supplier => inactiveSuppliers.has(supplier.id));

  // Load product counts for inactive suppliers
  useEffect(() => {
    const loadProductCounts = async () => {
      try {
        // Get all products and count how many belong to each inactive supplier
        const allProductsResult = await window.api.getAllProducts();
        if (allProductsResult && !allProductsResult.error) {
          const counts = {};
          
          // Initialize counts for all inactive suppliers
          inactiveSuppliersData.forEach(supplier => {
            counts[supplier.id] = 0;
          });
          
          // Count products for each supplier
          allProductsResult.forEach(product => {
            if (product.supplier_id && counts.hasOwnProperty(product.supplier_id)) {
              counts[product.supplier_id]++;
            }
          });
          
          setSupplierProductCounts(counts);
        }
      } catch (err) {
        console.error('Error loading product counts:', err);
        // Set all counts to 0 on error
        const counts = {};
        inactiveSuppliersData.forEach(supplier => {
          counts[supplier.id] = 0;
        });
        setSupplierProductCounts(counts);
      }
    };

    if (inactiveSuppliersData.length > 0) {
      loadProductCounts();
    }
  }, [inactiveSuppliersData.length]);

  // Debug: log the inactive supplier objects the popup will render
  useEffect(() => {
    try {
      console.debug('[SuppliersManagement] RestoreSuppliersPopup inactiveSuppliersData count:', inactiveSuppliersData.length);
      if (inactiveSuppliersData.length > 0) {
        console.debug('[SuppliersManagement] Sample inactive supplier:', inactiveSuppliersData[0]);
      }
    } catch (e) {
      console.error('Error logging inactiveSuppliersData:', e);
    }
  }, [inactiveSuppliersData]);

  const handleSelectAll = () => {
    if (selectedIds.length === inactiveSuppliersData.length && inactiveSuppliersData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inactiveSuppliersData.map(s => s.id));
    }
  };

  const handleSelectSupplier = (supplierId) => {
    setSelectedIds(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
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
            Restore Inactive Suppliers ({inactiveSuppliersData.length})
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
              checked={selectedIds.length === inactiveSuppliersData.length && inactiveSuppliersData.length > 0}
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
          {inactiveSuppliersData.map(supplier => (
            <div
              key={supplier.id}
              style={{
                padding: 12,
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                gap: 12,
                backgroundColor: selectedIds.includes(supplier.id) ? "#f0f8ff" : "white"
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(supplier.id)}
                onChange={() => handleSelectSupplier(supplier.id)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{supplier.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Email: {supplier.email || "N/A"} | Contact: {supplier.contact_name || "N/A"} | Products: {supplierProductCounts[supplier.id] !== undefined ? supplierProductCounts[supplier.id] : "Loading..."}
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

function SuppliersManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inactiveSuppliers, setInactiveSuppliers] = useState(new Set());
  const [inactiveSuppliersList, setInactiveSuppliersList] = useState([]);
  const [showRestorePopup, setShowRestorePopup] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactName: '',
    specialInstructions: '',
    accountNumber: ''
  });
  const editFormRef = useRef(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getAllSuppliers();
  console.debug('[SuppliersManagement] getAllSuppliers result:', result && result.length ? `${result.length} suppliers` : result);
      // Validate response
      if (!result) {
        setSuppliers([]);
        setError('getAllSuppliers returned no data');
      } else if (result.error) {
        setSuppliers([]);
        setError(result.error);
      } else if (!Array.isArray(result)) {
        setSuppliers([]);
        setError('Unexpected response from getAllSuppliers');
      } else {
        setSuppliers(result);
        // Load inactive suppliers and populate the set (tolerant)
        try {
          if (window.api && window.api.getInactiveSuppliers) {
            const inactiveResult = await window.api.getInactiveSuppliers();
    console.debug('[SuppliersManagement] getInactiveSuppliers result:', Array.isArray(inactiveResult) ? `${inactiveResult.length} inactive` : inactiveResult);
            if (inactiveResult && !inactiveResult.error && Array.isArray(inactiveResult) && inactiveResult.length > 0) {
              setInactiveSuppliers(new Set(inactiveResult.map(s => s.id)));
              setInactiveSuppliersList(inactiveResult);
            } else {
              setInactiveSuppliers(new Set());
              setInactiveSuppliersList([]);
            }
          }
        } catch (inactiveErr) {
          console.error('Failed to load inactive suppliers:', inactiveErr);
          setInactiveSuppliers(new Set());
          setInactiveSuppliersList([]);
        }
      }
    } catch (err) {
      console.error('Error in loadSuppliers:', err);
      setSuppliers([]);
      setInactiveSuppliers(new Set());
      setError(err && err.message ? `Failed to load suppliers: ${err.message}` : 'Failed to load suppliers');
    }
    setLoading(false);
  };

  const handleOpenRestorePopup = () => {
    console.debug('[SuppliersManagement] Opening Restore popup - inactiveSuppliers.size:', inactiveSuppliers.size, 'inactiveSuppliersList.length:', inactiveSuppliersList.length);
    setShowRestorePopup(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      let result;
      if (editingSupplier) {
        result = await window.api.updateSupplier(
          editingSupplier.id,
          formData.name,
          formData.email,
          formData.contactName,
          formData.specialInstructions,
          formData.accountNumber
        );
      } else {
        result = await window.api.addSupplier(
          formData.name,
          formData.email,
          formData.contactName,
          formData.specialInstructions,
          formData.accountNumber
        );
      }
      
      if (result.error) {
        setError(result.error);
      } else {
        setFormData({ name: '', email: '', contactName: '', specialInstructions: '', accountNumber: '' });
        setEditingSupplier(null);
        setShowAddForm(false);
        loadSuppliers();
      }
    } catch (err) {
      setError('Failed to save supplier');
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      email: supplier.email || '',
      contactName: supplier.contact_name || '',
      specialInstructions: supplier.special_instructions || supplier.comments || '',
      accountNumber: supplier.account_number || ''
    });
    setShowAddForm(true);
    
    // Scroll to the edit form after a short delay to ensure it's rendered
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await window.api.deleteSupplier(id);
      if (result.error) {
        setError(`Error: ${result.error}`);
      } else {
        setError(''); // Clear any previous errors
        await loadSuppliers(); // Refresh the list (this also loads inactive suppliers)
      }
    } catch (err) {
      setError(`Error deleting supplier: ${err.message}`);
    }
  };  const handleCancel = () => {
    setFormData({ name: '', email: '', contactName: '', specialInstructions: '', accountNumber: '' });
    setEditingSupplier(null);
    setShowAddForm(false);
    setError('');
  };

  const handleDeactivate = async (supplier) => {
    if (!window.confirm(`Are you sure you want to deactivate "${supplier.name}"? It will be hidden from the active list and can be restored from Manage Inactive Suppliers.`)) {
      return;
    }

    setError('');
    try {
      const result = await window.api.deactivateSupplier(supplier.id);
      if (result && result.error) {
        setError(`Failed to deactivate supplier: ${result.error}`);
        return;
      }

      // Refresh local state: reload suppliers (this also refreshes inactive list)
      await loadSuppliers();
    } catch (err) {
      console.error('Error deactivating supplier:', err);
      setError(err && err.message ? `Failed to deactivate supplier: ${err.message}` : 'Failed to deactivate supplier');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRestoreSuppliers = async (supplierIds) => {
    setError('');
    try {
      for (const supplierId of supplierIds) {
        const result = await window.api.reactivateSupplier(supplierId);
        if (result.error) {
          setError(`Failed to restore supplier: ${result.error}`);
          return;
        }
      }
      
      // Update local state
      setInactiveSuppliers(prev => {
        const newSet = new Set(prev);
        supplierIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      setShowRestorePopup(false);
      // Optionally reload all suppliers to ensure consistency
      loadSuppliers();
    } catch (err) {
      setError('Failed to restore suppliers');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading suppliers...</p>
      </div>
    );
  }

  // Filter suppliers based on search term and exclude inactive suppliers
  const filteredSuppliers = suppliers.filter(supplier => {
    // Skip inactive suppliers
    if (inactiveSuppliers.has(supplier.id)) return false;
    
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      (supplier.name && supplier.name.toLowerCase().includes(search)) ||
      (supplier.email && supplier.email.toLowerCase().includes(search)) ||
      (supplier.contact_name && supplier.contact_name.toLowerCase().includes(search)) ||
      (supplier.special_instructions && supplier.special_instructions.toLowerCase().includes(search)) ||
      (supplier.comments && supplier.comments.toLowerCase().includes(search))
    );
  });

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        marginBottom: '20px',
        gap: 18,
        minHeight: 48
      }}>
        <h2 style={{ 
          margin: 0, 
          color: '#006bb6', 
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          boxSizing: 'border-box'
        }}>
          Suppliers Management
        </h2>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search suppliers..."
          style={{
            padding: "8px 12px",
            borderRadius: 4,
            border: "1px solid #ccc",
            fontSize: "14px",
            width: 250,
            boxSizing: 'border-box',
            margin: 0,
            outline: 'none',
            height: 48,
            display: 'flex',
            alignItems: 'center'
          }}
        />
        <button
          onClick={() => {
            setShowAddForm(true);
            // Scroll to the form after a short delay to ensure it's rendered
            setTimeout(() => {
              if (editFormRef.current) {
                editFormRef.current.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'start',
                  inline: 'nearest'
                });
              }
            }, 100);
          }}
          style={{
            background: '#1867c0',
            color: '#fff',
            border: 'none',
            padding: '0 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 16,
            transition: 'all 0.2s',
            flex: 1,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          + Add Supplier
        </button>
      </div>

      {/* Inactive Suppliers Indicator - Separate line below */}
      {inactiveSuppliers.size > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "20px"
        }}>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
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
              height: 32,
              display: "flex",
              alignItems: "center",
              paddingLeft: 10,
              paddingRight: 10,
              boxSizing: "border-box"
            }}>
              📦 {inactiveSuppliers.size} supplier{inactiveSuppliers.size !== 1 ? 's' : ''} inactive
            </span>
            <button
              onClick={handleOpenRestorePopup}
              style={{
                background: "#856404",
                color: "white",
                border: "none",
                borderRadius: 4,
                fontSize: 9,
                cursor: "pointer",
                fontWeight: 600,
                whiteSpace: "nowrap",
                padding: "0 6px",
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box"
              }}
            >
              Manage Inactive Suppliers
            </button>
          </div>
        </div>
      )}

      {searchTerm && (
        <div style={{
          color: '#6b7280',
          fontSize: '14px',
          marginBottom: '16px',
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: 6,
          border: '1px solid #e2e8f0'
        }}>
          {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} found 
          {searchTerm ? ` matching "${searchTerm}"` : ''}
        </div>
      )}

      {error && (
        <div style={{
          color: '#e53e3e',
          background: '#fed7d7',
          border: '1px solid #feb2b2',
          padding: '12px',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {showAddForm && (
        <div 
          ref={editFormRef}
          style={{
            background: '#fff',
            border: '2px solid #e1e5e9',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}
        >
          <h3 style={{ margin: '0 0 25px 0', color: '#333', fontSize: '20px' }}>
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                Supplier Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                Account Number
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            
            <div style={{ marginBottom: 25 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                Special Instructions
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 16,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
            </div>
            
            {editingSupplier && (
              <div style={{ marginBottom: 25 }}>
                <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
                  How Added
                </label>
                <input
                  type="text"
                  value={editingSupplier.source || 'Manual'}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e1e5e9',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#f3f4f6',
                    color: editingSupplier.source === 'Auto-synced from Cliniko' ? '#059669' : '#6b7280',
                    fontStyle: editingSupplier.source === 'Auto-synced from Cliniko' ? 'italic' : 'normal'
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  This field shows how the supplier was added to the system and cannot be changed.
                </small>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 16,
                  minWidth: 140,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
              </button>
              
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  padding: '14px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 16,
                  minWidth: 100,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#4b5563'}
                onMouseOut={(e) => e.target.style.background = '#6b7280'}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {filteredSuppliers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280',
          fontSize: '16px'
        }}>
          {searchTerm ? 
            `No suppliers found matching "${searchTerm}". Try a different search term or clear the search.` :
            'No suppliers found. Click "Add Supplier" to get started.'
          }
        </div>
      ) : (
        <div style={{ 
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f7fb' }}>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Supplier Name
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Email
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Contact Name
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Account Number
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Special Instructions
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  Source
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  color: '#246aa8',
                  borderBottom: '1px solid #e2e8f0',
                  minWidth: '140px',
                  width: '140px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier, index) => (
                <tr key={supplier.id} style={{ 
                  borderBottom: index < filteredSuppliers.length - 1 ? '1px solid #e2e8f0' : 'none'
                }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    {supplier.name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {supplier.email || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {supplier.contact_name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {supplier.account_number || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '200px' }}>
                    <div style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {supplier.special_instructions || supplier.comments || '-'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '140px' }}>
                    <div style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: supplier.source === 'Auto-synced from Cliniko' ? '#059669' : '#6b7280',
                      fontStyle: supplier.source === 'Auto-synced from Cliniko' ? 'italic' : 'normal'
                    }}>
                      {supplier.source || 'Manual'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      justifyContent: 'center',
                      height: 32,
                      width: '100%'
                    }}>
                      <button
                        onClick={() => handleEdit(supplier)}
                        style={{
                          background: '#006bb6',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          boxSizing: 'border-box',
                          margin: 0,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(supplier)}
                        style={{
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          boxSizing: 'border-box',
                          margin: 0,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRestorePopup && (
        <RestoreSuppliersPopup
          suppliers={suppliers}
          inactiveSuppliers={inactiveSuppliers}
          inactiveList={inactiveSuppliersList}
          onClose={() => setShowRestorePopup(false)}
          onRestore={handleRestoreSuppliers}
        />
      )}
    </div>
  );
}

export default SuppliersManagement;
