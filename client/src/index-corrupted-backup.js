
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";

import App from "./App";
import CreatePurchaseRequests from "./CreatePurchaseRequests";
import GenerateSupplierFiles from "./GenerateSupplierFiles";
import Purchase        <Route
          path="/admin"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <AdminLayout user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <AdminLayout user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/behavior-analytics"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <AdminLayout user={user} />
            </RequireAuth>
          }
        />/purchaseRequests";
import ArchivedPurchaseRequests from "./ArchivedPurchaseRequests";
import MasterList from "./MasterList";
import SalesInsights from "./SalesInsights";
import ReceiveItemsPage from "./ReceiveItemsPage";
import AdminUsersPage from "./AdminUsersPage";
import AdminLayout from "./AdminLayout";
import Login from "./Login";
import TabsNav from "./TabsNav";
import RequireAuth from "./RequireAuth";
import { useBehaviorTracking } from "./hooks/useBehaviorTracking";

// Robust API base URL logic for Electron/packaged and browser environments
const API_BASE_URL = window?.process?.versions?.electron
  ? "http://localhost:5000"
  : (window.API_BASE_URL || "");

function MainApp() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const navigate = useNavigate();

  // Auto-sync notification state
  const [autoSyncNotification, setAutoSyncNotification] = useState(null); // null, 'syncing', 'completed', 'error'
  const [autoSyncDetails, setAutoSyncDetails] = useState('');

  // Initialize behavior tracking
  const behaviorTracking = useBehaviorTracking(user);

  // Fetch the current user on load

  const [sessionTimeoutHours, setSessionTimeoutHours] = useState(12); // default 12h

  // Fetch session timeout on mount
  useEffect(() => {
    async function fetchTimeout() {
      if (window.api && window.api.getSessionTimeout) {
        try {
          const res = await window.api.getSessionTimeout();
          if (res && res.hours) setSessionTimeoutHours(res.hours);
        } catch {}
      }
    }
    fetchTimeout();
  }, []);

  const fetchCurrentUser = async () => {
    setLoadingUser(true);
    try {
      const token = localStorage.getItem('token');
      const loginTime = parseInt(localStorage.getItem('loginTime'), 10);
      const now = Date.now();
      const maxAgeMs = sessionTimeoutHours * 60 * 60 * 1000;
      if (!token || !loginTime || now - loginTime > maxAgeMs) {
        localStorage.removeItem('token');
        localStorage.removeItem('loginTime');
        setUser(null);
        setIsAuthed(false);
        setLoadingUser(false);
        return;
      }
      if (!window.api || !window.api.getCurrentUser) throw new Error("window.api.getCurrentUser is not available");
      const user = await window.api.getCurrentUser(token);
      setUser(user);
      setIsAuthed(true);
    } catch {
      setUser(null);
      setIsAuthed(false);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    // eslint-disable-next-line
  }, [sessionTimeoutHours]);

  // Auto-sync sales data when app starts (after authentication)
  useEffect(() => {
    if (isAuthed && window.api && window.api.updateSalesDataFromCliniko) {
      performAutoSync();
    }
  }, [isAuthed]);

  const performAutoSync = async () => {
    setAutoSyncNotification('syncing');
    setAutoSyncDetails('Updating stock levels from Cliniko...');

    try {
      // First update stock levels
      const stockResult = await window.api.updateStockFromCliniko();
      
      if (stockResult.error) {
        setAutoSyncNotification('error');
        setAutoSyncDetails(`Stock update error:\n${stockResult.error}`);
        return;
      }

      // Update notification for sales sync
      setAutoSyncDetails('Checking for new sales data...');
      
      // Then sync sales data
      const salesResult = await window.api.updateSalesDataFromCliniko(); // No dates = auto mode
      
      if (salesResult.error) {
        setAutoSyncNotification('error');
        setAutoSyncDetails(`Sales sync error:\n${salesResult.error}`);
      } else if (salesResult.skipped) {
        // Both operations completed successfully
        setAutoSyncNotification('completed');
        setAutoSyncDetails(`✅ Sync completed!\nUpdated ${stockResult.total || 0} product stock levels. Sales data is up to date - no new invoices to sync.`);
      } else {
        setAutoSyncNotification('completed');
        setAutoSyncDetails(`✅ Sync completed!\nUpdated ${stockResult.total || 0} product stock levels and processed ${salesResult.invoicesProcessed || 0} invoices with ${salesResult.salesRecordsInserted || 0} sales records.`);
      }
    } catch (error) {
      console.error('Auto-sync error:', error);
      setAutoSyncNotification('error');
      setAutoSyncDetails(`Sync error:\n${error.message || 'Failed to sync data'}`);
    }

    // Auto-hide notification after 6 seconds (longer since there's more info)
    setTimeout(() => {
      setAutoSyncNotification(null);
      setAutoSyncDetails('');
    }, 6000);
  };

  const handleLogin = async () => {
    await fetchCurrentUser();
    navigate("/");
  };

  const handleLogout = async () => {
    // Track logout behavior
    if (behaviorTracking.trackFeatureUse) {
      behaviorTracking.trackFeatureUse('authentication', { action: 'logout' });
    }
    
    if (window.api && window.api.logout) {
      await window.api.logout();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('loginTime');
    setUser(null);
    setIsAuthed(false);
    navigate("/login");
  };


  // Debug: log auth state
  // Remove or comment out after debugging
  console.log("isAuthed:", isAuthed, "user:", user, "loadingUser:", loadingUser);



  useEffect(() => {
    if (!isAuthed && !loadingUser && window.location.hash !== '#/login') {
      navigate('/login');
    }
  }, [isAuthed, loadingUser, navigate]);

  if (loadingUser) return <div>Loading...</div>;

  return (
    <>
      {(isAuthed || loadingUser) && <TabsNav isAuthed={isAuthed} user={user} onLogout={handleLogout} />}
      
      {/* Auto-sync notification popup */}
      {autoSyncNotification && (
        <div style={{
          position: 'fixed',
          top: '80px', // Below the navigation
          right: '20px',
          zIndex: 9999,
          background: autoSyncNotification === 'error' ? '#ffebee' : autoSyncNotification === 'completed' ? '#e8f5e8' : '#e3f2fd',
          color: autoSyncNotification === 'error' ? '#c62828' : autoSyncNotification === 'completed' ? '#2e7d32' : '#1565c0',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          border: `2px solid ${autoSyncNotification === 'error' ? '#ef5350' : autoSyncNotification === 'completed' ? '#4caf50' : '#42a5f5'}`,
          maxWidth: '380px',
          minWidth: '320px',
          fontSize: '0.9em',
          fontWeight: '500',
          animation: 'slideInFromRight 0.3s ease-out',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ 
              fontSize: '20px', 
              lineHeight: '1',
              marginTop: '2px',
              flexShrink: 0
            }}>
              {autoSyncNotification === 'syncing' ? '🔄' : autoSyncNotification === 'completed' ? '✅' : '❌'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: '600', 
                marginBottom: '6px',
                fontSize: '0.95em',
                lineHeight: '1.3'
              }}>
                {autoSyncNotification === 'syncing' ? 'Syncing Sales Data...' : 
                 autoSyncNotification === 'completed' ? 'Sync Complete!' : 'Sync Error'}
              </div>
              <div style={{ 
                fontSize: '0.85em', 
                opacity: 0.85,
                lineHeight: '1.4',
                wordBreak: 'break-word',
                whiteSpace: 'pre-line'
              }}>
                {autoSyncDetails}
              </div>
            </div>
            {autoSyncNotification !== 'syncing' && (
              <button
                onClick={() => {
                  setAutoSyncNotification(null);
                  setAutoSyncDetails('');
                }}
                style={{
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  opacity: 0.7,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  lineHeight: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '1';
                  e.target.style.background = 'rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '0.7';
                  e.target.style.background = 'rgba(0,0,0,0.1)';
                }}
                title="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route
          path="/"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <App />
            </RequireAuth>
          }
        />
        <Route
          path="/create-pr"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <CreatePurchaseRequests />
            </RequireAuth>
          }
        />
        <Route
          path="/generate-supplier-files"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <GenerateSupplierFiles />
            </RequireAuth>
          }
        />
        <Route
          path="/purchase-requests"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <PurchaseRequests />
            </RequireAuth>
          }
        />
        <Route
          path="/archived"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <ArchivedPurchaseRequests />
            </RequireAuth>
          }
        />
        <Route
          path="/master-list"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <MasterList />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <AdminUsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/sales-insights"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <SalesInsights user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/receive-items"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <ReceiveItemsPage user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/behavior-analytics"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <UserBehaviorAnalytics user={user} />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

function MainWrapper() {
  return (
    <HashRouter>
      <MainApp />
    </HashRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MainWrapper />);
