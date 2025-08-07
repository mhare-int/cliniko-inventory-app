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
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabList.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? "#1867c0" : "#f6f9fb",
              color: tab === t.key ? "#fff" : "#1867c0",
              border: "none",
              borderRadius: 6,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 17,
              cursor: "pointer",
              boxShadow: tab === t.key ? "0 2px 8px 0 rgba(24,103,192,0.09)" : "none",
              transition: "background 0.2s"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
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
