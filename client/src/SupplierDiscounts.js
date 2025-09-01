import React, { useCallback, useEffect, useMemo, useState } from 'react'

function formatMoney(v, c) {
  if (v == null || v === '') return '-'
  return (Number(v).toFixed(2)) + (c ? ` ${c}` : '')
}

export default function SupplierDiscounts() {
  // state: selected supplier/product, rows, loading, addFormVisible, editRowId, sort
  const [suppliers, setSuppliers] = useState([])
  const [rows, setRows] = useState([]) // discounts
  const [loading, setLoading] = useState(false)

  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [products, setProducts] = useState([])

  const [addFormVisible, setAddFormVisible] = useState(true)
  const [editRowId, setEditRowId] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardScope, setWizardScope] = useState('supplier') // 'supplier' | 'product'
  const [wizardSupplier, setWizardSupplier] = useState('')
  const [wizardProduct, setWizardProduct] = useState('')
  const [wizardBands, setWizardBands] = useState([{ min_qty: 1, price_per_unit: '', percent_discount: '' }])

  const filteredProducts = useMemo(() => {
    const base = products || []
    const activeSupplier = selectedSupplier || wizardSupplier
    return activeSupplier ? base.filter(p => {
      const supplierId = p.supplier_id || p.vendor_id || p.vendorId || p.supplier || null
      return String(supplierId) === String(activeSupplier)
    }) : base
  }, [products, selectedSupplier, wizardSupplier])

  // add form fields
  const [formMinQty, setFormMinQty] = useState(1)
  const [formPrice, setFormPrice] = useState('')
  const [formPercent, setFormPercent] = useState('')
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('')
  const [formEffectiveTo, setFormEffectiveTo] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // derived: currentRow
  const currentRow = useMemo(() => rows.find(r => r.is_current), [rows])

  useEffect(() => {
    async function loadSuppliers() {
      try {
        if (!window.api || !window.api.getAllSuppliers) return setSuppliers([])
        const s = await window.api.getAllSuppliers()
        setSuppliers(Array.isArray(s) ? s : [])
      } catch (e) {
        console.error(e)
        setSuppliers([])
      }
    }
    loadSuppliers()
  }, [])

  useEffect(() => {
    async function loadProducts() {
      try {
        if (!window.api) return setProducts([])
        const fn = window.api.getAllProductsWithWrapper || window.api.getAllProducts
        if (!fn) return setProducts([])
        const res = await fn()
        // accept several shapes: array or { products: [...] } or { data: [...] }
        if (Array.isArray(res)) setProducts(res)
        else if (res && Array.isArray(res.products)) setProducts(res.products)
        else if (res && Array.isArray(res.data)) setProducts(res.data)
        else setProducts([])
      } catch (e) {
        console.error('loadProducts', e)
        setProducts([])
      }
    }
    loadProducts()
  }, [])

  useEffect(() => { loadRows() }, [selectedSupplier])

  async function loadRows() {
    setLoading(true)
    try {
      if (!window.api || !window.api.listSupplierProductDiscounts) {
        setRows([])
        setLoading(false)
        return
      }
      const filter = selectedSupplier ? { supplier_id: selectedSupplier } : {}
      const list = await window.api.listSupplierProductDiscounts(filter)
      setRows(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error(e)
      setRows([])
    }
    setLoading(false)
  }

  async function onAdd() {
    if (!window.api || !window.api.addSupplierProductDiscount) {
      alert('API unavailable')
      return
    }
    try {
      await window.api.addSupplierProductDiscount({
        supplier_id: selectedSupplier || null,
        product_cliniko_id: selectedProduct || null,
        min_qty: Number(formMinQty) || 1,
        price_per_unit: formPrice || null,
        percent_discount: formPercent || null,
        effective_from: formEffectiveFrom || null,
        effective_to: formEffectiveTo || null,
        notes: formNotes || null
      })
      // reload
      await loadRows()
      // clear
      setFormMinQty(1)
      setFormPrice('')
      setFormPercent('')
      setFormEffectiveFrom('')
      setFormEffectiveTo('')
      setFormNotes('')
    } catch (e) {
      console.error(e)
      alert('Failed to add discount')
    }
  }

  // Create multiple discount records (used by the wizard)
  async function createDiscountsForWizard() {
    if (!window.api || !window.api.addSupplierProductDiscount) {
      alert('API unavailable')
      return
    }
    try {
      setLoading(true)
      for (const b of wizardBands) {
        await window.api.addSupplierProductDiscount({
          supplier_id: wizardScope === 'supplier' ? (wizardSupplier || null) : null,
          product_cliniko_id: wizardScope === 'product' ? (wizardProduct || null) : null,
          min_qty: Number(b.min_qty) || 1,
          price_per_unit: b.price_per_unit || null,
          percent_discount: b.percent_discount || null,
          effective_from: formEffectiveFrom || null,
          effective_to: formEffectiveTo || null,
          notes: formNotes || null
        })
      }
      await loadRows()
      // reset wizard
      setWizardStep(1)
      setShowWizard(false)
      setWizardBands([{ min_qty: 1, price_per_unit: '', percent_discount: '' }])
      setWizardProduct('')
      setWizardSupplier('')
    } catch (e) {
      console.error(e)
      alert('Failed to create discounts')
    }
    setLoading(false)
  }

  function addWizardBand() {
    setWizardBands(prev => [...prev, { min_qty: 1, price_per_unit: '', percent_discount: '' }])
  }
  const removeWizardBand = useCallback((i) => {
    setWizardBands(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  
  const updateWizardBand = useCallback((i, key, value) => {
    setWizardBands(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: value } : b))
  }, [])

  async function onDelete(id) {
    // use window.confirm to satisfy ESLint (no-restricted-globals)
    const proceed = window.confirm('Delete this discount?')
    if (!proceed) return
    if (!window.api || !window.api.deleteSupplierProductDiscount) {
      alert('API unavailable')
      return
    }
    try {
      await window.api.deleteSupplierProductDiscount(id)
      await loadRows()
    } catch (e) {
      console.error(e)
      alert('Delete failed')
    }
  }

  return (
    <div className="supplier-discounts-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">Supplier Discounts</h1>
          <p className="page-subtitle">Manage pricing and discount structures for suppliers and products</p>
        </div>
        
        <div className="header-controls">
          <div className="filter-group">
            <label className="filter-label">Filter by Supplier:</label>
            <select 
              className="supplier-filter" 
              value={selectedSupplier} 
              onChange={e => { setSelectedSupplier(e.target.value); setSelectedProduct('') }}
            >
              <option value="">(all suppliers)</option>
              {suppliers.map(s => (
                <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>
                  {s.name || s.vendor_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="stats-summary">
            <div className="stat-item">
              <span className="stat-label">Active Discounts:</span>
              <span className="stat-value">{rows.filter(r => r.is_current).length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Discounts:</span>
              <span className="stat-value">{rows.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Discount Form */}
      <div className="add-discount-section">
        <div className="section-header">
          <h2>Add New Discount</h2>
          <div className="section-actions">
            <button 
              className="btn-wizard" 
              onClick={() => {
                setWizardSupplier(selectedSupplier)
                setWizardProduct(selectedProduct)
                setWizardBands([{ min_qty: formMinQty || 1, price_per_unit: formPrice || '', percent_discount: formPercent || '' }])
                setShowWizard(true)
                setWizardStep(1)
              }}
            >
              🧙‍♂️ Bulk Wizard
            </button>
          </div>
        </div>

        <div className="discount-form-card">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select 
                className="form-select" 
                value={selectedSupplier} 
                onChange={e => setSelectedSupplier(e.target.value)}
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>
                    {s.name || s.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Product</label>
              <select 
                className="form-select" 
                value={selectedProduct} 
                onChange={e => setSelectedProduct(e.target.value)}
              >
                <option value="">Select product...</option>
                {filteredProducts.map(p => (
                  <option key={p.id || p.product_id || p.cliniko_id} value={p.id || p.product_id || p.cliniko_id}>
                    {(p.name || p.product_name || p.display_name)}
                    {p.id && ` (ID: ${p.id})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Min Quantity</label>
              <input 
                type="number" 
                min="1" 
                className="form-input" 
                value={formMinQty} 
                onChange={e => setFormMinQty(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price per Unit</label>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={formPrice} 
                onChange={e => setFormPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input 
                type="number" 
                step="0.1" 
                min="0" 
                max="100" 
                className="form-input" 
                value={formPercent} 
                onChange={e => setFormPercent(e.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Effective From</label>
              <input 
                type="date" 
                className="form-input" 
                value={formEffectiveFrom} 
                onChange={e => setFormEffectiveFrom(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Effective To</label>
              <input 
                type="date" 
                className="form-input" 
                value={formEffectiveTo} 
                onChange={e => setFormEffectiveTo(e.target.value)}
              />
            </div>

            <div className="form-group full-width">
              <label className="form-label">Notes</label>
              <textarea 
                className="form-input" 
                value={formNotes} 
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Optional notes about this discount..."
                rows="2"
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-primary" onClick={onAdd}>
              ✅ Add Discount
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setFormMinQty(1)
                setFormPrice('')
                setFormPercent('')
                setFormEffectiveFrom('')
                setFormEffectiveTo('')
                setFormNotes('')
              }}
            >
              Clear Form
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Discount Wizard */}
      {showWizard && (
        <div className="wizard-overlay">
          <div className="wizard-modal">
            <div className="wizard-header">
              <h3>Bulk Discount Wizard</h3>
              <div className="wizard-progress">
                <span className={`step ${wizardStep >= 1 ? 'active' : ''}`}>1</span>
                <span className={`step ${wizardStep >= 2 ? 'active' : ''}`}>2</span>
                <span className={`step ${wizardStep >= 3 ? 'active' : ''}`}>3</span>
              </div>
              <button className="close-btn" onClick={() => { setShowWizard(false); setWizardStep(1) }}>
                ✕
              </button>
            </div>

            <div className="wizard-content">
              {wizardStep === 1 && (
                <div className="wizard-step">
                  <h4>Step 1: Choose Scope</h4>
                  <p>Select whether to apply discounts to all products from a supplier or a specific product.</p>
                  
                  <div className="scope-options">
                    <label className="scope-option">
                      <input 
                        type="radio" 
                        name="scope" 
                        checked={wizardScope === 'supplier'} 
                        onChange={() => setWizardScope('supplier')} 
                      />
                      <div className="option-content">
                        <strong>Supplier-wide</strong>
                        <span>Apply to all products from a supplier</span>
                      </div>
                    </label>
                    
                    <label className="scope-option">
                      <input 
                        type="radio" 
                        name="scope" 
                        checked={wizardScope === 'product'} 
                        onChange={() => setWizardScope('product')} 
                      />
                      <div className="option-content">
                        <strong>Specific Product</strong>
                        <span>Apply to one specific product</span>
                      </div>
                    </label>
                  </div>

                  <div className="scope-selection">
                    {wizardScope === 'supplier' ? (
                      <div className="form-group">
                        <label className="form-label">Select Supplier</label>
                        <select 
                          className="form-select" 
                          value={wizardSupplier} 
                          onChange={e => { setWizardSupplier(e.target.value); setWizardProduct('') }}
                        >
                          <option value="">Choose supplier...</option>
                          {suppliers.map(s => (
                            <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>
                              {s.name || s.vendor_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Select Product</label>
                        <select 
                          className="form-select" 
                          value={wizardProduct} 
                          onChange={e => setWizardProduct(e.target.value)}
                        >
                          <option value="">Choose product...</option>
                          {filteredProducts.map(p => (
                            <option key={p.id || p.product_id || p.cliniko_id} value={p.id || p.product_id || p.cliniko_id}>
                              {(p.name || p.product_name || p.display_name)}
                              {p.id && ` (ID: ${p.id})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="wizard-actions">
                    <button className="btn-primary" onClick={() => setWizardStep(2)}>
                      Next: Configure Bands →
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="wizard-step">
                  <h4>Step 2: Configure Quantity Bands</h4>
                  <p>Set up different pricing tiers based on quantity thresholds.</p>
                  
                  <div className="bands-table">
                    <div className="bands-header">
                      <span>Min Quantity</span>
                      <span>Price per Unit</span>
                      <span>Discount %</span>
                      <span>Actions</span>
                    </div>
                    
                    {wizardBands.map((band, i) => (
                      <div key={`band-${i}`} className="band-row">
                        <input 
                          type="number" 
                          min="1" 
                          value={band.min_qty} 
                          onChange={e => updateWizardBand(i, 'min_qty', e.target.value)}
                          placeholder="1"
                        />
                        <input 
                          type="number" 
                          step="0.01" 
                          value={band.price_per_unit} 
                          onChange={e => updateWizardBand(i, 'price_per_unit', e.target.value)}
                          placeholder="0.00"
                        />
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0" 
                          max="100" 
                          value={band.percent_discount} 
                          onChange={e => updateWizardBand(i, 'percent_discount', e.target.value)}
                          placeholder="0.0"
                        />
                        <button 
                          className="btn-remove" 
                          onClick={() => removeWizardBand(i)}
                          disabled={wizardBands.length === 1}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="band-actions">
                    <button className="btn-secondary" onClick={addWizardBand}>
                      + Add Band
                    </button>
                  </div>

                  <div className="wizard-actions">
                    <button className="btn-primary" onClick={() => setWizardStep(3)}>
                      Next: Review →
                    </button>
                    <button className="btn-secondary" onClick={() => setWizardStep(1)}>
                      ← Back
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="wizard-step">
                  <h4>Step 3: Review & Confirm</h4>
                  <p>Review your discount configuration before creating.</p>
                  
                  <div className="review-section">
                    <div className="review-item">
                      <strong>Scope:</strong> 
                      {wizardScope === 'supplier' 
                        ? `All products from supplier ${suppliers.find(s => String(s.id || s.vendor_id) === String(wizardSupplier))?.name || wizardSupplier || '(none selected)'}`
                        : `Product ${filteredProducts.find(p => String(p.id || p.product_id || p.cliniko_id) === String(wizardProduct))?.name || wizardProduct || '(none selected)'}`
                      }
                    </div>
                    
                    <div className="review-item">
                      <strong>Quantity Bands:</strong>
                      <div className="review-bands">
                        {wizardBands.map((band, i) => (
                          <div key={`review-${i}`} className="review-band">
                            {band.min_qty}+ units: 
                            {band.price_per_unit && ` $${band.price_per_unit}`}
                            {band.percent_discount && ` (${band.percent_discount}% off)`}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="wizard-actions">
                    <button 
                      className="btn-primary" 
                      onClick={createDiscountsForWizard}
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : '✅ Create Discounts'}
                    </button>
                    <button className="btn-secondary" onClick={() => setWizardStep(2)}>
                      ← Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Existing Discounts Table */}
      <div className="discounts-section">
        <div className="section-header">
          <h2>Existing Discounts</h2>
          <div className="table-controls">
            {loading && <span className="loading-indicator">Loading...</span>}
          </div>
        </div>

        <div className="discounts-table-container">
          {rows.length === 0 ? (
            <div className="empty-state">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading discounts...</p>
                </div>
              ) : (
                <div className="no-data">
                  <p>No discounts found</p>
                  <p className="empty-hint">Add your first discount using the form above</p>
                </div>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="discounts-table">
                <thead>
                  <tr>
                    <th className="status-col">Status</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th className="numeric">Min Qty</th>
                    <th className="numeric">Price</th>
                    <th className="numeric">Discount %</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                    <th>Notes</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const supplier = suppliers.find(s => String(s.id || s.vendor_id) === String(row.supplier_id))
                    const product = products.find(p => String(p.id || p.product_id || p.cliniko_id) === String(row.product_cliniko_id))
                    
                    return (
                      <tr key={row.id || row.component_cost_id} className={row.is_current ? 'active-discount' : ''}>
                        <td className="status-col">
                          {row.is_current && <span className="status-badge active">Active</span>}
                        </td>
                        <td className="supplier-cell">
                          {supplier ? (
                            <div className="supplier-info">
                              <span className="supplier-name">{supplier.name || supplier.vendor_name}</span>
                            </div>
                          ) : (
                            <span className="global-indicator">Global</span>
                          )}
                        </td>
                        <td className="product-cell">
                          {product ? (
                            <div className="product-info">
                              <span className="product-name">{product.name || product.product_name || product.display_name}</span>
                              {product.id && <span className="product-id">ID: {product.id}</span>}
                            </div>
                          ) : (
                            <span className="missing-product">Product {row.product_cliniko_id || 'N/A'}</span>
                          )}
                        </td>
                        <td className="numeric">{row.min_qty}</td>
                        <td className="numeric price-cell">
                          {formatMoney(row.price_per_unit || row.amount, row.currency)}
                        </td>
                        <td className="numeric discount-cell">
                          {row.percent_discount ? `${row.percent_discount}%` : '-'}
                        </td>
                        <td className="date-cell">{row.effective_from || '-'}</td>
                        <td className="date-cell">{row.effective_to || '-'}</td>
                        <td className="notes-cell">
                          {row.notes && (
                            <span className="notes-preview" title={row.notes}>
                              {row.notes.length > 30 ? `${row.notes.substring(0, 30)}...` : row.notes}
                            </span>
                          )}
                        </td>
                        <td className="actions-col">
                          <div className="action-buttons">
                            <button 
                              className="btn-action edit" 
                              onClick={() => setEditRowId(row.id)}
                              title="Edit discount"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn-action delete" 
                              onClick={() => onDelete(row.id)}
                              title="Delete discount"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modern CSS Styles */}
      <style>{`
        /* Page Layout */
        .supplier-discounts-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Page Header */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e8f0fe;
        }

        .header-left {
          flex: 1;
        }

        .page-title {
          font-size: 28px;
          font-weight: 600;
          color: #1a73e8;
          margin: 0 0 8px 0;
        }

        .page-subtitle {
          color: #5f6368;
          margin: 0;
          font-size: 16px;
        }

        .header-controls {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-label {
          font-size: 14px;
          font-weight: 500;
          color: #3c4043;
        }

        .supplier-filter {
          padding: 8px 12px;
          border: 1px solid #dadce0;
          border-radius: 6px;
          font-size: 14px;
          min-width: 200px;
        }

        .stats-summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e8eaed;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .stat-label {
          font-size: 13px;
          color: #5f6368;
        }

        .stat-value {
          font-weight: 600;
          color: #1a73e8;
        }

        /* Section Headers */
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-size: 20px;
          font-weight: 600;
          color: #202124;
          margin: 0;
        }

        .section-actions {
          display: flex;
          gap: 12px;
        }

        /* Add Discount Section */
        .add-discount-section {
          margin-bottom: 40px;
        }

        .discount-form-card {
          background: #ffffff;
          border: 1px solid #e8eaed;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: #3c4043;
        }

        .form-input, .form-select {
          padding: 10px 12px;
          border: 1px solid #dadce0;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s ease;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #1a73e8;
          box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        /* Buttons */
        .btn-primary {
          background: #1a73e8;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .btn-primary:hover {
          background: #1557b0;
        }

        .btn-secondary {
          background: #f8f9fa;
          color: #3c4043;
          border: 1px solid #dadce0;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: #f1f3f4;
        }

        .btn-wizard {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .btn-wizard:hover {
          transform: translateY(-1px);
        }

        /* Wizard Styles */
        .wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .wizard-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e8eaed;
        }

        .wizard-header h3 {
          margin: 0;
          font-size: 20px;
          color: #202124;
        }

        .wizard-progress {
          display: flex;
          gap: 8px;
        }

        .wizard-progress .step {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f8f9fa;
          border: 2px solid #dadce0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          color: #5f6368;
        }

        .wizard-progress .step.active {
          background: #1a73e8;
          border-color: #1a73e8;
          color: white;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #5f6368;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: #f8f9fa;
        }

        .wizard-content {
          padding: 24px;
        }

        .wizard-step h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: #202124;
        }

        .wizard-step p {
          margin: 0 0 20px 0;
          color: #5f6368;
        }

        .scope-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 20px 0;
        }

        .scope-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: 1px solid #dadce0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .scope-option:hover {
          border-color: #1a73e8;
          background: #f8f9fa;
        }

        .scope-option input[type="radio"] {
          margin: 0;
        }

        .option-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .option-content strong {
          color: #202124;
        }

        .option-content span {
          color: #5f6368;
          font-size: 14px;
        }

        .scope-selection {
          margin: 20px 0;
        }

        .wizard-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e8eaed;
        }

        /* Bands Configuration */
        .bands-table {
          border: 1px solid #dadce0;
          border-radius: 8px;
          overflow: hidden;
          margin: 20px 0;
        }

        .bands-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 12px;
          background: #f8f9fa;
          padding: 12px;
          font-weight: 500;
          color: #3c4043;
          border-bottom: 1px solid #dadce0;
        }

        .band-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid #f1f3f4;
        }

        .band-row:last-child {
          border-bottom: none;
        }

        .band-row input {
          padding: 8px;
          border: 1px solid #dadce0;
          border-radius: 4px;
          font-size: 14px;
        }

        .btn-remove {
          background: #fee;
          border: 1px solid #fdd;
          color: #d93025;
          border-radius: 4px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          transition: all 0.2s ease;
        }

        .btn-remove:hover {
          background: #fcc;
        }

        .btn-remove:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .band-actions {
          text-align: center;
          margin: 16px 0;
        }

        /* Review Section */
        .review-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .review-item {
          margin-bottom: 16px;
        }

        .review-item:last-child {
          margin-bottom: 0;
        }

        .review-bands {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .review-band {
          padding: 8px 12px;
          background: white;
          border-radius: 4px;
          font-family: monospace;
          font-size: 14px;
        }

        /* Discounts Table */
        .discounts-section {
          margin-top: 40px;
        }

        .table-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-indicator {
          color: #1a73e8;
          font-size: 14px;
        }

        .discounts-table-container {
          background: white;
          border: 1px solid #e8eaed;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1a73e8;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-data p {
          margin: 8px 0;
          color: #5f6368;
        }

        .empty-hint {
          font-size: 14px;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .discounts-table {
          width: 100%;
          border-collapse: collapse;
        }

        .discounts-table th {
          background: #f8f9fa;
          padding: 16px 12px;
          text-align: left;
          font-weight: 500;
          color: #3c4043;
          border-bottom: 1px solid #e8eaed;
          position: sticky;
          top: 0;
        }

        .discounts-table th.numeric {
          text-align: right;
        }

        .discounts-table td {
          padding: 16px 12px;
          border-bottom: 1px solid #f1f3f4;
          vertical-align: top;
        }

        .discounts-table tr:hover {
          background: #f8f9fa;
        }

        .discounts-table tr.active-discount {
          background: #e8f0fe;
        }

        .discounts-table tr.active-discount:hover {
          background: #d2e3fc;
        }

        .status-col {
          width: 80px;
        }

        .actions-col {
          width: 100px;
        }

        .numeric {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: #e8f5e8;
          color: #137333;
        }

        .supplier-info, .product-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .supplier-name, .product-name {
          font-weight: 500;
          color: #202124;
        }

        .product-id {
          font-size: 12px;
          color: #5f6368;
          font-family: monospace;
        }

        .global-indicator {
          color: #5f6368;
          font-style: italic;
        }

        .missing-product {
          color: #d93025;
          font-size: 14px;
        }

        .price-cell {
          font-weight: 500;
          color: #137333;
        }

        .discount-cell {
          font-weight: 500;
          color: #1a73e8;
        }

        .date-cell {
          font-size: 14px;
          color: #5f6368;
        }

        .notes-cell {
          max-width: 200px;
        }

        .notes-preview {
          font-size: 14px;
          color: #5f6368;
          cursor: help;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: center;
        }

        .btn-action {
          background: none;
          border: 1px solid #dadce0;
          border-radius: 4px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
        }

        .btn-action:hover {
          background: #f8f9fa;
        }

        .btn-action.edit:hover {
          border-color: #1a73e8;
          color: #1a73e8;
        }

        .btn-action.delete:hover {
          border-color: #d93025;
          color: #d93025;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .supplier-discounts-page {
            padding: 16px;
          }
          
          .page-header {
            flex-direction: column;
            gap: 20px;
          }
          
          .header-controls {
            flex-direction: column;
            gap: 16px;
            width: 100%;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .wizard-modal {
            width: 95%;
            margin: 20px;
          }
          
          .bands-header, .band-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          
          .discounts-table {
            font-size: 14px;
          }
          
          .discounts-table th,
          .discounts-table td {
            padding: 12px 8px;
          }
        }
      `}</style>
    </div>
  )
}
