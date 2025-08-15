
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";

import App from "./App";
import CreatePurchaseRequests from "./CreatePurchaseRequests";
import GenerateSupplierFiles from "./GenerateSupplierFiles";
import PurchaseRequests from "./purchaseRequests";
import ArchivedPurchaseRequests from "./ArchivedPurchaseRequests";
import MasterList from "./MasterList";
import TabsNav from "./TabsNav";
import Login from "./Login";
import RequireAuth from "./RequireAuth";
import AdminUsersPage from "./AdminUsersPage";
import AdminLayout from "./AdminLayout";
import UserBehaviorAnalytics from "./UserBehaviorAnalytics";
import SalesInsights from "./SalesInsights";
import ReceiveItemsPage from "./ReceiveItemsPage";
import KnowledgeBase from "./KnowledgeBase";
import ApiKeyModal from "./ApiKeyModal";
import FirstTimeSetup from "./FirstTimeSetup";
import PageWrapper from "./PageWrapper";
import { useBehaviorTracking } from "./hooks/useBehaviorTracking";
import { SmartPromptsProvider } from "./contexts/SmartPromptsContext";
// Robust API base URL logic for Electron/packaged and browser environments
const API_BASE_URL = window?.process?.versions?.electron
  ? "http://localhost:5000"
  : (window.API_BASE_URL || "");

