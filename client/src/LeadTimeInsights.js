import React, { useEffect, useState } from 'react';

const LeadTimeInsights = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [vendorConsolidation, setVendorConsolidation] = useState([]);
  const [loadingConsolidation, setLoadingConsolidation] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [reorderSuggestion, setReorderSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingSuppliers(true);
      try {
        if (window.api && window.api.getSuppliersWithLeadTime) {
          const res = await window.api.getSuppliersWithLeadTime();
          setSuppliers(Array.isArray(res) ? res : []);
        }
      } catch (e) {
        console.error('Failed to load suppliers with lead time', e);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    load();
  }, []);

  const runVendorConsolidation = async () => {
    setLoadingConsolidation(true);
    try {
      if (window.api && window.api.getVendorConsolidation) {
        const res = await window.api.getVendorConsolidation(14, { historyDays: 90 });
        setVendorConsolidation(Array.isArray(res) ? res : []);
      }
    } catch (e) {
      console.error('Vendor consolidation failed', e);
    } finally {
      setLoadingConsolidation(false);
    }
  };

  const fetchReorder = async () => {
    if (!selectedProduct) return;
    setLoadingSuggestion(true);
    try {
      if (window.api && window.api.getReorderSuggestion) {
        const res = await window.api.getReorderSuggestion(selectedProduct, { historyDays: 90 });
        setReorderSuggestion(res);
      }
    } catch (e) {
      console.error('Failed to fetch reorder suggestion', e);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Lead Time & Ordering Insights</h2>

      <section style={{ marginBottom: 18 }}>
        <h3>Suppliers (stored or calculated lead time)</h3>
        {loadingSuppliers ? (
          <div>Loading suppliers...</div>
        ) : (
          <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Supplier</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Lead Time (days)</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{s.name || s.supplier || s}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{typeof s.lead_time_days !== 'undefined' && s.lead_time_days !== null ? String(s.lead_time_days) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3>Vendor Consolidation (window: 14 days)</h3>
        <div style={{ marginBottom: 8 }}>
          <button onClick={runVendorConsolidation} disabled={loadingConsolidation} style={{ padding: '8px 12px' }}>
            {loadingConsolidation ? 'Running...' : 'Run Consolidation'}
          </button>
        </div>
        {vendorConsolidation.length === 0 ? (
          <div style={{ color: '#666' }}>No consolidation suggestions yet.</div>
        ) : (
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6 }}>
            {vendorConsolidation.map(vc => (
              <div key={vc.supplier} style={{ padding: 8, borderBottom: '1px solid #f1f1f1' }}>
                <strong>{vc.supplier}</strong>
                <div style={{ marginTop: 6 }}>
                  {vc.items.slice(0,5).map(it => (
                    <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#333' }}>{it.productName}</span>
                      <span style={{ color: '#666' }}>{it.recommendedQty} (stock: {it.currentStock})</span>
                    </div>
                  ))}
                  {vc.items.length > 5 && <div style={{ color: '#999' }}>+{vc.items.length - 5} more...</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Reorder Suggestion (single product)</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Enter product cliniko_id" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={{ padding: 8, minWidth: 200 }} />
          <button onClick={fetchReorder} disabled={!selectedProduct || loadingSuggestion} style={{ padding: '8px 12px' }}>
            {loadingSuggestion ? 'Checking...' : 'Get Suggestion'}
          </button>
        </div>
        {reorderSuggestion && (
          <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
            <div><strong>{reorderSuggestion.productName}</strong> (current stock: {reorderSuggestion.currentStock})</div>
            <div>Avg daily: {Number(reorderSuggestion.avgDaily).toFixed(2)}</div>
            <div>Lead time used: {reorderSuggestion.leadTime} days</div>
            <div>Safety stock: {reorderSuggestion.safetyStock}</div>
            <div>Reorder point: {reorderSuggestion.reorderPoint}</div>
            <div>Recommended order qty: {reorderSuggestion.recommendedQty}</div>
            <div>Supplier: {reorderSuggestion.supplierName || 'Unknown'}</div>
          </div>
        )}
      </section>
    </div>
  );
};

export default LeadTimeInsights;
