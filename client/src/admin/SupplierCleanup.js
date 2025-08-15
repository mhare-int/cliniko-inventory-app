import React, { useState, useEffect } from 'react';

export default function SupplierCleanup() {
  const [usageSummary, setUsageSummary] = useState(null);
  const [inactiveSuppliers, setInactiveSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showInactiveSection, setShowInactiveSection] = useState(false);
  const [reactivating, setReactivating] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, inactive] = await Promise.all([
        window.api.getSupplierUsageSummary(),
        window.api.getInactiveSuppliers()
      ]);
      
      if (summary.error) {
        setMessage(`Error loading summary: ${summary.error}`);
      } else {
        setUsageSummary(summary);
      }
      
      if (inactive.error) {
        setMessage(`Error loading inactive suppliers: ${inactive.error}`);
      } else {
        setInactiveSuppliers(inactive);
        // Auto-show inactive section if there are inactive suppliers
        if (inactive.length > 0 && !showInactiveSection) {
          setShowInactiveSection(true);
        }
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSupplier = async (supplierId, supplierName) => {
    if (!window.confirm(`Are you sure you want to reactivate "${supplierName}"? This will mark it as active again.`)) {
      return;
    }

    setReactivating(prev => ({ ...prev, [supplierId]: true }));
    
    try {
      // Call the backend to reactivate the supplier
      const result = await window.api.reactivateSupplier(supplierId);
      
      if (result.error) {
        setMessage(`Error reactivating supplier: ${result.error}`);
      } else {
        setMessage(`Successfully reactivated "${supplierName}"`);
        // Reload data to show updated status
        await loadData();
      }
    } catch (err) {
      setMessage(`Error reactivating supplier: ${err.message}`);
    } finally {
      setReactivating(prev => ({ ...prev, [supplierId]: false }));
    }
  };

  const handleCleanup = async (forceDelete = false) => {
    if (inactiveSuppliers.length === 0) {
      setMessage('No inactive suppliers to clean up.');
      return;
    }

    const confirmMessage = forceDelete 
      ? `Are you sure you want to FORCE DELETE ${inactiveSuppliers.length} inactive suppliers? This will delete them even if they have products or purchase history. This action cannot be undone.`
      : `Are you sure you want to delete ${inactiveSuppliers.length} inactive suppliers? Only suppliers with no products or purchase history will be deleted.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.deleteInactiveSuppliers(forceDelete);
      
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage(result.message);
        // Reload data to show updated counts
        await loadData();
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>🧹 Supplier Management</h2>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        border: '1px solid #2196f3', 
        borderRadius: '4px', 
        padding: '15px', 
        marginBottom: '20px' 
      }}>
        <h3>ℹ️ How it works:</h3>
        <ul>
          <li><strong>Active suppliers</strong>: Found in your latest Cliniko product sync</li>
          <li><strong>Inactive suppliers</strong>: Not found in Cliniko (may have been removed or renamed)</li>
          <li><strong>Reactivate</strong>: Manually mark inactive suppliers as active again</li>
          <li><strong>Safe cleanup</strong>: Only deletes inactive suppliers with no products or purchase history</li>
          <li><strong>Force cleanup</strong>: Deletes ALL inactive suppliers (use with caution!)</li>
        </ul>
      </div>

      {message && (
        <div style={{ 
          backgroundColor: message.includes('Error') ? '#ffebee' : '#e8f5e8', 
          border: `1px solid ${message.includes('Error') ? '#f44336' : '#4caf50'}`, 
          borderRadius: '4px', 
          padding: '10px', 
          marginBottom: '20px' 
        }}>
          {message}
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {usageSummary && (
            <div style={{ marginBottom: '20px' }}>
              <h3>📊 Supplier Status Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ 
                  backgroundColor: '#e8f5e8', 
                  border: '1px solid #4caf50', 
                  borderRadius: '8px', 
                  padding: '15px',
                  textAlign: 'center'
                }}>
                  <h4 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>✅ Active Suppliers</h4>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                    {usageSummary.active.count}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    ({usageSummary.active.with_products} with products)
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: usageSummary.inactive.count > 0 ? '#fff3e0' : '#f5f5f5', 
                  border: `1px solid ${usageSummary.inactive.count > 0 ? '#ff9800' : '#ccc'}`, 
                  borderRadius: '8px', 
                  padding: '15px',
                  textAlign: 'center',
                  cursor: usageSummary.inactive.count > 0 ? 'pointer' : 'default'
                }} onClick={() => usageSummary.inactive.count > 0 && setShowInactiveSection(!showInactiveSection)}>
                  <h4 style={{ color: usageSummary.inactive.count > 0 ? '#f57c00' : '#666', margin: '0 0 10px 0' }}>
                    ⚠️ Inactive Suppliers {usageSummary.inactive.count > 0 && (showInactiveSection ? '▼' : '▶')}
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: usageSummary.inactive.count > 0 ? '#f57c00' : '#666' }}>
                    {usageSummary.inactive.count}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    ({usageSummary.inactive.with_products} with products)
                  </div>
                  {usageSummary.inactive.count > 0 && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      Click to {showInactiveSection ? 'hide' : 'manage'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showInactiveSection && inactiveSuppliers.length > 0 && (
            <div style={{ 
              marginBottom: '20px',
              backgroundColor: '#fff8e1',
              border: '1px solid #ffa726',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>� Inactive Supplier Management</h3>
                <button 
                  onClick={() => setShowInactiveSection(false)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '18px', 
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ 
                backgroundColor: '#fff', 
                border: '1px solid #ddd', 
                borderRadius: '4px', 
                maxHeight: '400px', 
                overflowY: 'auto' 
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Supplier Name</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Products</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Purchase Requests</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Source</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveSuppliers.map(supplier => (
                      <tr key={supplier.id}>
                        <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                          <strong>{supplier.name}</strong>
                          {supplier.email && (
                            <div style={{ fontSize: '12px', color: '#666' }}>{supplier.email}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          <span style={{ 
                            backgroundColor: supplier.product_count > 0 ? '#e8f5e8' : '#f5f5f5',
                            color: supplier.product_count > 0 ? '#2e7d32' : '#666',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {supplier.product_count}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          <span style={{ 
                            backgroundColor: supplier.purchase_request_count > 0 ? '#e8f5e8' : '#f5f5f5',
                            color: supplier.purchase_request_count > 0 ? '#2e7d32' : '#666',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {supplier.purchase_request_count}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          <span style={{ 
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {supplier.source}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                          <button
                            onClick={() => handleReactivateSupplier(supplier.id, supplier.name)}
                            disabled={reactivating[supplier.id]}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: reactivating[supplier.id] ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              opacity: reactivating[supplier.id] ? 0.6 : 1
                            }}
                          >
                            {reactivating[supplier.id] ? '⏳' : '🔄'} Reactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => handleCleanup(false)}
                  disabled={loading}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#ff9800', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🧹 Safe Cleanup (Unused Only)
                </button>

                <button 
                  onClick={() => handleCleanup(true)}
                  disabled={loading}
                  style={{ 
                    padding: '8px 16px', 
                    backgroundColor: '#f44336', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ⚠️ Force Delete All
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button 
              onClick={loadData}
              disabled={loading}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#2196f3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              🔄 Refresh Data
            </button>

            {inactiveSuppliers.length > 0 && !showInactiveSection && (
              <button 
                onClick={() => setShowInactiveSection(true)}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: '#ff9800', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔧 Manage Inactive Suppliers ({inactiveSuppliers.length})
              </button>
            )}
          </div>

          {inactiveSuppliers.length === 0 && usageSummary && (
            <div style={{ 
              backgroundColor: '#e8f5e8', 
              border: '1px solid #4caf50', 
              borderRadius: '4px', 
              padding: '20px', 
              textAlign: 'center',
              marginTop: '20px'
            }}>
              <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>🎉 All Clean!</h3>
              <p style={{ margin: 0, color: '#666' }}>
                No inactive suppliers found. All suppliers are currently active in Cliniko.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
