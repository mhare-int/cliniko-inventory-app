import React, { useState } from 'react';


function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordWarning, setPasswordWarning] = useState('');

  // Normalize backend/login errors into concise, user-friendly messages
  const normalizeLoginError = (err) => {
    if (!err) return 'Login failed: unknown error';
    if (typeof err === 'string') return `Login failed: ${err}`;

    // Gather candidate messages from common fields
    const candidates = [];
    if (err.error) candidates.push(err.error);
    if (err.message) candidates.push(err.message);
    if (err.details && typeof err.details === 'string') candidates.push(err.details);
    if (err.details && typeof err.details === 'object') {
      if (err.details.error) candidates.push(err.details.error);
      if (err.details.message) candidates.push(err.details.message);
    }
    if (err.response && err.response.data) {
      const d = err.response.data;
      if (d.error) candidates.push(d.error);
      if (d.message) candidates.push(d.message);
      try { candidates.push(JSON.stringify(d)); } catch (e) {}
    }

    const firstRaw = candidates.find(c => c && String(c).trim()) || (err.message || null);
    if (firstRaw) {
      const lc = String(firstRaw).toLowerCase();
      if (lc.includes('invalid') || lc.includes('incorrect') || lc.includes('credentials') || lc.includes('username') || lc.includes('password')) {
        return 'Incorrect username or password. Please check your credentials and try again.';
      }
      if (lc.includes('locked') || lc.includes('disabled')) return 'Your account appears locked or disabled — contact an administrator.';
      if (lc.includes('timeout') || lc.includes('network') || lc.includes('unreachable') || lc.includes('failed to connect')) return 'Network error: unable to reach authentication service. Check your connection.';
      // Handle Electron IPC remote errors that sometimes embed an object in the message
      if (String(firstRaw).includes('[object Object]') || String(firstRaw).toLowerCase().includes('remote method')) {
        console.error('Detailed login error object:', err);
        return 'Authentication service returned an unexpected error. Check your credentials or contact an administrator (details in console).';
      }
      return `Login failed: ${firstRaw}`;
    }

    // Last resort - attempt to stringify the object; log details for developer debugging
    try {
      console.error('Login error (full object):', err);
      const s = JSON.stringify(err);
      if (s && s !== '{}') return `Login failed: ${s}`;
    } catch (e) {
      console.error('Failed to stringify login error', e);
    }
    return 'Login failed: Authentication service error (see console for details).';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordWarning('');
    console.log('Attempting login with username:', username);
    try {
      // Use Electron IPC API
      if (!window.api || !window.api.login) {
        setError('Login not available: window.api.login is missing');
        return;
      }
      const res = await window.api.login(username, password);
      console.log('Login response:', res);
      if (res && res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('loginTime', Date.now().toString());
        
        // Check for password warning
        if (res.needsPasswordChange && res.passwordWarning) {
          setPasswordWarning(res.passwordWarning);
          setTimeout(() => {
            alert('⚠️ SECURITY WARNING: You are using the default password. Please change it immediately in the Admin settings for security!');
          }, 1000);
        }
        
        if (onLogin) onLogin();
      } else {
        setError('Login failed: server did not return an authentication token. Please try again or contact support.');
      }
    } catch (err) {
      // Always show simple mismatch message to users for failed authentication
      setError('Incorrect username or password. Please check your credentials and try again.');
      console.error('Login failed (raw error):', err);
    }
  };

  return (
    <div style={{ maxWidth: 320, margin: '40px auto' }}>
      {/* Good Life Logo */}
      <img
        src={"goodlife.png"}
        alt="Good Life Clinic"
        style={{
          width: 180,
          maxWidth: "70%",
          display: "block",
          margin: "0 auto 24px auto",
          boxShadow: "0 4px 16px 2px rgba(0,0,0,0.08)",
          borderRadius: "12px",
          background: "#fff",
        }}
      />
      
      <form onSubmit={handleSubmit} style={{ padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 20, color: '#333' }}>Login</h2>
      <div style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>
  {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {passwordWarning && (
        <div style={{ 
          color: '#e65100', 
          background: '#fff3e0', 
          border: '1px solid #ffcc02', 
          padding: '8px', 
          borderRadius: '4px', 
          marginBottom: 12,
          fontSize: '14px'
        }}>
          🔒 {passwordWarning}
        </div>
      )}
      <button type="submit" style={{ width: '100%', padding: 10, background: '#1867c0', color: '#fff', border: 'none', borderRadius: 4 }}>Login</button>
    </form>
    </div>
  );
}

export default Login;
