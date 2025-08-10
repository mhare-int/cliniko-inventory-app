import React, { useState } from "react";
import UserManagement from "./admin/UserManagement";
import ApiKeyManagement from "./admin/ApiKeyManagement";
import SessionTimeout from "./admin/SessionTimeout";
import Settings from "./admin/Settings";
import SalesDataSync from "./admin/SalesDataSync";

const tabList = [
  { label: "User Management", key: "users" },
  { label: "API Key", key: "api" },
  { label: "Session Timeout", key: "timeout" },
  { label: "Settings", key: "settings" },
  { label: "Sales Data Sync", key: "sync" },
];

function AdminPageTabs(props) {
  const [tab, setTab] = useState("users");
  return (
    <div style={{ padding: '0' }}>
      {/* Tab Navigation */}
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
          {tabList.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: tab === t.key ? '#1867c0' : 'transparent',
                color: tab === t.key ? 'white' : '#666',
                fontSize: '14px',
                fontWeight: tab === t.key ? 'bold' : 'normal',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                marginBottom: '-2px',
                borderBottom: tab === t.key ? '2px solid #1867c0' : '2px solid transparent',
                transition: 'all 0.3s ease',
                position: 'relative',
                zIndex: tab === t.key ? 10 : 1
              }}
              onMouseEnter={(e) => {
                if (tab !== t.key) {
                  e.target.style.backgroundColor = '#f0f0f0';
                  e.target.style.color = '#333';
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== t.key) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#666';
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ 
        backgroundColor: 'white',
        minHeight: '500px',
        padding: '20px'
      }}>
        {tab === "users" && <UserManagement {...props} />}
        {tab === "api" && <ApiKeyManagement {...props} />}
        {tab === "timeout" && <SessionTimeout {...props} />}
        {tab === "settings" && <Settings {...props} />}
        {tab === "sync" && <SalesDataSync {...props} />}
      </div>
    </div>
  );
}

export default AdminPageTabs;
