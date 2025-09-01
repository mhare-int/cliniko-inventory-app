import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';

export default function ProductAudit() {
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  const fetchAudit = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      if (!productId || String(productId).trim() === '') {
        setError('Enter a product Cliniko ID or product name');
        return;
      }
      if (!window.api || !window.api.getProductAudit) throw new Error('Backend API not available');

      // Determine lookupArg: prefer selectedOption if present, else resolve typed name via getProductOptions
      let lookupArg = productId;
      const trimmed = String(productId).trim();
      const isNumeric = /^\d+$/.test(trimmed);

      if (selectedOption && selectedOption.value) {
        lookupArg = selectedOption.value;
      } else if (!isNumeric && window.api.getProductOptions) {
        try {
          const opts = await window.api.getProductOptions(trimmed);
          if (Array.isArray(opts) && opts.length > 0) {
            const first = opts[0];
            if (first && (first.cliniko_id || first.id)) lookupArg = first.cliniko_id || first.id;
            else if (first && first.value) lookupArg = first.value;
          }
        } catch (e) {
          console.warn('Product option lookup failed, falling back to raw term:', e);
        }
      }

      const res = await window.api.getProductAudit(lookupArg, { limit: 500 });
      if (!res) {
        setResults([]);
      } else if (res.error) {
        setError(res.error || JSON.stringify(res));
      } else {
        setResults(Array.isArray(res) ? res : (res.items || []));
      }
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const renderNotes = (notes) => {
    if (!notes && notes !== 0) return '';

    // If it's already an object, use it. If it's a string, try to parse JSON.
    let parsed = null;
    if (typeof notes === 'object') parsed = notes;
    else if (typeof notes === 'string') {
      const t = notes.trim();
      if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try {
          parsed = JSON.parse(t);
        } catch (e) {
          parsed = null;
        }
      }
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Simple object: render each key on its own line
      const entries = Object.entries(parsed);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ fontSize: 13 }}>
              <strong style={{ marginRight: 8 }}>{k}:</strong>
              <span style={{ color: '#333' }}>{(v === null || v === undefined) ? '' : String(v)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (parsed) {
      // Array or complex structure: pretty-print JSON in monospace
      return (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, margin: 0 }}>{JSON.stringify(parsed, null, 2)}</pre>
      );
    }

    // Fallback: plain string - show with pre-wrap to preserve spacing
    return <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(notes)}</div>;
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Product Audit</h2>
      <p>Enter a product Cliniko ID or product name to view the timeline.</p>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 20, minHeight: 48 }}>
        <div style={{ flex: 1 }}>
          <AsyncSelect
            cacheOptions
            defaultOptions
            value={selectedOption}
            loadOptions={async (inputValue) => {
              if (!inputValue) return [];
              try {
                const res = await window.api.getProductOptions(inputValue);
                return Array.isArray(res) ? res.map(p => ({ label: p.label || p.description || String(p.value), value: String(p.value), data: p })) : [];
              } catch (e) {
                return [];
              }
            }}
            onChange={(opt) => {
              setSelectedOption(opt);
              setProductId(opt ? String(opt.value) : '');
            }}
            placeholder="Cliniko ID or product name"
            styles={{ container: (base) => ({ ...base, width: '100%' }) }}
            isClearable
          />
        </div>

        <div style={{ width: 160, display: 'flex', alignItems: 'center' }}>
          <button
            onClick={fetchAudit}
            disabled={loading || !productId}
            style={{
              width: '100%',
              height: 48,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              cursor: loading || !productId ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading…' : 'Fetch'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

      {!loading && results && results.length === 0 && <div>No events found</div>}

      {!loading && results && results.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Action</th>
              <th style={{ padding: '8px' }}>Qty</th>
              <th style={{ padding: '8px' }}>Ref</th>
              <th style={{ padding: '8px' }}>User / Supplier</th>
              <th style={{ padding: '8px' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '8px', verticalAlign: 'top', width: 190 }}>{r.date ? new Date(r.date).toLocaleString() : ''}</td>
                <td style={{ padding: '8px', verticalAlign: 'top', width: 140 }}>{r.action || r.action_type || ''}</td>
                <td style={{ padding: '8px', verticalAlign: 'top', width: 80 }}>{r.qty_change ?? r.quantity ?? r.qty ?? ''}</td>
                <td style={{ padding: '8px', verticalAlign: 'top', width: 110 }}>{r.ref_id ?? r.pr_id ?? ''}</td>
                <td style={{ padding: '8px', verticalAlign: 'top' }}>{r.user_name || r.received_by || r.supplier_name || r.location || ''}</td>
                <td style={{ padding: '8px', verticalAlign: 'top' }}>{renderNotes(r.notes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
