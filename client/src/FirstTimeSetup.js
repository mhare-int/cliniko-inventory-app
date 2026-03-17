import React, { useState } from 'react';

function FirstTimeSetup({ onSetupComplete, onBackgroundSyncComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [productsCount, setProductsCount] = useState(0);
  const [suppliersCount, setSuppliersCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  
  // Default to 2 years ago
  const defaultStartDate = new Date();
  defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 2);
  const [syncStartDate, setSyncStartDate] = useState(defaultStartDate);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Setup completion notification
  const [setupCompletionNotification, setSetupCompletionNotification] = useState(null);

  // Step 1: Create Administrator Account
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!username || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    
    if (password.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (!window.api || !window.api.createFirstAdminUser) {
        setError('Setup not available: API missing');
        return;
      }
      
      const result = await window.api.createFirstAdminUser(username, password);
      console.log('Setup result:', result);
      
      if (result && result.message) {
        // Success! Now log the user in
        try {
          const loginResult = await window.api.login(username, password);
          if (loginResult && loginResult.token) {
            localStorage.setItem('token', loginResult.token);
            localStorage.setItem('loginTime', Date.now().toString());
            setCurrentStep(2); // Move to API key step
          } else {
            setError('Account created but login failed. Please try logging in manually.');
          }
        } catch (loginError) {
          console.error('Login after setup error:', loginError);
          setError('Account created successfully! Please login with your credentials.');
        }
      } else {
        setError('Setup failed: No confirmation received');
      }
    } catch (err) {
      console.error('Setup error:', err);
      let errMsg = '';
      if (err && typeof err === 'object') {
        if (err.error) errMsg = err.error;
        else if (err.message) errMsg = err.message;
        else errMsg = JSON.stringify(err);
      } else {
        errMsg = err?.toString() || 'Unknown error';
      }
      setError('Setup failed: ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Set up API Key
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!apiKey || apiKey.trim().length === 0) {
      setError('Please enter your Cliniko API key');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // First test if the API key is valid
      console.log('Testing API key...');
      const testResult = await window.api.testApiKey(apiKey.trim());
      
      if (!testResult || !testResult.valid) {
        const errorMsg = testResult?.error || 'Invalid API key - please check and try again';
        setError(errorMsg);
        return;
      }
      
      console.log('API key validated successfully, saving...');
      
      // API key is valid, now save it
      const result = await window.api.setApiKey(apiKey.trim());
      if (result && !result.error) {
        setCurrentStep(3); // Move to product sync step

        // Notify the main application that the API key has been set so it
        // doesn't show the API key modal prematurely. Attempt to verify
        // via backend and dispatch an event the main app listens for.
        try {
          if (window.api && window.api.getApiKey) {
            const getRes = await window.api.getApiKey();
            window.dispatchEvent(new CustomEvent('clinikoApiKeyUpdated', { detail: { hasApiKey: !!(getRes && getRes.api_key) } }));
          } else {
            window.dispatchEvent(new CustomEvent('clinikoApiKeyUpdated', { detail: { hasApiKey: true } }));
          }
        } catch (evtErr) {
          // Best-effort notify - main app will re-check if needed
          window.dispatchEvent(new CustomEvent('clinikoApiKeyUpdated', { detail: { hasApiKey: true } }));
        }
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (err) {
      console.error('API key setup error:', err);
      setError('Failed to set API key: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview how many records will be synced
  const handlePreviewSync = async () => {
    setIsPreviewLoading(true);
    setPreviewCount(null);
    setPreviewResult(null);
    
    try {
      console.log('🔍 Frontend preview called with:');
      console.log('  - syncStartDate:', syncStartDate);
      console.log('  - apiKey:', apiKey ? 'PROVIDED (length: ' + apiKey.length + ')' : 'NOT PROVIDED');
      
      // Pass the current API key from state instead of relying on database
      const result = await window.api.previewSalesDataCount(syncStartDate.toISOString(), null, apiKey);
      if (result && !result.error) {
        setPreviewCount(result.totalInvoices || 0);
        setPreviewResult(result);
      } else {
        setError('Failed to preview sync: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to preview sync: ' + (err.message || err));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Step 3: Sync Products
  const handleProductSync = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      console.log('Starting product sync...');
      
      // First sync products with timeout (using syncProductsFromCliniko for first-time setup)
      const productResult = await Promise.race([
        window.api.syncProductsFromCliniko(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Product sync timeout after 2 minutes')), 120000)
        )
      ]);
      
      console.log('Product sync result:', productResult);
      
      if (productResult && !productResult.error) {
        // Ensure product costs / unit_price are populated by running the product sync.
        // This makes the Setup workflow populate `unit_price` for products (costs) when available from Cliniko.
        try {
          console.log('Updating product prices/unit_price from Cliniko...');
          const priceRes = await window.api.syncProductsFromCliniko();
          console.log('Price update result:', priceRes);
        } catch (priceErr) {
          console.warn('Price update during setup failed (non-fatal):', priceErr);
        }
        // Get product count and supplier count
        const productCount = productResult.products_synced || productResult.inserted || productResult.total || 0;
        // During first-time setup, suppliers are auto-added, so check suppliers_added first
        const supplierCount = productResult.suppliers_added || productResult.suppliers_updated || 0;
        console.log(`Successfully synced ${productCount} products and ${supplierCount} suppliers`);
        
        // Verify products were actually saved
        let actualProductCount = 0;
        let verificationAttempts = 0;
        const maxAttempts = 3;
        
        while (verificationAttempts < maxAttempts && actualProductCount === 0) {
          try {
            if (verificationAttempts > 0) {
              console.log(`Verification attempt ${verificationAttempts + 1}/${maxAttempts} - waiting 1 second...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const allProducts = await window.api.getAllProductsWithWrapper();
            console.log('getAllProductsWithWrapper response:', typeof allProducts, allProducts);
            console.log('Products array check:', allProducts && allProducts.products ? `Array with ${allProducts.products.length} items` : 'No products array found');
            actualProductCount = allProducts && allProducts.products ? allProducts.products.length : 0;
            console.log(`Verification attempt ${verificationAttempts + 1}: ${actualProductCount} products found in database`);
            
            if (actualProductCount > 0) {
              break; // Success!
            }
            
            // Also try a direct count query as fallback
            try {
              const directCount = await window.api.getProductCount();
              console.log(`Direct product count query: ${directCount}`);
              if (directCount > 0) {
                console.log('Direct count shows products exist, using that value');
                actualProductCount = directCount;
                break;
              }
            } catch (directCountError) {
              console.warn('Direct count query failed:', directCountError);
            }
          } catch (verifyError) {
            console.warn(`Verification attempt ${verificationAttempts + 1} failed:`, verifyError);
          }
          
          verificationAttempts++;
        }
        
        if (verificationAttempts >= maxAttempts && actualProductCount === 0) {
          console.warn('Verification failed after multiple attempts, using reported count');
          // Use the reported count if verification repeatedly fails
          actualProductCount = productCount;
        }
        
        setProductsCount(actualProductCount);
        setSuppliersCount(supplierCount);
        
        if (actualProductCount === 0) {
          throw new Error('Product sync reported success but no products were found in database');
        }
        
        // Then start sales data sync in background
        console.log('Starting sales data sync in background...');
        
        // Start background sync without waiting for it
        window.api.updateSalesDataFromCliniko(syncStartDate.toISOString().split('T')[0])
          .then(salesResult => {
            console.log('Background sales sync completed:', salesResult);
            if (salesResult && !salesResult.error) {
              const salesSyncCount = salesResult.invoicesProcessed || salesResult.salesRecordsInserted || salesResult.invoices_processed || salesResult.synced || 0;
              console.log(`Background sync: Successfully synced ${salesSyncCount} sales records`);
              
              // Update sales count
              setSalesCount(salesSyncCount);
              
              // Notify main app of successful background sync completion
              if (onBackgroundSyncComplete) {
                onBackgroundSyncComplete(salesResult);
              }
            } else {
              console.warn('Background sales sync failed:', salesResult?.error);
              setSalesCount('error');
              
              // Notify main app of failed background sync
              if (onBackgroundSyncComplete) {
                onBackgroundSyncComplete(salesResult);
              }
            }
          })
          .catch(salesErr => {
            console.warn('Background sales sync failed:', salesErr);
            setSalesCount('error');
            
            // Notify main app of failed background sync
            if (onBackgroundSyncComplete) {
              onBackgroundSyncComplete({ error: salesErr.message || salesErr });
            }
          });
        
        // Set a placeholder for sales count since it's running in background
        setSalesCount('syncing...');
        
        // Setup complete! Allow user to proceed immediately
        console.log('Initial setup completed! Sales data sync continuing in background...');
        
        // Show completion notification
        setSetupCompletionNotification({
          type: 'success',
          title: '🎉 Setup Complete!',
          message: `Product sync finished successfully!\n${actualProductCount} products imported.\n${supplierCount} suppliers updated.\nSales data sync is continuing in the background.`
        });
        
        // Auto-hide notification and proceed to main app
        setTimeout(() => {
          setSetupCompletionNotification(null);
          if (onSetupComplete) onSetupComplete();
        }, 4000); // Show notification for 4 seconds
        
      } else {
        throw new Error(productResult?.error || 'Product sync failed with unknown error');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError('Setup failed: ' + (err.message || err));
      
      // Provide retry option
      setTimeout(() => {
        if (window.confirm('Product sync failed. Would you like to retry?')) {
          handleProductSync();
        }
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <img
          src={"goodlife.png"}
          alt="The Good Life Clinic"
          style={{
            width: 120,
            maxWidth: "60%",
            display: "block",
            margin: "0 auto 20px auto",
            borderRadius: "8px",
            background: "#fff",
          }}
        />
        <h1 style={{ color: '#333', marginBottom: 8, fontSize: 28 }}>Welcome!</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 16 }}>
          Step 1 of 3: Create your administrator account
        </p>
      </div>

      <form onSubmit={handleStep1Submit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
            Administrator Username
          </label>
          <input 
            type="text" 
            placeholder="Enter your username (min 3 characters)"
            value={username} 
            onChange={e => setUsername(e.target.value)}
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '2px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 16,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
            Password
          </label>
          <input 
            type="password" 
            placeholder="Enter a secure password (min 4 characters)"
            value={password} 
            onChange={e => setPassword(e.target.value)}
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '2px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 16,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>
        
        <div style={{ marginBottom: 25 }}>
          <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
            Confirm Password
          </label>
          <input 
            type="password" 
            placeholder="Confirm your password"
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '2px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 16,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>

        {error && (
          <div style={{ 
            color: '#e53e3e', 
            background: '#fed7d7', 
            border: '1px solid #feb2b2',
            padding: '12px', 
            borderRadius: 6,
            marginBottom: 20,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          style={{ 
            width: '100%', 
            padding: '14px 20px', 
            background: isSubmitting ? '#a0aec0' : '#667eea',
            color: '#fff', 
            border: 'none', 
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            outline: 'none'
          }}
          onMouseOver={(e) => {
            if (!isSubmitting) e.target.style.background = '#5a67d8';
          }}
          onMouseOut={(e) => {
            if (!isSubmitting) e.target.style.background = '#667eea';
          }}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Administrator Account'}
        </button>
      </form>

      <div style={{ 
        marginTop: 25, 
        padding: 15, 
        background: '#f7fafc', 
        borderRadius: 6,
        fontSize: 13,
        color: '#4a5568'
      }}>
        <strong>🔒 Security Note:</strong> You're creating the main administrator account. 
        This account will have full access to all features including user management and system settings.
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <img
          src={"goodlife.png"}
          alt="The Good Life Clinic"
          style={{
            width: 120,
            maxWidth: "60%",
            display: "block",
            margin: "0 auto 20px auto",
            borderRadius: "8px",
            background: "#fff",
          }}
        />
        <h1 style={{ color: '#333', marginBottom: 8, fontSize: 28 }}>API Configuration</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 16 }}>
          Step 2 of 3: Enter your Cliniko API key
        </p>
      </div>

      <form onSubmit={handleStep2Submit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
            Cliniko API Key
          </label>
          <input 
            type="text" 
            placeholder="Enter your Cliniko API key"
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)}
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '2px solid #e1e5e9',
              borderRadius: 8,
              fontSize: 16,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
          />
        </div>

        {error && (
          <div style={{ 
            color: '#e53e3e', 
            background: '#fed7d7', 
            border: '1px solid #feb2b2',
            padding: '12px', 
            borderRadius: 6,
            marginBottom: 20,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          style={{ 
            width: '100%', 
            padding: '14px 20px', 
            background: isSubmitting ? '#a0aec0' : '#667eea',
            color: '#fff', 
            border: 'none', 
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            outline: 'none'
          }}
          onMouseOver={(e) => {
            if (!isSubmitting) e.target.style.background = '#5a67d8';
          }}
          onMouseOut={(e) => {
            if (!isSubmitting) e.target.style.background = '#667eea';
          }}
        >
          {isSubmitting ? 'Saving API Key...' : 'Save API Key & Continue'}
        </button>
      </form>

      <div style={{ 
        marginTop: 25, 
        padding: 15, 
        background: '#e6fffa', 
        borderRadius: 6,
        fontSize: 13,
        color: '#234e52'
      }}>
        <strong>🔑 API Key Info:</strong> Your Cliniko API key is used to sync products and sales data. 
        You can find this in your Cliniko account under Settings → API Keys.
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <img
          src={"goodlife.png"}
          alt="The Good Life Clinic"
          style={{
            width: 120,
            maxWidth: "60%",
            display: "block",
            margin: "0 auto 20px auto",
            borderRadius: "8px",
            background: "#fff",
          }}
        />
        <h1 style={{ color: '#333', marginBottom: 8, fontSize: 28 }}>
          {productsCount > 0 ? 'Setup Complete!' : 'Sync Your Data'}
        </h1>
        <p style={{ color: '#666', margin: 0, fontSize: 16 }}>
          {productsCount > 0 
            ? 'Your inventory management system is ready to use!' 
            : 'Step 3 of 3: Import your products and sales data from Cliniko'
          }
        </p>
      </div>

      {productsCount > 0 ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            background: '#f0fff4', 
            border: '2px solid #68d391',
            borderRadius: 8,
            padding: 20,
            marginBottom: 20
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#2f855a', marginBottom: 10 }}>
              ✅ Synchronization Successful!
            </div>
            <div style={{ color: '#2f855a' }}>
              <div>📦 Products synced: <strong>{productsCount}</strong></div>
              <div>🏢 Suppliers updated: <strong>{suppliersCount}</strong></div>
              <div>💰 Sales records: {salesCount === 'syncing...' ? (
                <span><strong>syncing in background...</strong> ⏳</span>
              ) : (
                <span>synced: <strong>{salesCount}</strong></span>
              )}</div>
            </div>
          </div>
          <p style={{ color: '#666', marginBottom: 20 }}>
            {salesCount === 'syncing...' ? 
              'Products are ready to use! Sales data sync will continue in the background.' :
              'Setup complete! You\'ll be redirected to the main application in a moment...'
            }
          </p>
        </div>
      ) : (
        <div>
          {error && (
            <div style={{ 
              color: '#e53e3e', 
              background: '#fed7d7', 
              border: '1px solid #feb2b2',
              padding: '12px', 
              borderRadius: 6,
              marginBottom: 20,
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          {/* Date Range Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 5, color: '#555', fontWeight: 500 }}>
              Sync sales data from:
            </label>
            <input 
              type="date" 
              value={syncStartDate.toISOString().split('T')[0]}
              onChange={e => setSyncStartDate(new Date(e.target.value))}
              disabled={isLoading}
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                border: '2px solid #e1e5e9',
                borderRadius: 8,
                fontSize: 16,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
            <div style={{ fontSize: 13, color: '#666', marginTop: 5 }}>
              Default is 2 years ago. This determines how much sales history to import.
            </div>
          </div>

          {/* Preview Button */}
          <button 
            onClick={handlePreviewSync}
            disabled={isPreviewLoading || isLoading}
            style={{ 
              width: '100%', 
              padding: '12px 20px', 
              background: isPreviewLoading ? '#a0aec0' : '#4299e1',
              color: '#fff', 
              border: 'none', 
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: (isPreviewLoading || isLoading) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              outline: 'none',
              marginBottom: 15
            }}
            onMouseOver={(e) => {
              if (!isPreviewLoading && !isLoading) e.target.style.background = '#3182ce';
            }}
            onMouseOut={(e) => {
              if (!isPreviewLoading && !isLoading) e.target.style.background = '#4299e1';
            }}
          >
            {isPreviewLoading ? 'Checking records...' : 'Preview: How many records will be synced?'}
          </button>

          {/* Preview Results */}
          {previewCount !== null && previewResult && (
            <div style={{ 
              background: '#ebf8ff', 
              border: '1px solid #4299e1',
              borderRadius: 6,
              padding: 15,
              marginBottom: 20,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#2b6cb0', marginBottom: 5 }}>
                📊 Preview Results
              </div>
              <div style={{ color: '#2b6cb0', marginBottom: 8 }}>
                <strong>{previewResult.totalInvoices}</strong> invoices found
                {previewResult.estimatedSalesRecords && (
                  <span> (approximately <strong>{previewResult.estimatedSalesRecords}</strong> sales records — estimated <strong>{previewResult.estimatedTimeFormatted}</strong>)</span>
                )}
              </div>
              {previewResult.estimatedTimeFormatted && (
                <div style={{ color: '#2b6cb0', marginBottom: 8, fontSize: 14 }}>
                  ⏱️ Estimated sales sync time: <strong>{previewResult.estimatedTimeFormatted}</strong>
                </div>
              )}
              <div style={{ fontSize: 13, color: '#4a5568' }}>
                from {syncStartDate.toLocaleDateString()} to today
              </div>
              {previewResult.estimatedPages && (
                <div style={{ fontSize: 12, color: '#718096', marginTop: 5 }}>
                  ({previewResult.estimatedPages} API pages with rate limiting)
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleProductSync}
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '14px 20px', 
              background: isLoading ? '#a0aec0' : '#38a169',
              color: '#fff', 
              border: 'none', 
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              if (!isLoading) e.target.style.background = '#2f855a';
            }}
            onMouseOut={(e) => {
              if (!isLoading) e.target.style.background = '#38a169';
            }}
          >
            {isLoading ? 'Syncing Data...' : 'Sync Products & Sales Data'}
          </button>

          <div style={{ 
            marginTop: 25, 
            padding: 15, 
            background: '#fff5cd', 
            borderRadius: 6,
            fontSize: 13,
            color: '#744210'
          }}>
            <strong>📊 Data Sync:</strong> Products and suppliers are synced now so you can start using the app immediately. Sales records will continue to sync in the background while you use the app. Estimated sales sync time is approximate (we use ~3 seconds per sale record to estimate total time).
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: 500, 
        width: '100%',
        background: '#fff', 
        borderRadius: 12, 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        padding: 40
      }}>
        {/* Progress indicator */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            {[1, 2, 3].map(step => (
              <div 
                key={step}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: currentStep >= step ? '#667eea' : '#e2e8f0',
                  color: currentStep >= step ? '#fff' : '#a0aec0',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {step}
              </div>
            ))}
          </div>
          <div style={{ 
            height: 4,
            background: '#e2e8f0',
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: '#667eea',
              width: `${((currentStep - 1) / 2) * 100}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
}

export default FirstTimeSetup;
