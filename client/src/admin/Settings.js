import React, { useEffect } from "react";

function Settings({
  clinikoStockUpdateEnabled, setClinikoStockUpdateEnabled, clinikoStockUpdateMsg, setClinikoStockUpdateMsg, showClinikoWarning, setShowClinikoWarning,
  smartPromptsEnabled, updateSmartPromptsSetting, refreshSetting, smartPromptsMsg, setSmartPromptsMsg, loading, setLoading
}) {
  // Fetch Cliniko stock update setting
  useEffect(() => {
    if (window.api && window.api.getClinikoStockUpdateSetting) {
      window.api.getClinikoStockUpdateSetting()
        .then(res => setClinikoStockUpdateEnabled(res.enabled || false))
        .catch(() => setClinikoStockUpdateEnabled(false));
    }
  }, [setClinikoStockUpdateEnabled]);

  // Handle Cliniko stock update toggle
  const handleClinikoStockUpdateToggle = async (enabled) => {
    if (enabled && !showClinikoWarning) {
      setShowClinikoWarning(true);
      return;
    }
    setClinikoStockUpdateMsg("");
    setLoading(true);
    try {
      if (!window.api || !window.api.setClinikoStockUpdateSetting) {
        throw new Error("setClinikoStockUpdateSetting not available");
      }
      await window.api.setClinikoStockUpdateSetting(enabled);
      if (window.api && window.api.getClinikoStockUpdateSetting) {
        const res = await window.api.getClinikoStockUpdateSetting();
        setClinikoStockUpdateEnabled(res.enabled || false);
      } else {
        setClinikoStockUpdateEnabled(enabled);
      }
      setClinikoStockUpdateMsg(enabled ?
        "⚠️ Cliniko stock updates ENABLED. Stock will be updated when items are received." :
        "✅ Cliniko stock updates DISABLED. Safe for testing."
      );
      setShowClinikoWarning(false);
    } catch (err) {
      setClinikoStockUpdateMsg(err?.error || err?.message || "Failed to update setting.");
    }
    setLoading(false);
  };

  // Handle Smart Prompts toggle using context
  const handleSmartPromptsToggle = async (enabled) => {
    setSmartPromptsMsg("");
    setLoading(true);
    try {
      await updateSmartPromptsSetting(enabled);
      await refreshSetting();
      setSmartPromptsMsg(enabled ?
        "✅ Smart prompts ENABLED. Helpful hints will be shown to users." :
        "⚠️ Smart prompts DISABLED. Users will see minimal guidance."
      );
    } catch (err) {
      setSmartPromptsMsg(err?.error || err?.message || "Failed to update setting.");
    }
    setLoading(false);
  };

  return (
    <>
      {/* CLINIKO STOCK UPDATE SETTING */}
      <div style={{ background: clinikoStockUpdateEnabled ? "#fff5f5" : "#f6f9fb", border: clinikoStockUpdateEnabled ? "1px solid #ffdddd" : "1px solid #ddeeff", borderRadius: 10, padding: "22px 24px 18px 24px", marginBottom: 32 }}>
        <h3 style={{ fontWeight: 700, fontSize: 22, color: clinikoStockUpdateEnabled ? "#c53030" : "#1867c0", marginBottom: 10 }}>⚠️ Cliniko Stock Updates</h3>
        <div style={{ marginBottom: 15, fontSize: 16, lineHeight: 1.5 }}>
          <strong>Current status:</strong> <b style={{ color: clinikoStockUpdateEnabled ? "#c53030" : "#228b22" }}>{clinikoStockUpdateEnabled ? "ENABLED - Will update Cliniko stock" : "DISABLED - Safe for testing"}</b>
        </div>
        <div style={{ marginBottom: 15, fontSize: 14, color: "#666", lineHeight: 1.4 }}>
          When enabled, receiving items will automatically update stock quantities in Cliniko. <strong> Keep this DISABLED during testing to prevent corrupting live stock data.</strong>
        </div>
        {showClinikoWarning && (
          <div style={{ background: "#fff3cd", border: "1px solid #ffeaa7", borderRadius: 6, padding: "12px 16px", marginBottom: 15, fontSize: 14 }}>
            <strong>⚠️ WARNING:</strong> You are about to enable automatic Cliniko stock updates. This will modify live stock data when items are received. Are you sure you want to continue?
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button onClick={() => handleClinikoStockUpdateToggle(true)} disabled={loading} style={{ background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}>{loading ? "Enabling..." : "Yes, Enable Stock Updates"}</button>
              <button onClick={() => setShowClinikoWarning(false)} style={{ background: "#6c757d", color: "#fff", border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => handleClinikoStockUpdateToggle(!clinikoStockUpdateEnabled)} disabled={loading} style={{ background: clinikoStockUpdateEnabled ? "#28a745" : "#dc3545", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 16, fontWeight: 600, cursor: loading ? "wait" : "pointer", transition: "background 0.2s" }}>{loading ? "Updating..." : (clinikoStockUpdateEnabled ? "🔒 Disable Stock Updates" : "🔓 Enable Stock Updates")}</button>
        </div>
        {clinikoStockUpdateMsg && (<div style={{ color: clinikoStockUpdateMsg.includes("ENABLED") ? "#c53030" : "#228b22", marginTop: 10, fontSize: 15, fontWeight: 500 }}>{clinikoStockUpdateMsg}</div>)}
      </div>
      {/* SMART PROMPTS SETTING */}
      <div style={{ border: "2px solid #e2e8f0", borderRadius: 12, padding: 24, marginBottom: 32, backgroundColor: "#f8fafc", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07)" }}>
        <h3 style={{ color: "#2d3748", marginBottom: 16, fontSize: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>💡 Smart Prompts Setting</h3>
        <p style={{ color: "#4a5568", marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}>Control whether helpful prompts and hints are shown throughout the application to guide users.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 15 }}>
          <strong style={{ color: "#2d3748", fontSize: 16 }}>
            Status: {smartPromptsEnabled ? <span style={{ color: "#38a169" }}>✅ ENABLED</span> : <span style={{ color: "#e53e3e" }}>❌ DISABLED</span>}
          </strong>
          <button type="button" disabled={loading} onClick={() => handleSmartPromptsToggle(!smartPromptsEnabled)} style={{ backgroundColor: smartPromptsEnabled ? "#e53e3e" : "#38a169", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1, transition: "all 0.2s" }}>{loading ? "Updating..." : (smartPromptsEnabled ? "🔇 Disable Prompts" : "💬 Enable Prompts")}</button>
        </div>
        {smartPromptsMsg && (<div style={{ color: smartPromptsMsg.includes("ENABLED") ? "#38a169" : "#e53e3e", marginTop: 10, fontSize: 15, fontWeight: 500 }}>{smartPromptsMsg}</div>)}
      </div>
    </>
  );
}

export default Settings;
