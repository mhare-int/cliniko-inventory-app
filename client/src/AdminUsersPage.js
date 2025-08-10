
import React, { useState, useEffect, useContext } from "react";
import AdminPageTabs from "./AdminPageTabs";
import { SmartPromptsContext } from "./contexts/SmartPromptsContext";

function AdminUsersPage() {
  // --- User Management State ---
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", is_admin: false });
  const [selectedIds, setSelectedIds] = useState([]);
  const [pwEditId, setPwEditId] = useState(null);
  const [pwEditValue, setPwEditValue] = useState("");
  const [pwEditMsg, setPwEditMsg] = useState("");
  const [error, setError] = useState("");

  // --- API Key State ---
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  // --- Session Timeout State ---
  const [sessionTimeout, setSessionTimeout] = useState(12);
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState("");
  const [sessionTimeoutMsg, setSessionTimeoutMsg] = useState("");

  // --- Settings State ---
  const [clinikoStockUpdateEnabled, setClinikoStockUpdateEnabled] = useState(false);
  const [clinikoStockUpdateMsg, setClinikoStockUpdateMsg] = useState("");
  const [showClinikoWarning, setShowClinikoWarning] = useState(false);
  const [smartPromptsMsg, setSmartPromptsMsg] = useState("");
  const { smartPromptsEnabled, updateSmartPromptsSetting, refreshSetting } = useContext(SmartPromptsContext);

  // --- Sales Data Sync State ---
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStartDate, setSyncStartDate] = useState("");
  const [syncEndDate, setSyncEndDate] = useState("");

  // --- Loading State (shared) ---
  const [loading, setLoading] = useState(false);

  // Provide all state and setters as props for now
  const tabProps = {
    // User Management
    users, setUsers, form, setForm, selectedIds, setSelectedIds, pwEditId, setPwEditId, pwEditValue, setPwEditValue, pwEditMsg, setPwEditMsg, error, setError,
    // API Key
    apiKeySet, setApiKeySet, apiKeyInput, setApiKeyInput, apiKeyMsg, setApiKeyMsg,
    // Session Timeout
    sessionTimeout, setSessionTimeout, sessionTimeoutInput, setSessionTimeoutInput, sessionTimeoutMsg, setSessionTimeoutMsg,
    // Settings
    clinikoStockUpdateEnabled, setClinikoStockUpdateEnabled, clinikoStockUpdateMsg, setClinikoStockUpdateMsg, showClinikoWarning, setShowClinikoWarning,
    smartPromptsEnabled, updateSmartPromptsSetting, refreshSetting, smartPromptsMsg, setSmartPromptsMsg,
    // Sales Data Sync
    syncLoading, setSyncLoading, syncMessage, setSyncMessage, syncStartDate, setSyncStartDate, syncEndDate, setSyncEndDate,
    // Shared
    loading, setLoading
  };

  return (
    <AdminPageTabs {...tabProps} />
  );
}

export default AdminUsersPage;
