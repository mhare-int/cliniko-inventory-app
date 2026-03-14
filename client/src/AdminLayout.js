import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageWrapper from "./PageWrapper";
import Settings from "./admin/Settings";
import UserManagement from "./admin/UserManagement";
import UserBehaviorAnalytics from "./UserBehaviorAnalytics";
import EmailSupplierManagement from "./admin/EmailSupplierManagement";
import ApiKeyManagement from "./admin/ApiKeyManagement";
import SessionTimeout from "./admin/SessionTimeout";
import SalesDataSync from "./admin/SalesDataSync";
import { useSmartPromptsContext } from "./contexts/SmartPromptsContext";

const TABS = [
  { id: "settings",          path: "/admin",                    label: "⚙️ Settings" },
  { id: "users",             path: "/admin/users",              label: "👥 Users" },
  { id: "behavior",          path: "/admin/behavior-analytics", label: "📊 Behaviour Analytics" },
  { id: "email-supplier",    path: "/admin/email-supplier",     label: "📧 Suppliers & Email" },
];

function AdminLayout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from current route
  const activeTab = (() => {
    const match = TABS.slice().reverse().find(t => location.pathname.startsWith(t.path));
    return match ? match.id : "settings";
  })();

  // ── Shared state lifted up so it survives tab switches ──────────────────────

  // Settings tab
  const [clinikoStockUpdateEnabled, setClinikoStockUpdateEnabled] = useState(false);
  const [clinikoStockUpdateMsg, setClinikoStockUpdateMsg] = useState("");
  const [showClinikoWarning, setShowClinikoWarning] = useState(false);
  const [smartPromptsMsg, setSmartPromptsMsg] = useState("");
  const { smartPromptsEnabled, updateSmartPromptsSetting, refreshSetting } = useSmartPromptsContext();

  // API key tab
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  // Session timeout tab
  const [sessionTimeout, setSessionTimeout] = useState(8);
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState("");
  const [sessionTimeoutMsg, setSessionTimeoutMsg] = useState("");

  // Sales data sync tab
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStartDate, setSyncStartDate] = useState("");
  const [syncEndDate, setSyncEndDate] = useState("");

  // User management tab
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", is_admin: false });
  const [selectedIds, setSelectedIds] = useState([]);
  const [pwEditId, setPwEditId] = useState(null);
  const [pwEditValue, setPwEditValue] = useState("");
  const [pwEditMsg, setPwEditMsg] = useState("");
  const [userError, setUserError] = useState("");

  // Shared loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Shared props bundles ─────────────────────────────────────────────────────

  const sharedProps = { loading, setLoading, error, setError };

  const settingsProps = {
    clinikoStockUpdateEnabled, setClinikoStockUpdateEnabled,
    clinikoStockUpdateMsg, setClinikoStockUpdateMsg,
    showClinikoWarning, setShowClinikoWarning,
    smartPromptsEnabled, updateSmartPromptsSetting, refreshSetting,
    smartPromptsMsg, setSmartPromptsMsg,
    ...sharedProps,
  };

  const apiKeyProps = {
    apiKeySet, setApiKeySet,
    apiKeyInput, setApiKeyInput,
    apiKeyMsg, setApiKeyMsg,
    ...sharedProps,
  };

  const sessionProps = {
    sessionTimeout, setSessionTimeout,
    sessionTimeoutInput, setSessionTimeoutInput,
    sessionTimeoutMsg, setSessionTimeoutMsg,
    ...sharedProps,
  };

  const salesSyncProps = {
    syncLoading, setSyncLoading,
    syncMessage, setSyncMessage,
    syncStartDate, setSyncStartDate,
    syncEndDate, setSyncEndDate,
  };

  const userMgmtProps = {
    users, setUsers,
    form, setForm,
    selectedIds, setSelectedIds,
    pwEditId, setPwEditId,
    pwEditValue, setPwEditValue,
    pwEditMsg, setPwEditMsg,
    error: userError, setError: setUserError,
    ...sharedProps,
  };

  // ── Tab content ──────────────────────────────────────────────────────────────

  const renderContent = () => {
    switch (activeTab) {
      case "settings":
        return (
          <>
            <Settings {...settingsProps} />
            <ApiKeyManagement {...apiKeyProps} />
            <SessionTimeout {...sessionProps} />
            <SalesDataSync {...salesSyncProps} />
          </>
        );
      case "users":
        return <UserManagement {...userMgmtProps} />;
      case "behavior":
        return <UserBehaviorAnalytics user={user} />;
      case "email-supplier":
        return <EmailSupplierManagement user={user} />;
      default:
        return null;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper user={user}>
      <div style={{ padding: "24px 32px 0 32px" }}>
        <h2 style={{ fontWeight: 700, fontSize: 26, color: "#1867c0", marginBottom: 20 }}>
          Admin
        </h2>

        {/* Tab bar */}
        <div style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #e0e0e0",
          marginBottom: 32,
        }}>
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                style={{
                  padding: "12px 22px",
                  border: "none",
                  background: isActive ? "#1867c0" : "transparent",
                  color: isActive ? "#fff" : "#555",
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 15,
                  cursor: "pointer",
                  borderRadius: "6px 6px 0 0",
                  marginBottom: -2,
                  borderBottom: isActive ? "2px solid #1867c0" : "2px solid transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "#f0f4fa"; e.currentTarget.style.color = "#1867c0"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#555"; } }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {renderContent()}
        </div>
      </div>
    </PageWrapper>
  );
}

export default AdminLayout;
