import React from 'react';

export default function UpdateToast({ visible, status, percent, version, onInstall }) {
  if (!visible) return null;
  const style = {
    position: 'fixed',
    right: 20,
    bottom: 20,
    background: '#003366',
    color: 'white',
    padding: '12px 16px',
    borderRadius: 8,
    zIndex: 9999,
    boxShadow: '0 6px 18px rgba(0,0,0,0.2)'
  };

  return (
    <div style={style}>
      <div style={{fontWeight: 600, marginBottom: 6}}>Update</div>
      <div style={{marginBottom: 8}}>
        {status === 'available' && `New version available: ${version}. Downloading...`}
        {status === 'progress' && `Downloading: ${Math.round(percent || 0)}%`}
        {status === 'ready' && `Update ${version} downloaded.`}
      </div>
      {status === 'ready' && (
        <button onClick={onInstall} style={{background:'#fff', color:'#003366', padding:'8px 12px', borderRadius:6, border:'none', cursor:'pointer'}}>Restart & Install</button>
      )}
    </div>
  );
}
