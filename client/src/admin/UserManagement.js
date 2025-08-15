import React, { useEffect } from "react";

function UserManagement({
  users, setUsers, form, setForm, selectedIds, setSelectedIds,
  pwEditId, setPwEditId, pwEditValue, setPwEditValue, pwEditMsg, setPwEditMsg,
  error, setError, loading, setLoading
}) {
  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        if (!window.api || !window.api.getAllUsers) throw new Error("getAllUsers not available");
        const res = await window.api.getAllUsers();
        setUsers(res);
      } catch (err) {
        setError("Could not fetch users.");
      }
    };
    fetchUsers();
  }, [setUsers, setError]);

  // Add user
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!window.api || !window.api.addUser) throw new Error("addUser not available");
      await window.api.addUser(form.username, form.password, form.is_admin);
      setForm({ username: "", password: "", is_admin: false });
      // Refresh users
      if (window.api && window.api.getAllUsers) {
        const res = await window.api.getAllUsers();
        setUsers(res);
      }
    } catch (err) {
      setError(err?.error || err?.message || "Failed to add user.");
    }
    setLoading(false);
  };

  // Change password
  const handleChangePassword = async (userId) => {
    setPwEditMsg("");
    if (!pwEditValue || pwEditValue.length < 4) {
      setPwEditMsg("Password must be at least 4 characters.");
      return;
    }
    setLoading(true);
    try {
      if (!window.api || !window.api.changeUserPassword) throw new Error("changeUserPassword not available");
      await window.api.changeUserPassword(userId, pwEditValue);
      alert("Password updated successfully!");
      setPwEditMsg("Password updated successfully.");
      setPwEditId(null);
      setPwEditValue("");
    } catch (err) {
      setPwEditMsg(err?.error || err?.message || "Failed to update password.");
    }
    setLoading(false);
  };

  // Selection handlers
  const handleSelect = (id, checked) => {
    setSelectedIds(ids => checked ? [...ids, id] : ids.filter(x => x !== id));
  };

  // Delete selected users
  const handleDeleteSelected = async (idsToDelete) => {
    setLoading(true);
    const ids = idsToDelete || selectedIds;
    try {
      if (!window.api || !window.api.deleteUser) throw new Error("deleteUser not available");
      for (const userId of ids) {
        await window.api.deleteUser(userId);
      }
      setSelectedIds([]);
      if (window.api && window.api.getAllUsers) {
        const res = await window.api.getAllUsers();
        setUsers(res);
      }
    } catch (err) {
      setError(err?.error || err?.message || "Failed to delete user(s).");
    }
    setLoading(false);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 32, marginTop: 16 }}>
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0 14px", fontSize: 17, height: 48, background: "#f8fafb", width: 200, boxSizing: "border-box" }} />
        <input name="password" placeholder="Password" type="password" value={form.password} onChange={handleChange} required style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0 14px", fontSize: 17, height: 48, background: "#f8fafb", width: 200, boxSizing: "border-box" }} />
        <label style={{ display: "flex", alignItems: "center", fontSize: 16, fontWeight: 500, userSelect: "none", gap: 6, whiteSpace: "nowrap", height: 48, margin: 0, padding: 0, boxSizing: "border-box" }}>
          <input type="checkbox" name="is_admin" checked={form.is_admin} onChange={handleChange} style={{ width: 20, height: 20 }} />
          Admin?
        </label>
        <button type="submit" style={{ background: "#1867c0", color: "#fff", minWidth: 180, height: 48, borderRadius: 7, border: "none", fontWeight: 700, fontSize: 21, cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 4px rgba(24,103,192,0.09)", transition: "background 0.2s", marginLeft: 6, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }} disabled={loading}>
          {loading ? "Adding..." : "Add User"}
        </button>
      </form>
      <h3 style={{ fontWeight: 600, margin: "18px 0 10px 0", fontSize: 20 }}>All Users</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafbfc", marginBottom: 0, tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "#f6f9fb" }}>
            <th style={{ width: 40, textAlign: "center", border: "1px solid #ddd", height: 48, verticalAlign: "middle" }}></th>
            <th style={{ border: "1px solid #ddd", padding: 8, fontWeight: 700, fontSize: 16, textAlign: "left", height: 48, verticalAlign: "middle", width: 200 }}>Username</th>
            <th style={{ border: "1px solid #ddd", padding: 8, fontWeight: 700, fontSize: 16, textAlign: "left", height: 48, verticalAlign: "middle", width: 100 }}>Role</th>
            <th style={{ border: "1px solid #ddd", padding: 8, fontWeight: 700, fontSize: 16, textAlign: "center", height: 48, verticalAlign: "middle", width: 320 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #e4e4e4", background: selectedIds.includes(u.id) ? "#eaf6fb" : "#fff", height: 48 }}>
              <td style={{ textAlign: "center", border: "1px solid #eee", verticalAlign: "middle", height: 48, lineHeight: "48px" }}>
                <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={e => handleSelect(u.id, e.target.checked)} style={{ width: 18, height: 18 }} />
              </td>
              <td style={{ border: "1px solid #eee", padding: 8, fontSize: 16, verticalAlign: "middle", height: 48, lineHeight: "48px" }}>{u.username}</td>
              <td style={{ border: "1px solid #eee", padding: 8, fontSize: 16, verticalAlign: "middle", height: 48, lineHeight: "48px" }}>{u.is_admin ? <span style={{ color: "#228b22", fontWeight: 600 }}>admin</span> : "user"}</td>
              <td style={{ border: "1px solid #eee", padding: "8px", fontSize: 16, verticalAlign: "middle", textAlign: "right", height: 48, width: 320, overflow: "hidden" }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: 32, width: '100%' }}>
                  {pwEditId === u.id ? (
                    <>
                      <input type="password" value={pwEditValue} onChange={e => setPwEditValue(e.target.value)} placeholder="New password" style={{ width: 240, fontSize: 14, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", background: "#f8fafb", boxSizing: "border-box", margin: 0, outline: 'none' }} disabled={loading} />
                      <button style={{ background: "#1867c0", color: "#fff", width: 60, borderRadius: 6, border: "none", fontWeight: 600, fontSize: 12, cursor: loading ? "wait" : "pointer", boxShadow: "0 1px 4px rgba(24,103,192,0.09)", transition: "background 0.2s", padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }} disabled={loading} onClick={() => handleChangePassword(u.id)}>Save</button>
                      <button style={{ background: "#eee", color: "#333", width: 60, borderRadius: 6, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", margin: 0, flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => { setPwEditId(null); setPwEditValue(""); setPwEditMsg(""); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button style={{ background: "#1867c0", color: "#fff", borderRadius: 6, border: "none", fontWeight: 600, fontSize: 12, cursor: loading ? "wait" : "pointer", padding: "4px 6px", boxSizing: "border-box", margin: 0, flexShrink: 0, whiteSpace: 'nowrap', width: "48%" }} disabled={loading} onClick={() => { setPwEditId(u.id); setPwEditValue(""); setPwEditMsg(""); }}>Change Password</button>
                      <button style={{ background: "#fff0f0", color: "#c00", borderRadius: 6, border: "1.5px solid #c00", fontWeight: 600, fontSize: 12, cursor: loading ? "wait" : "pointer", padding: "4px 6px", boxSizing: "border-box", margin: 0, flexShrink: 0, whiteSpace: 'nowrap', width: "48%" }} disabled={loading} onClick={() => handleDeleteSelected([u.id])}>Delete</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {pwEditMsg && users.map(u => pwEditId === u.id && (
            <tr key={`msg-${u.id}`}>
              <td colSpan="4" style={{ border: "1px solid #eee", padding: "8px", background: "#f9f9f9", color: pwEditMsg.includes('success') ? '#228b22' : '#c00', fontSize: 14, textAlign: "center" }}>{pwEditMsg}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ background: selectedIds.length ? "#d32f2f" : "#ccc", border: "none", color: "#fff", fontSize: 17, fontWeight: 600, cursor: selectedIds.length ? "pointer" : "not-allowed", outline: "none", padding: "13px 38px", borderRadius: 6, transition: "background 0.2s", marginTop: 30, marginLeft: 0, minWidth: 190, boxShadow: "0 2px 8px 0 rgba(50,0,0,0.03)", display: "block" }} disabled={selectedIds.length === 0 || loading} onClick={() => handleDeleteSelected()}>Delete Selected</button>
      {error && <div style={{ background: "#fdeaea", color: "#c00", padding: 10, borderRadius: 6, marginBottom: 15 }}>{error}</div>}
    </div>
  );
}

export default UserManagement;
