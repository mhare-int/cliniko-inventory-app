import React, { useState, useEffect } from 'react';

function PoTemplates() {
  const [company, setCompany] = useState({ name: '', address: '', phone: '', email: '' });
  const [specialInstructions, setSpecialInstructions] = useState('');
  // logoPreview removed (uploads list is authoritative)
  const [uploads, setUploads] = useState([]);
  // active template feature removed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    setLoading(true);
    try {
  // PO template editing removed (hardcoded output)

      // (Email template is managed on the Email & Supplier Management tab)
      // PO active-template support removed; ignore stored active template

  const companyName = await window.api.getAppSetting('company.name');
  const companyAddress = await window.api.getAppSetting('company.address');
  const companyPhone = await window.api.getAppSetting('company.phone');
  const companyEmail = await window.api.getAppSetting('company.email');
  const companyNotes = await window.api.getAppSetting('company.special_instructions');
  setCompany({ name: companyName?.value || '', address: companyAddress?.value || '', phone: companyPhone?.value || '', email: companyEmail?.value || '' });
  setSpecialInstructions(companyNotes?.value || '');
      const upl = await window.api.listUploads();
      setUploads(upl.files || []);
    } catch (e) {
      console.error('Failed to load PO template data', e);
    }
    setLoading(false);
  };

  const handleLogoFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      const res = await window.api.uploadFile({ name: file.name, content: base64 });
      if (res && res.success) {
        const list = await window.api.listUploads();
        setUploads(list.files || []);
        // Save as app setting
        await window.api.setAppSetting('company.logo', res.filename);
      } else {
        alert('Failed to upload logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveAll = async () => {
    try {
      // PO template is unused (output is hardcoded). We still save company fields only.
      // Save company fields to settings
      await window.api.setAppSetting('company.name', company.name);
      await window.api.setAppSetting('company.address', company.address);
      await window.api.setAppSetting('company.phone', company.phone);
      await window.api.setAppSetting('company.email', company.email);
  await window.api.setAppSetting('company.special_instructions', specialInstructions || '');
      // reload to reflect saved template and any active-template setting
      await loadExisting();
      alert('Saved company details');
    } catch (e) {
      console.error('Failed to save', e);
      alert('Failed to save PO settings');
    }
  };

  // active template handlers removed

  const preview = () => {
    // Request backend-rendered preview so preview matches final generated PO
    (async () => {
      const sampleItems = [
        { vendor: 'Sample Supplier', product: 'Sample Product', qty: 5, unit_price: 12.34 },
        { vendor: 'Sample Supplier', product: 'Another Product', qty: 2, unit_price: 6.5 }
      ];
    try {
  // Include company-level special_instructions when requesting preview
  const previewCompany = Object.assign({}, company, { special_instructions: specialInstructions });
  const resp = await window.api.renderPoPreview(sampleItems, { company: previewCompany });
        if (resp && resp.success && resp.html) {
          const w = window.open('', '_blank', 'width=900,height=800');
          w.document.write(resp.html);
          w.document.close();
        } else {
          alert('Preview failed: ' + (resp && resp.error ? resp.error : 'unknown'));
        }
      } catch (e) {
        console.error('Preview error', e);
        alert('Failed to render preview');
      }
    })();
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ color: '#006bb6' }}>Purchase Order Template & Company Profile</h2>

      <div style={{ display: 'block', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e6e6', padding: 20, borderRadius: 8, maxWidth: 900 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>Purchase Orders are generated from the application's hardcoded layout.</strong>
            <div style={{ marginTop:8, fontSize:12, color:'#666' }}>Template editing has been removed — company details below are still saved.</div>
          </div>

          <h3 style={{ marginTop: 6 }}>Company Profile</h3>
          <div style={{ marginBottom: 8 }}>
            <label>Company Name</label>
            <input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Address</label>
            <textarea rows={4} value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Phone</label>
            <input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Email</label>
            <input value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Logo Upload</label>
            <input type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'block', marginTop: 8 }} />
            {uploads && uploads.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Uploaded files:</strong>
                <ul>
                  {uploads.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Special Instructions / Notes (company default)</label>
            <textarea rows={3} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button onClick={saveAll} style={{ background: '#006bb6', color: '#fff', padding: '10px 14px', border: 'none', borderRadius: 6 }}>Save</button>
            <button onClick={preview} style={{ background: '#22b573', color: '#fff', padding: '10px 14px', border: 'none', borderRadius: 6 }}>Preview</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PoTemplates;
