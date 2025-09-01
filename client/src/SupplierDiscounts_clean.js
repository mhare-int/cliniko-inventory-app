import React, { useEffect, useState } from 'react';

export default function SupplierDiscountsClean() {
  const [suppliers, setSuppliers] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({ supplier_id: '', product_cliniko_id: '', effective_from: '', effective_to: '', notes: '', bands: [{ min_qty: 1, price_per_unit: '', percent_discount: '' }] });

  useEffect(() => { if (window.api && window.api.getAllSuppliers) window.api.getAllSuppliers().then(s => setSuppliers(Array.isArray(s) ? s : [])).catch(() => setSuppliers([])); }, []);
  useEffect(() => { if (window.api && window.api.listSupplierProductDiscounts) load(); }, [selectedSupplier]);

  async function load() { setLoading(true); try { const list = await window.api.listSupplierProductDiscounts(selectedSupplier ? { supplier_id: selectedSupplier } : {}); setDiscounts(Array.isArray(list) ? list : []); } catch (e) { setDiscounts([]); } setLoading(false); }

  function addBand() { setForm(f => ({ ...f, bands: [...(f.bands || []), { min_qty: 1, price_per_unit: '', percent_discount: '' }] })); }
  function resetBands() { setForm(f => ({ ...f, bands: [{ min_qty: 1, price_per_unit: '', percent_discount: '' }] })); }

  async function handleAdd() {
    setMessage(null);
    if (!window.api || !window.api.addSupplierProductDiscount) { setMessage({ type: 'error', text: 'API not available' }); return; }
    setLoading(true);
    try {
      const payloads = (form.bands || []).map(b => ({ supplier_id: form.supplier_id || null, product_cliniko_id: form.product_cliniko_id || null, min_qty: Number(b.min_qty) || 1, price_per_unit: b.price_per_unit === '' ? null : Number(b.price_per_unit), percent_discount: b.percent_discount === '' ? null : Number(b.percent_discount), effective_from: form.effective_from || null, effective_to: form.effective_to || null, notes: form.notes || null }));
      await Promise.all(payloads.map(p => window.api.addSupplierProductDiscount(p)));
      setMessage({ type: 'success', text: 'Added' });
      setForm({ ...form, bands: [{ min_qty: 1, price_per_unit: '', percent_discount: '' }] });
      load();
    } catch (e) { setMessage({ type: 'error', text: 'Add failed' }); }
    setLoading(false);
  }

  async function handleDelete(id) { if (!confirm('Delete?')) return; if (!window.api) return; try { await window.api.deleteSupplierProductDiscount(id); load(); } catch (e) { setMessage({ type: 'error', text: 'Delete failed' }); } }

  const responsiveCss = `
  .sd-add-table td { vertical-align: top; }
  @media (max-width: 820px) {
    .sd-add-table, .sd-add-table tbody, .sd-add-table tr { display: block; width: 100%; }
    .sd-add-table td { display: block; width: 100% !important; margin-bottom: 10px; }
    .discounts-table thead { display: none; }
    .discounts-table tbody tr { display: block; border: 1px solid #eee; margin-bottom: 12px; padding: 8px; border-radius: 6px; }
    .discounts-table tbody tr td { display: block; padding: 6px 4px; }
    .discounts-table tbody tr td:before { content: attr(data-label); display: block; font-weight: 600; color: #333; margin-bottom: 4px; }
  }
  `;

  return (
    <div style={{ padding: 12 }}>
      <style>{responsiveCss}</style>
      <h2>Supplier Discounts (clean copy)</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Supplier
          <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">All</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <section>
        <h3>Add Discount</h3>
        <table className="sd-add-table" style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: 160 }}>Product</td>
              <td><input value={form.product_cliniko_id} onChange={e => setForm(f => ({ ...f, product_cliniko_id: e.target.value }))} style={{ width: '100%' }} /></td>
            </tr>
            <tr>
              <td>Effective From</td>
              <td><input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} /></td>
            </tr>
            <tr>
              <td>Notes</td>
              <td><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%' }} /></td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 8 }}>
          <strong>Bands</strong>
          <div style={{ marginTop: 6 }}>
            <button onClick={addBand} style={{ marginRight: 8 }}>+ Add band</button>
            <button onClick={resetBands}>Reset</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3>Existing Discounts</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="discounts-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Supplier</th><th>Product</th><th>Min Qty</th><th>Price</th><th></th></tr>
            </thead>
            <tbody>
              {discounts.map(d => (
                <tr key={d.id}>
                  <td data-label="Supplier">{d.supplier_id}</td>
                  <td data-label="Product">{d.product_cliniko_id}</td>
                  <td data-label="Min Qty">{d.min_qty}</td>
                  <td data-label="Price">{d.price_per_unit}</td>
                  <td><button onClick={() => handleDelete(d.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
