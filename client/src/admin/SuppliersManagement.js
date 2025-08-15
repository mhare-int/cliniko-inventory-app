import React, { useState, useEffect, useRef } from 'react';

function SuppliersManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactName: '',
    specialInstructions: ''
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
      if (result.error) {
        setError(result.error);
      } else {
        setSuppliers(result);
      }
    } catch (err) {
      setError('Failed to load suppliers');
    }
    setLoading(false);
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
          formData.specialInstructions
        );
      } else {
        result = await window.api.addSupplier(
          formData.name,
          formData.email,
          formData.contactName,
          formData.specialInstructions
        );
      }
      
      if (result.error) {
        setError(result.error);
      } else {
        setFormData({ name: '', email: '', contactName: '', specialInstructions: '' });
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
      specialInstructions: supplier.special_instructions || supplier.comments || ''
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
    if (!window.confirm('Are you sure you want to delete this supplier?')) {
      return;
    }
    
    setError('');
    try {
      const result = await window.api.deleteSupplier(id);
      if (result.error) {
        setError(result.error);
      } else {
        loadSuppliers();
      }
    } catch (err) {
      setError('Failed to delete supplier');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', email: '', contactName: '', specialInstructions: '' });
    setEditingSupplier(null);
    setShowAddForm(false);
    setError('');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading suppliers...</p>
      </div>
    );
  }

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier => {
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
                        onClick={() => handleDelete(supplier.id)}
                        style={{
                          background: '#dc2626',
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
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SuppliersManagement;
