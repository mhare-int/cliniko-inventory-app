import React, { useEffect } from "react";

function ApiKeyManagement({ apiKeySet, setApiKeySet, apiKeyInput, setApiKeyInput, apiKeyMsg, setApiKeyMsg, loading, setLoading }) {
  // Fetch API key status
  useEffect(() => {
    if (!window.api || !window.api.getApiKey) {
      setApiKeySet(false);
      return;
    }
    window.api.getApiKey()
      .then(res => setApiKeySet(res.api_key))
      .catch(() => setApiKeySet(false));
  }, [setApiKeySet]);

  // Handle API key submit
  const handleApiKeySubmit = async e => {
    e.preventDefault();
    setApiKeyMsg("");
    if (!apiKeyInput.trim()) {
      setApiKeyMsg("API key cannot be empty.");
      return;
    }
    setLoading(true);
    let keyToSend = apiKeyInput.trim();
    if (!keyToSend.toUpperCase().startsWith("BASIC ")) {
      keyToSend = "BASIC " + keyToSend;
    }
    try {
      if (!window.api || !window.api.setApiKey) throw new Error("API key set not available");
      await window.api.setApiKey(keyToSend);
      setApiKeyMsg("API key updated successfully.");
      setApiKeySet(true);
      setApiKeyInput("");
    } catch (err) {
      setApiKeyMsg(err?.error || err?.message || "Failed to update API key.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#f6f9fb", border: "1px solid #ddeeff", borderRadius: 10, padding: "22px 24px 18px 24px", marginBottom: 32 }}>
      <h3 style={{ fontWeight: 700, fontSize: 22, color: "#1867c0", marginBottom: 10 }}>API Key Management</h3>
      <div style={{ marginBottom: 10, fontSize: 16 }}>
        API key is currently <b>{apiKeySet ? "SET" : "NOT SET"}</b>.
      </div>
      <form onSubmit={handleApiKeySubmit} style={{ display: "flex", gap: 12, alignItems: "flex-end", justifyContent: "flex-end", marginTop: 2 }}>
        <input type="text" placeholder="Enter new API key" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0 14px", fontSize: 17, height: 48, background: "#f8fafb", width: "50%", boxSizing: "border-box" }} disabled={loading} />
        <button type="submit" style={{ background: "#1867c0", color: "#fff", width: "50%", height: 48, borderRadius: 7, border: "none", fontWeight: 700, fontSize: 21, cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 4px rgba(24,103,192,0.09)", transition: "background 0.2s", marginLeft: 6, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }} disabled={loading}>
          {loading ? "Saving..." : (apiKeySet ? "Update API Key" : "Set API Key")}
        </button>
      </form>
      {apiKeyMsg && <div style={{ color: apiKeyMsg.includes("success") ? "#228b22" : "#c00", marginTop: 8, fontSize: 15 }}>{apiKeyMsg}</div>}
    </div>
  );
}

export default ApiKeyManagement;