function MainApp() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const navigate = useNavigate();

  // First time setup state
  const [isFirstTime, setIsFirstTime] = useState(null); // null = checking, true = first time, false = already setup
  const [checkingFirstTime, setCheckingFirstTime] = useState(true);
  const [isInSetupProcess, setIsInSetupProcess] = useState(false); // Track if we're currently going through setup
  const [disableAutoSyncThisSession, setDisableAutoSyncThisSession] = useState(false); // Disable auto-sync for entire first-time setup session

  // Auto-sync notification state
  const [autoSyncNotification, setAutoSyncNotification] = useState(null); // null, 'syncing', 'completed', 'error'
  const [autoSyncDetails, setAutoSyncDetails] = useState('');

  // Setup completion notification state
  const [setupCompletionNotification, setSetupCompletionNotification] = useState(false);
  const [justCompletedSetup, setJustCompletedSetup] = useState(false);

  // API Key state
  const [apiKeySet, setApiKeySet] = useState(null); // null = checking, true = set, false = not set
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Initialize behavior tracking
  const behaviorTracking = useBehaviorTracking(user);

  // Check if this is first time setup
  const checkFirstTimeSetup = async () => {
    setCheckingFirstTime(true);
    try {
      if (!window.api || !window.api.isFirstTimeSetup) {
        console.error('First time setup check not available');
        setIsFirstTime(false);
        return;
      }
      
      const result = await window.api.isFirstTimeSetup();
      setIsFirstTime(result.isFirstTime);
      if (result.isFirstTime) {
        setIsInSetupProcess(true); // Mark that we're starting the setup process
        setDisableAutoSyncThisSession(true); // Disable auto-sync for this entire session
      }
    } catch (error) {
      console.error('Error checking first time setup:', error);
      setIsFirstTime(false);
    } finally {
      setCheckingFirstTime(false);
    }
  };

  // Run first time setup check on mount
  useEffect(() => {
    checkFirstTimeSetup();
  }, []);

  // Handle background sync completion notification
  const handleBackgroundSyncComplete = (result) => {
    const salesCount = result?.invoicesProcessed || result?.salesRecordsInserted || result?.invoices_processed || result?.synced || 0;
    if (result && !result.error) {
      setAutoSyncNotification('completed');
      setAutoSyncDetails(`Background sync completed! ${salesCount} sales records processed.`);
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setAutoSyncNotification(null);
        setAutoSyncDetails('');
      }, 5000);
    } else {
      setAutoSyncNotification('error');
      setAutoSyncDetails(`Background sync failed: ${result?.error || 'Unknown error'}`);
      
      // Auto-hide error after 8 seconds
      setTimeout(() => {
        setAutoSyncNotification(null);
        setAutoSyncDetails('');
      }, 8000);
    }
  };
  const handleSetupComplete = async () => {
    setIsFirstTime(false);
    setIsInSetupProcess(false); // Clear the setup process flag
    setJustCompletedSetup(true); // Mark that we just completed setup
    
    // Clear any auto-sync notifications to give setup completion notification priority
    setAutoSyncNotification(null);
    setAutoSyncDetails('');
    
    // First, ensure user is authenticated
    setIsAuthed(true);
    console.log('🎯 Set isAuthed to true');
    
    // Fetch current user and wait for it to complete
    try {
      await fetchCurrentUser();
      console.log('🎯 fetchCurrentUser completed');
      
      // Only after user is fetched, check API key
      // Since we just completed setup, the API key should be set, so this should pass
      setTimeout(() => {
        checkApiKey(true); // Force check even if isAuthed state hasn't updated
      }, 500);
      
    } catch (error) {
      console.error('Error fetching user after setup:', error);
      // Even if user fetch fails, try API key check
      setTimeout(() => {
        checkApiKey(true); // Force check
      }, 1000);
    }
    
    // Show setup completion notification
    setSetupCompletionNotification(true);
    
    // Auto-hide notification after 8 seconds
    setTimeout(() => {
      setSetupCompletionNotification(false);
    }, 8000);
    
    // Reset the "just completed setup" flag after a reasonable time so auto-sync works on next app launch
    // Extended to 5 minutes to ensure background setup sync has time to complete
    setTimeout(() => {
      setJustCompletedSetup(false);
    }, 300000); // Reset after 5 minutes
  };

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

  // Check API key when user is authenticated
  const checkApiKey = async (forceCheck = false) => {
    // Allow forced check after setup completion, even if isAuthed state hasn't updated yet
    if (!forceCheck && (!isAuthed || !window.api || !window.api.getApiKey)) {
      setApiKeySet(null);
      return;
    }
    
    if (!window.api || !window.api.getApiKey) {
      setApiKeySet(null);
      return;
    }
    
    try {
      const res = await window.api.getApiKey();
      const hasApiKey = !!(res && res.api_key);
      setApiKeySet(hasApiKey);
      
      // Show modal if no API key is set
      if (!hasApiKey) {
        setShowApiKeyModal(true);
      }
    } catch (error) {
      console.error('❌ Frontend: Error checking API key:', error);
      setApiKeySet(false);
      setShowApiKeyModal(true);
    }
  };

  useEffect(() => {
    if (isAuthed && !justCompletedSetup && !isFirstTime && !isInSetupProcess) {
      checkApiKey();
    }
  }, [isAuthed, justCompletedSetup, isFirstTime, isInSetupProcess]);

  // Handle API key modal actions
  const handleGoToAdmin = () => {
    setShowApiKeyModal(false);
    navigate('/admin');
  };

  const handleLogoutFromModal = () => {
    setShowApiKeyModal(false);
    handleLogout();
  };

  const handleSetApiKeyFromModal = async (newKey) => {
    try {
      if (!window.api || !window.api.setApiKey) throw new Error("API key set not available");
      
      let keyToSend = newKey.trim();
      // Remove any existing "BASIC " prefix - the backend will handle proper auth header formatting
      if (keyToSend.toUpperCase().startsWith("BASIC ")) {
        keyToSend = keyToSend.substring(6).trim();
      }
      
      await window.api.setApiKey(keyToSend);
      setApiKeySet(true);
      setShowApiKeyModal(false);
    } catch (error) {
      console.error('Error setting API key:', error);
      // Modal will remain open to show error
    }
  };

  const handleExitApp = async () => {
    try {
      if (window.api && window.api.exitApp) {
        await window.api.exitApp();
      } else {
        // Fallback for development
        window.close();
      }
    } catch (error) {
      console.error('Error exiting app:', error);
      window.close();
    }
  };

  // Auto-sync sales data when app starts (after authentication) - IMPROVED STARTUP
  useEffect(() => {
    // Don't auto-sync during first-time setup to avoid conflicts with manual setup sync
    // Also don't auto-sync immediately after setup completion since user just completed full sync
    // Also don't auto-sync at all if this is a first-time setup session
    if (isAuthed && !isFirstTime && !justCompletedSetup && !disableAutoSyncThisSession && window.api && window.api.updateSalesDataFromCliniko) {
      // Much longer delay to let UI fully stabilize, plus user feedback
      setAutoSyncNotification('syncing');
      setAutoSyncDetails('App loaded successfully. Background sync will start in 10 seconds...');
      
      const countdownTimer = setTimeout(() => {
        setAutoSyncDetails('App loaded successfully. Background sync will start in 5 seconds...');
        
        const finalTimer = setTimeout(() => {
          performGracefulAutoSync();
        }, 5000);
        
        return () => clearTimeout(finalTimer);
      }, 5000);
      
      return () => {
        clearTimeout(countdownTimer);
      };
    }
  }, [isAuthed, isFirstTime, justCompletedSetup, disableAutoSyncThisSession]);

  const performGracefulAutoSync = async () => {
    try {
      setAutoSyncDetails('Starting background sync...');
      
      // First check if sync is even needed
      setAutoSyncDetails('Checking if sync is needed...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small pause for UI
      
      // Update stock levels first (usually quick)
      setAutoSyncDetails('Updating stock levels from Cliniko...');
      const stockResult = await window.api.updateStockFromCliniko();
      
      if (stockResult.error) {
        setAutoSyncNotification('error');
        setAutoSyncDetails(`Stock update error: ${stockResult.error}`);
        setTimeout(() => {
          setAutoSyncNotification(null);
          setAutoSyncDetails('');
        }, 4000);
        return;
      }

      // Small pause before sales sync
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then do sales sync (potentially heavy)
      setAutoSyncDetails('Syncing sales data in background...');
      const salesResult = await window.api.updateSalesDataFromCliniko();
      
      if (salesResult.error) {
        setAutoSyncNotification('error');
        setAutoSyncDetails(`Sales sync error: ${salesResult.error}`);
      } else if (salesResult.skipped) {
        setAutoSyncNotification('completed');
        setAutoSyncDetails(`✅ Background sync completed!\nProducts: ${stockResult.total || 0} updated. Suppliers: ${stockResult.suppliers_updated || 0} updated. Sales data is up to date.`);
      } else {
        setAutoSyncNotification('completed');
        setAutoSyncDetails(`✅ Background sync completed!\nProducts: ${stockResult.total || 0} updated. Suppliers: ${stockResult.suppliers_updated || 0} updated. Sales: ${salesResult.invoicesProcessed || 0} invoices processed.`);
      }
      
      // Auto-hide after longer delay since sync completed
      setTimeout(() => {
        setAutoSyncNotification(null);
        setAutoSyncDetails('');
      }, 8000);
      
    } catch (error) {
      console.error('Auto-sync error:', error);
      setAutoSyncNotification('error');
      setAutoSyncDetails(`Sync error: ${error.message}`);
      setTimeout(() => {
        setAutoSyncNotification(null);
        setAutoSyncDetails('');
      }, 6000);
    }
  };

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
        setAutoSyncDetails(`✅ Sync completed!\nProducts: ${stockResult.total || 0} updated. Suppliers: ${stockResult.suppliers_updated || 0} updated. Sales data is up to date - no new invoices to sync.`);
      } else {
        setAutoSyncNotification('completed');
        setAutoSyncDetails(`✅ Sync completed!\nProducts: ${stockResult.total || 0} updated. Suppliers: ${stockResult.suppliers_updated || 0} updated and processed ${salesResult.invoicesProcessed || 0} invoices with ${salesResult.salesRecordsInserted || 0} sales records.`);
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
    if (!isAuthed && !loadingUser && !checkingFirstTime && !isFirstTime && window.location.hash !== '#/login') {
      navigate('/login');
    }
  }, [isAuthed, loadingUser, checkingFirstTime, isFirstTime, navigate]);

  // Show loading while checking first time setup or loading user
  if (checkingFirstTime || loadingUser) return <div>Loading...</div>;

  // Show first time setup if this is the first run
  if (isFirstTime) {
    return <FirstTimeSetup onSetupComplete={handleSetupComplete} onBackgroundSyncComplete={handleBackgroundSyncComplete} />;
  }

  return (
    <>
      {(isAuthed || loadingUser) && <TabsNav isAuthed={isAuthed} user={user} onLogout={handleLogout} />}
      
      {/* Auto-sync notification popup */}
      {autoSyncNotification && (
        <div style={{
          position: 'fixed',
          top: '130px', // Below the navigation with extra clearance
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
                {autoSyncNotification === 'syncing' ? 'Syncing Data...' : 
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
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Setup completion notification popup */}
      {setupCompletionNotification && (
        <div style={{
          position: 'fixed',
          top: autoSyncNotification ? '280px' : '130px', // Position below auto-sync notification if both are showing
          right: '20px',
          zIndex: 9999,
          background: '#e8f5e8',
          color: '#2e7d32',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          border: '2px solid #4caf50',
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
              🎉
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: '600', 
                marginBottom: '6px',
                fontSize: '0.95em',
                lineHeight: '1.3'
              }}>
                Setup Complete!
              </div>
              <div style={{ 
                fontSize: '0.85em', 
                opacity: 0.85,
                lineHeight: '1.4',
                whiteSpace: 'pre-line'
              }}>
                Welcome to your Cliniko Inventory App! Your initial sync has completed successfully and you're ready to start managing your inventory.
              </div>
            </div>
            <button
              onClick={() => setSetupCompletionNotification(false)}
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
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      <ApiKeyModal 
        open={showApiKeyModal}
        isAdmin={user && user.is_admin}
        onGoToAdmin={handleGoToAdmin}
        onLogout={handleLogoutFromModal}
        onSetApiKey={handleSetApiKeyFromModal}
        onExitApp={handleExitApp}
      />

      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route
          path="/"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <PageWrapper user={user}>
                <App />
              </PageWrapper>
            </RequireAuth>
          }
        />
        <Route
          path="/create-pr"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <PageWrapper user={user}>
                <CreatePurchaseRequests />
              </PageWrapper>
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
              <PageWrapper user={user}>
                <MasterList />
              </PageWrapper>
            </RequireAuth>
          }
        />
        <Route
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
        />
        <Route
          path="/admin/email-supplier"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <AdminLayout user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/sales-insights"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <SalesInsights />
            </RequireAuth>
          }
        />
        <Route
          path="/knowledge-base"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <KnowledgeBase />
            </RequireAuth>
          }
        />
        <Route
          path="/receive-items"
          element={
            <RequireAuth isAuthed={isAuthed} loadingUser={loadingUser}>
              <ReceiveItemsPage />
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
      <SmartPromptsProvider>
        <MainApp />
      </SmartPromptsProvider>
    </HashRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MainWrapper />);
