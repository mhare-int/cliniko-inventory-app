import React from "react";

function ApiKeyModal({ open, isAdmin, onGoToAdmin, onLogout, onSetApiKey, onExitApp }) {
  const [input, setInput] = React.useState("");
  if (!open) return null;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSetApiKey) {
      try {
        await onSetApiKey(input);
        setInput("");
        // Reload the app to re-check API key and trigger any initial data loading
        window.location.reload();
      } catch (error) {
        console.error('Error setting API key:', error);
        // Don't reload if there was an error
      }
    }
  };
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.35)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 2px 16px rgba(0,0,0,0.13)",
        padding: "38px 38px 32px 38px",
        minWidth: 340,
        maxWidth: 400,
        textAlign: "center"
      }}>
        <h2 style={{ color: "#1867c0", fontWeight: 700, fontSize: 26, marginBottom: 18 }}>API Key Required</h2>
        <div style={{ fontSize: 18, marginBottom: 24 }}>
          The Cliniko API key is not set. {isAdmin
            ? "Please set the API key to continue."
            : "You need to contact your admin to set up the API key. The app cannot function without it."}
        </div>
        {isAdmin ? (
          <>
            <form
              onSubmit={handleSubmit}
              style={{ marginBottom: 12 }}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter new API key"
                style={{ 
                  width: "100%", 
                  height: 48,
                  padding: "0 16px", 
                  borderRadius: 7, 
                  border: "1px solid #ccc", 
                  fontSize: 16,
                  marginBottom: 12,
                  boxSizing: "border-box"
                }}
                autoFocus
              />
              <button
                type="submit"
                style={{
                  background: "#1867c0",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 18,
                  border: "none",
                  borderRadius: 7,
                  height: 48,
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(24,103,192,0.09)",
                  width: "100%"
                }}
              >
                Set API Key
              </button>
            </form>
            <button
              onClick={onGoToAdmin}
              style={{
                background: "#1867c0",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
                border: "none",
                borderRadius: 7,
                padding: "12px 32px",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(24,103,192,0.09)",
                marginTop: 8
              }}
            >
              Go to Admin User Page
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, marginBottom: 20, color: "#666" }}>
              Contact your administrator to set up the API key, then restart the app.
            </div>
            <button
              onClick={onExitApp || onLogout}
              style={{
                background: "#dc3545",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
                border: "none",
                borderRadius: 7,
                padding: "12px 32px",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(220,53,69,0.09)",
                marginTop: 8
              }}
            >
              Exit App
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ApiKeyModal;
