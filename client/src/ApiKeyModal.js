import React from "react";

function ApiKeyModal({ open, isAdmin, onGoToAdmin, onLogout, onSetApiKey }) {
  const [input, setInput] = React.useState("");
  if (!open) return null;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (onSetApiKey) {
      await onSetApiKey(input);
      setInput("");
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
            : "You need to contact your admin to get the API updated."}
        </div>
        {isAdmin ? (
          <>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", gap: 8, marginBottom: 12 }}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter new API key"
                style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 16 }}
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
                  padding: "12px 32px",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(24,103,192,0.09)"
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
          <button
            onClick={onLogout}
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
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default ApiKeyModal;
