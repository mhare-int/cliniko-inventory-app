import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminUsersPage from './AdminUsersPage';
import UserBehaviorAnalytics from './UserBehaviorAnalytics';
import EmailSupplierManagement from './admin/EmailSupplierManagement';
const AdminLayout = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine active tab from URL
  const getActiveTabFromPath = (path) => {
    if (path.includes('/admin/behavior-analytics')) return 'analytics';
    if (path.includes('/admin/email-supplier')) return 'emailSupplier';
    return 'users'; // default to users tab
  };

  const [activeTab, setActiveTab] = useState(() => getActiveTabFromPath(location.pathname));

  // Update tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath(location.pathname));
  }, [location.pathname]);

  // --- All Admin State (moved from AdminUsersPage) ---

    const tabs = [
      { key: 'users', label: 'Admin Panel', path: '/admin' },
      { key: 'analytics', label: 'User Analytics', path: '/admin/behavior-analytics' },
      { key: 'emailSupplier', label: 'Email and Supplier Management', path: '/admin/email-supplier' }
    ];

  const handleTabChange = (tabKey) => {
    const tab = tabs.find(t => t.key === tabKey);
    if (tab) {
      navigate(tab.path);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'users') {
      return <AdminUsersPage user={user} />;
    } else if (activeTab === 'analytics') {
      return <UserBehaviorAnalytics />;
    } else if (activeTab === 'emailSupplier') {
      return <EmailSupplierManagement />;
    }
    return null;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Admin Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          color: '#1565c0', 
          marginBottom: '10px',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          Administration Panel
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Manage users, view analytics, and configure system settings
        </p>
      </div>

      {/* Admin Tab Navigation */}
      <div style={{ 
        borderBottom: '2px solid #e0e0e0',
        marginBottom: '30px'
      }}>
        <div style={{ 
          display: 'flex',
          gap: '0',
          position: 'relative'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                padding: '15px 25px',
                border: 'none',
                backgroundColor: activeTab === tab.key ? '#1565c0' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#666',
                fontSize: '16px',
                fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                marginBottom: '-2px',
                borderBottom: activeTab === tab.key ? '2px solid #1565c0' : '2px solid transparent',
                transition: 'all 0.3s ease',
                position: 'relative',
                zIndex: activeTab === tab.key ? 10 : 1
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.key) {
                  e.target.style.backgroundColor = '#f5f5f5';
                  e.target.style.color = '#333';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.key) {
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

      {/* Tab Content */}
      <div style={{ 
        minHeight: '500px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '0',
        overflow: 'hidden'
      }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminLayout;
