import React, { useState } from 'react';


function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordWarning, setPasswordWarning] = useState('');

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
        setError('Login failed: No token returned');
      }
    } catch (err) {
      console.error('Login error:', err);
      let errMsg = '';
      if (err && typeof err === 'object') {
        if (err.error) errMsg = err.error;
        else if (err.message) errMsg = err.message;
        else errMsg = JSON.stringify(err);
      } else {
        errMsg = err?.toString() || 'Unknown error';
      }
      setError('Login failed: ' + errMsg);
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
