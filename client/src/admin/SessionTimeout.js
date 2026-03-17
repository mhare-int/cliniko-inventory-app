import React, { useEffect } from "react";

function SessionTimeout({ sessionTimeout, setSessionTimeout, sessionTimeoutInput, setSessionTimeoutInput, sessionTimeoutMsg, setSessionTimeoutMsg, loading, setLoading }) {
  useEffect(() => {
    if (window.api && window.api.getSessionTimeout) {
      window.api.getSessionTimeout().then(res => {
        if (res && res.hours) setSessionTimeout(res.hours);
      });
    }
  }, [setSessionTimeout]);

  const handleSessionTimeoutSubmit = async (e) => {
    e.preventDefault();
    setSessionTimeoutMsg("");
    const val = Number(sessionTimeoutInput);
    if (!val || isNaN(val) || val <= 0) {
      setSessionTimeoutMsg("Please enter a valid number of hours (greater than 0).");
      return;
    }
    setLoading(true);
    try {
      if (!window.api || !window.api.setSessionTimeout) throw new Error("setSessionTimeout not available");
      await window.api.setSessionTimeout(val);
      setSessionTimeout(val);
      setSessionTimeoutInput("");
      setSessionTimeoutMsg("Session timeout updated successfully.");
    } catch (err) {
      setSessionTimeoutMsg(err?.error || err?.message || "Failed to update session timeout.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#f6f9fb", border: "1px solid #ddeeff", borderRadius: 10, padding: "18px 24px 14px 24px", marginBottom: 24 }}>
      <h3 style={{ fontWeight: 700, fontSize: 22, color: "#1867c0", marginBottom: 10 }}>Session Timeout</h3>
      <div style={{ marginBottom: 10, fontSize: 16 }}>
        Current session timeout: <b>{sessionTimeout} hour{sessionTimeout === 1 ? '' : 's'}</b>.
      </div>
      <form onSubmit={handleSessionTimeoutSubmit} style={{ display: "flex", gap: 12, alignItems: "flex-end", justifyContent: "flex-end", marginTop: 2 }}>
        <input type="number" min="1" placeholder="Enter hours (e.g. 12)" value={sessionTimeoutInput} onChange={e => setSessionTimeoutInput(e.target.value)} style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0 14px", fontSize: 17, height: 48, background: "#f8fafb", width: "50%", boxSizing: "border-box" }} disabled={loading} />
        <button type="submit" style={{ background: "#1867c0", color: "#fff", width: "50%", height: 48, borderRadius: 7, border: "none", fontWeight: 700, fontSize: 21, cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 4px rgba(24,103,192,0.09)", transition: "background 0.2s", marginLeft: 6, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }} disabled={loading}>
          {loading ? "Saving..." : "Update Timeout"}
        </button>
      </form>
      {sessionTimeoutMsg && <div style={{ color: sessionTimeoutMsg.includes("success") ? "#228b22" : "#c00", marginTop: 8, fontSize: 15 }}>{sessionTimeoutMsg}</div>}
    </div>
  );
}

export default SessionTimeout;
