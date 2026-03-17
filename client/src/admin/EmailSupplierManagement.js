import React, { useState } from 'react';
import SuppliersManagement from './SuppliersManagement';
import EmailTemplateManagement from './EmailTemplateManagement';
import PoTemplates from './PoTemplates';
import SupplierDiscounts from '../SupplierDiscounts';

function EmailSupplierManagement(props) {
  const [activeSubTab, setActiveSubTab] = useState('suppliers');

  const subTabs = [
  { id: 'suppliers', label: 'Suppliers', component: SuppliersManagement },
  { id: 'discounts', label: 'Supplier Discounts', component: SupplierDiscounts },
  { id: 'email', label: 'Email Templates', component: EmailTemplateManagement },
  { id: 'po_templates', label: 'PO Templates', component: PoTemplates }
  ];

  const renderSubTabContent = () => {
    const activeTab = subTabs.find(tab => tab.id === activeSubTab);
    if (!activeTab) return null;
    const Component = activeTab.component;
    return <Component {...props} />;
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Sub-tab Navigation */}
      <div style={{ 
        borderBottom: '2px solid #e0e0e0',
        marginBottom: '0',
        background: '#f9f9f9'
      }}>
        <div style={{ 
          display: 'flex',
          gap: '0',
          position: 'relative',
          padding: '0 20px'
        }}>
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: activeSubTab === tab.id ? '#1867c0' : 'transparent',
                color: activeSubTab === tab.id ? 'white' : '#666',
                fontSize: '14px',
                fontWeight: activeSubTab === tab.id ? 'bold' : 'normal',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                marginBottom: '-2px',
                borderBottom: activeSubTab === tab.id ? '2px solid #1867c0' : '2px solid transparent',
                transition: 'all 0.3s ease',
                position: 'relative',
                zIndex: activeSubTab === tab.id ? 10 : 1
              }}
              onMouseEnter={(e) => {
                if (activeSubTab !== tab.id) {
                  e.target.style.backgroundColor = '#f0f0f0';
                  e.target.style.color = '#333';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSubTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#666';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab Content */}
      <div style={{ 
        backgroundColor: 'white',
        minHeight: '500px'
      }}>
        {renderSubTabContent()}
      </div>
    </div>
  );
}

export default EmailSupplierManagement;
