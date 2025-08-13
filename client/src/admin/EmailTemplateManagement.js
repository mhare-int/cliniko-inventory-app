import React, { useState, useEffect } from 'react';

function EmailTemplateManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [companyName, setCompanyName] = useState('The Good Life Clinic');
  const [template, setTemplate] = useState({
    subject: 'Purchase Order - {{orderNumber}}',
    body: `Dear {{supplierName}},

We hope this email finds you well.

Please find our purchase order {{orderNumber}} with the following details:

{{orderTable}}

Contact Person: {{supplierContactName}}
{{supplierInstructions}}

Could you please confirm receipt and provide an estimated delivery date?

Thank you for your continued partnership.`,
    signature: `Best regards,
The Good Life Clinic

Phone: (XXX) XXX-XXXX
Email: orders@goodlifeclinic.com
Website: www.goodlifeclinic.com`
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadExistingTemplate();
  }, []);

  const loadExistingTemplate = async () => {
    try {
      const result = await window.api.getEmailTemplate();
      if (result && !result.error) {
        setTemplate({
          subject: result.subject || '',
          body: result.body || '',
          signature: result.signature || ''
        });
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  const loadSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.api.getAllSuppliers();
      if (result.error) {
        setError(result.error);
      } else {
        setSuppliers(result);
        if (result.length > 0) {
          setSelectedSupplier(result[0]);
        }
      }
    } catch (err) {
      setError('Failed to load suppliers');
    }
    setLoading(false);
  };

  const getAvailableVariables = () => [
    { variable: '{{supplierName}}', description: 'Supplier name from database' },
    { variable: '{{supplierEmail}}', description: 'Supplier email address' },
    { variable: '{{supplierContactName}}', description: 'Contact person name' },
    { variable: '{{supplierInstructions}}', description: 'Special supplier instructions' },
    { variable: '{{orderNumber}}', description: 'Purchase order number (e.g., PO00001)' },
    { variable: '{{orderTable}}', description: 'Formatted table of ordered items' },
    { variable: '{{currentDate}}', description: 'Current date' },
    { variable: '{{companyName}}', description: 'Your company name', editable: true, value: companyName, setValue: setCompanyName }
  ];

  const insertVariable = (field, variable) => {
    const textarea = document.getElementById(field);
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = template[field];
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      setTemplate(prev => ({
        ...prev,
        [field]: newText
      }));

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const generatePreview = () => {
    if (!selectedSupplier) return template;

    const sampleOrderTable = `
Product Name                          Quantity
================================================
Sample Product 1                         5
Sample Product 2                         3
Sample Product 3                         2
================================================`;

    const replacements = {
      '{{supplierName}}': selectedSupplier.name || 'Sample Supplier',
      '{{supplierEmail}}': selectedSupplier.email || 'supplier@example.com',
      '{{supplierContactName}}': selectedSupplier.contact_name || 'John Doe',
      '{{supplierInstructions}}': selectedSupplier.special_instructions ? `Special Instructions: ${selectedSupplier.special_instructions}` : (selectedSupplier.comments ? `Special Instructions: ${selectedSupplier.comments}` : ''),
      '{{orderNumber}}': 'PO00001',
      '{{orderTable}}': sampleOrderTable,
      '{{currentDate}}': new Date().toLocaleDateString(),
      '{{companyName}}': companyName
    };

    const preview = {};
    Object.keys(template).forEach(key => {
      let text = template[key];
      Object.keys(replacements).forEach(variable => {
        text = text.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), replacements[variable]);
      });
      preview[key] = text;
    });

    return preview;
  };

  const resetToDefault = () => {
    setTemplate({
      subject: 'Purchase Order - {{orderNumber}}',
      body: `Dear {{supplierName}},

We hope this email finds you well.

Please find our purchase order {{orderNumber}} with the following details:

{{orderTable}}

Contact Person: {{supplierContactName}}
{{supplierInstructions}}

Could you please confirm receipt and provide an estimated delivery date?

Thank you for your continued partnership.`,
      signature: `Best regards,
The Good Life Clinic

Phone: (XXX) XXX-XXXX
Email: orders@goodlifeclinic.com
Website: www.goodlifeclinic.com`
    });
  };

    const handleSaveTemplate = async () => {
    try {
      const result = await window.api.saveEmailTemplate({
        subject: template.subject,
        body: template.body,
        signature: template.signature
      });
      
      if (result.error) {
        alert('Error saving template: ' + result.error);
      } else {
        alert(result.message || 'Template saved successfully!');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading email template editor...</p>
      </div>
    );
  }

  const preview = generatePreview();

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
          flex: 1,
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
          Email Template Management
        </h2>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          style={{
            background: previewMode ? '#22b573' : '#006bb6',
            color: '#fff',
            border: 'none',
            padding: '0 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            maxWidth: '140px',
            fontSize: '14px'
          }}
        >
          {previewMode ? '📝 Edit Mode' : '👁️ Preview Mode'}
        </button>
        <button
          onClick={resetToDefault}
          style={{
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            padding: '0 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            maxWidth: '120px',
            fontSize: '14px'
          }}
        >
          Reset to Default
        </button>
        <button
          onClick={handleSaveTemplate}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '0 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            maxWidth: '120px',
            fontSize: '14px'
          }}
        >
          Save Template
        </button>
      </div>

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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: previewMode ? '1fr' : '2fr 1fr', 
        gap: '20px',
        minHeight: '600px'
      }}>
        {/* Template Editor */}
        {!previewMode && (
          <div style={{
            background: '#fff',
            border: '2px solid #e1e5e9',
            borderRadius: '12px',
            padding: '30px'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Email Template Editor</h3>
            
            {/* Email Subject */}
            <div style={{ marginBottom: 25 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#555', fontWeight: 600 }}>
                Email Subject
              </label>
              <input
                type="text"
                id="subject"
                value={template.subject}
                onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Email Body */}
            <div style={{ marginBottom: 25 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#555', fontWeight: 600 }}>
                Email Body
              </label>
              <textarea
                id="body"
                value={template.body}
                onChange={(e) => setTemplate(prev => ({ ...prev, body: e.target.value }))}
                rows={12}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            {/* Email Signature */}
            <div style={{ marginBottom: 25 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#555', fontWeight: 600 }}>
                Email Signature
              </label>
              <textarea
                id="signature"
                value={template.signature}
                onChange={(e) => setTemplate(prev => ({ ...prev, signature: e.target.value }))}
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e1e5e9',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>
        )}

        {/* Variables Panel / Preview */}
        <div style={{
          background: '#fff',
          border: '2px solid #e1e5e9',
          borderRadius: '12px',
          padding: '30px'
        }}>
          {previewMode ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: '#333' }}>Email Preview</h3>
                {suppliers.length > 0 && (
                  <select
                    value={selectedSupplier?.id || ''}
                    onChange={(e) => setSelectedSupplier(suppliers.find(s => s.id == e.target.value))}
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  >
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 20
              }}>
                <div style={{ marginBottom: 15 }}>
                  <strong style={{ color: '#374151' }}>Subject:</strong>
                  <div style={{ 
                    background: '#fff', 
                    padding: '8px 12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: 4, 
                    marginTop: 5,
                    fontSize: 14
                  }}>
                    {preview.subject}
                  </div>
                </div>
                
                <div style={{ marginBottom: 15 }}>
                  <strong style={{ color: '#374151' }}>Body:</strong>
                  <div style={{ 
                    background: '#fff', 
                    padding: '12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: 4, 
                    marginTop: 5,
                    whiteSpace: 'pre-wrap',
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxHeight: 300,
                    overflow: 'auto'
                  }}>
                    {preview.body}
                  </div>
                </div>
                
                <div>
                  <strong style={{ color: '#374151' }}>Signature:</strong>
                  <div style={{ 
                    background: '#fff', 
                    padding: '12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: 4, 
                    marginTop: 5,
                    whiteSpace: 'pre-wrap',
                    fontSize: 14,
                    lineHeight: 1.5
                  }}>
                    {preview.signature}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Available Variables</h3>
              <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#666' }}>
                Click any variable to insert it at your cursor position:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {getAvailableVariables().map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <code style={{
                          background: '#1f2937',
                          color: '#10b981',
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 12,
                          fontFamily: 'monospace'
                        }}>
                          {item.variable}
                        </code>
                        <p style={{ margin: '5px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                          {item.description}
                        </p>
                        {item.editable && (
                          <div style={{ marginTop: 8 }}>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) => item.setValue(e.target.value)}
                              placeholder="Enter company name"
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: 4,
                                fontSize: 12,
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 8 }}>
                        <button
                          onClick={() => insertVariable('subject', item.variable)}
                          style={{
                            background: '#006bb6',
                            color: '#fff',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          Subject
                        </button>
                        <button
                          onClick={() => insertVariable('body', item.variable)}
                          style={{
                            background: '#22b573',
                            color: '#fff',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          Body
                        </button>
                        <button
                          onClick={() => insertVariable('signature', item.variable)}
                          style={{
                            background: '#667eea',
                            color: '#fff',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          Signature
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailTemplateManagement;
