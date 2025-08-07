import React, { useState } from 'react';


function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <h2>Login</h2>
      <div style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      <button type="submit" style={{ width: '100%', padding: 10, background: '#1867c0', color: '#fff', border: 'none', borderRadius: 4 }}>Login</button>
    </form>
  );
}

export default Login;
