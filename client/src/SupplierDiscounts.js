import React, { useEffect, useMemo, useState } from 'react'

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
  function removeWizardBand(i) {
    setWizardBands(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateWizardBand(i, key, value) {
    setWizardBands(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: value } : b))
  }

  async function onDelete(id) {
    // use globalThis.confirm to satisfy ESLint (no-restricted-globals)
    const proceed = (typeof globalThis.confirm === 'function') ? globalThis.confirm('Delete this discount?') : true
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
    <section className="supplier-discounts">
      <header className="component-header">
        <h2 className="component-name">Supplier Discounts</h2>
        <div className="component-meta">
          <label>
            Supplier
            <select value={selectedSupplier} onChange={e => { setSelectedSupplier(e.target.value); setSelectedProduct('') }}>
              <option value="">(all)</option>
              {suppliers.map(s => <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>{s.name || s.vendor_name}</option>)}
            </select>
          </label>
        </div>
        <div className="component-stats">
          <div className="stat">Current: <strong>{currentRow ? formatMoney(currentRow.price_per_unit || currentRow.amount, currentRow.currency) : '-'}</strong></div>
          <div className="stat">Updated: {currentRow ? (currentRow.effective_from || '-') : '-'}</div>
        </div>
      </header>

      {/* Add Discount - header-based table (single-row inputs under thead) */}
      <div className="add-cost-area" style={{ marginTop: 12 }}>
        <table className="add-table sd-table" style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Add discount">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Product</th>
              <th>Min Qty</th>
              <th>Price</th>
              <th>% Discount</th>
              <th>Effective From</th>
              <th>Effective To</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Supplier">
                <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} aria-label="supplier-select" style={{ width: '100%' }}>
                  <option value="">(choose)</option>
                  {suppliers.map(s => <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>{s.name || s.vendor_name}</option>)}
                </select>
              </td>
              <td data-label="Product">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} aria-label="product-select" style={{ minWidth: 160, maxWidth: 320 }}>
                    <option value="">(choose)</option>
                    {filteredProducts.map(p => (
                      <option key={p.id || p.product_id || p.cliniko_id} value={p.id || p.product_id || p.cliniko_id}>{(p.name || p.product_name || p.display_name) + (p.id ? ` — ${p.id}` : '')}</option>
                    ))}
                  </select>
                </div>
              </td>
              <td data-label="Min Qty"><input type="number" min={1} value={formMinQty} onChange={e => setFormMinQty(e.target.value)} aria-label="min-qty" style={{ width: 90 }} /></td>
              <td data-label="Price"><input value={formPrice} onChange={e => setFormPrice(e.target.value)} aria-label="price" style={{ width: 120 }} /></td>
              <td data-label="% Discount"><input value={formPercent} onChange={e => setFormPercent(e.target.value)} aria-label="percent-discount" style={{ width: 100 }} /></td>
              <td data-label="Effective From"><input type="date" value={formEffectiveFrom} onChange={e => setFormEffectiveFrom(e.target.value)} aria-label="effective-from" /></td>
              <td data-label="Effective To"><input type="date" value={formEffectiveTo} onChange={e => setFormEffectiveTo(e.target.value)} aria-label="effective-to" /></td>
              <td data-label="Notes"><input value={formNotes} onChange={e => setFormNotes(e.target.value)} aria-label="notes" style={{ width: '100%' }} /></td>
              <td style={{ textAlign: 'right' }}>{/* actions column intentionally left blank; create button moved below */}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="btn-primary sd-btn" onClick={onAdd} aria-label="Quick create discount">Create</button>
          <button className="btn-small sd-btn" onClick={() => {
            // open wizard prefilled from header inputs
            setWizardSupplier(selectedSupplier)
            setWizardProduct(selectedProduct)
            setWizardBands([{ min_qty: formMinQty || 1, price_per_unit: formPrice || '', percent_discount: formPercent || '' }])
            setShowWizard(true)
            setWizardStep(1)
          }} aria-label="Open advanced wizard">Advanced</button>
        </div>
      </div>

      {/* Guided Create Wizard (inline modal-like) */}
      {showWizard && (
        <div className="sd-wizard" role="dialog" aria-modal="true" aria-label="Create discount wizard" style={{ marginTop: 12, border: '1px solid #e7eef8', padding: 12, borderRadius: 8, background: '#fbfdff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Create Discount — Step {wizardStep} of 3</strong>
            <div>
              <button className="btn-small sd-btn" onClick={() => { setShowWizard(false); setWizardStep(1) }} aria-label="Close wizard">Close</button>
            </div>
          </div>

          {wizardStep === 1 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Select scope</div>
              <label style={{ marginRight: 12 }}><input type="radio" name="scope" checked={wizardScope === 'supplier'} onChange={() => setWizardScope('supplier')} /> Supplier-wide</label>
              <label><input type="radio" name="scope" checked={wizardScope === 'product'} onChange={() => setWizardScope('product')} /> Specific product</label>
              <div style={{ marginTop: 10 }}>
                  {wizardScope === 'supplier' ? (
                  <label>Supplier
                    <select value={wizardSupplier} onChange={e => { setWizardSupplier(e.target.value); setWizardProduct('') }} style={{ marginLeft: 8 }}>
                      <option value="">(choose supplier)</option>
                      {suppliers.map(s => <option key={s.id || s.vendor_id} value={s.id || s.vendor_id}>{s.name || s.vendor_name}</option>)}
                    </select>
                  </label>
                  ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={wizardProduct} onChange={e => setWizardProduct(e.target.value)} aria-label="wizard-product-select" style={{ minWidth: 160, maxWidth: 320 }}>
                      <option value="">(choose product)</option>
                      {filteredProducts.map(p => (
                        <option key={p.id || p.product_id || p.cliniko_id} value={p.id || p.product_id || p.cliniko_id}>{(p.name || p.product_name || p.display_name) + (p.id ? ` — ${p.id}` : '')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary sd-btn" onClick={() => setWizardStep(2)} aria-label="Next to bands">Next: Bands</button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Add quantity bands</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Min Qty</th>
                    <th style={{ textAlign: 'left' }}>Price</th>
                    <th style={{ textAlign: 'left' }}>% Discount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {wizardBands.map((b, i) => (
                    <tr key={i}>
                      <td><input type="number" min={1} value={b.min_qty} onChange={e => updateWizardBand(i, 'min_qty', e.target.value)} style={{ width: 90 }} aria-label={`band-min-${i}`} /></td>
                      <td><input value={b.price_per_unit} onChange={e => updateWizardBand(i, 'price_per_unit', e.target.value)} style={{ width: 110 }} aria-label={`band-price-${i}`} /></td>
                      <td><input value={b.percent_discount} onChange={e => updateWizardBand(i, 'percent_discount', e.target.value)} style={{ width: 100 }} aria-label={`band-percent-${i}`} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-small sd-btn" onClick={() => removeWizardBand(i)} aria-label={`Remove band ${i}`}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8 }}>
                <button className="btn-small sd-btn" onClick={addWizardBand} aria-label="Add band">Add band</button>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary sd-btn" onClick={() => setWizardStep(3)} aria-label="Next to review">Next: Review</button>
                <button className="btn-small sd-btn" onClick={() => setWizardStep(1)} aria-label="Back to scope" style={{ marginLeft: 8 }}>Back</button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Review & confirm</div>
              <div style={{ marginBottom: 8 }}><strong>Scope:</strong> {wizardScope === 'supplier' ? `Supplier ${wizardSupplier || '(none)'}` : `Product ${wizardProduct || '(none)'}`}</div>
              <div style={{ marginBottom: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th>Min Qty</th><th>Price</th><th>%</th></tr></thead>
                  <tbody>
                    {wizardBands.map((b, i) => (
                      <tr key={i}><td>{b.min_qty}</td><td>{b.price_per_unit || '-'}</td><td>{b.percent_discount || '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <button className="btn-primary sd-btn" onClick={createDiscountsForWizard} aria-label="Confirm create">Create discounts</button>
                <button className="btn-small sd-btn" onClick={() => setWizardStep(2)} aria-label="Back to bands" style={{ marginLeft: 8 }}>Back</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bands table (optional additional bands listing) */}
      {/* ...existing bands UI could be inserted here if needed... */}

      <div className="table-responsive" style={{ marginTop: 16 }}>
        <table className="data-table component-cost-table sd-table" aria-label="Supplier discounts">
          <thead>
            <tr>
              <th>Effective From</th>
              <th>Effective To</th>
              <th className="numeric-cell">Min Qty</th>
              <th className="numeric-cell">Price</th>
              <th>%</th>
              <th>Product</th>
              <th>Supplier</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id || r.component_cost_id} className={r.is_current ? 'is-current' : undefined}>
                <td data-label="Effective From">{r.effective_from}</td>
                <td data-label="Effective To">{r.effective_to || '-'}</td>
                <td data-label="Min Qty" className="numeric-cell" style={{ textAlign: 'right' }}>{r.min_qty}</td>
                <td data-label="Price" className="numeric-cell" style={{ textAlign: 'right' }}>{formatMoney(r.price_per_unit || r.amount, r.currency)}</td>
                <td data-label="%" style={{ textAlign: 'center' }}>{r.percent_discount || '-'}</td>
                <td data-label="Product">{(r.product_cliniko_id && (products.find(p => String(p.id || p.product_id || p.cliniko_id) === String(r.product_cliniko_id)) || {}).name) || r.product_cliniko_id || '-'}</td>
                <td data-label="Supplier">{r.supplier_id || 'Global'}</td>
                <td data-label="Notes">{r.notes || ''}</td>
                <td data-label="Actions" style={{ textAlign: 'center' }}>
                  <button className="btn-small btn-edit" aria-label={`Edit discount ${r.id || r.component_cost_id}`}>Edit</button>
                  <button className="btn-small btn-delete" onClick={() => onDelete(r.id)} aria-label={`Delete discount ${r.id || r.component_cost_id}`} style={{ marginLeft: 6 }}>Del</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 12, textAlign: 'center' }}>{loading ? 'Loading...' : 'No discounts'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .component-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px }
        .component-meta label { display:inline-block; margin-right:8px }
        .component-stats { display:flex; gap:12px }
        .numeric-cell { font-variant-numeric: tabular-nums }
        .add-table thead th { text-align:left; padding:8px }
        .add-table td, .sd-table td, .sd-table th { border-bottom: 1px solid #eee }
  /* compact buttons for this component to match input heights */
  .sd-btn { padding: 6px 10px; font-size: 0.9rem; border-radius: 6px; display: inline-block; width: auto }
  .btn-small { padding: 6px 8px; font-size: 0.85rem }
  .btn-primary.sd-btn { background: #006bb6; color: #fff; border: none }
  .btn-small.sd-btn { background: #f3f7fb; border: 1px solid #dfe9f3 }
        @media (max-width:820px) {
          .sd-table thead { display:none }
          .sd-table tbody tr { display:block; margin-bottom:12px; border:1px solid #eee; padding:8px }
          .sd-table tbody td { display:block; padding:6px 4px }
          .sd-table tbody td:before { content: attr(data-label); font-weight:600; display:block }
        }
      `}</style>
    </section>
  )
}
