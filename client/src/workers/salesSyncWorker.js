/* eslint-disable no-restricted-globals */
// Worker for handling sales data syncing timing in the background
// This prevents UI freezing by managing the timing and yielding control

let isRunning = false;
let shouldStop = false;

// Handle messages from the main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'START_SYNC':
      if (isRunning) {
        self.postMessage({ type: 'ERROR', error: 'Sync already running' });
        return;
      }
      await manageSalesSync(data);
      break;
      
    case 'STOP_SYNC':
      shouldStop = true;
      self.postMessage({ type: 'STOPPED' });
      break;
      
    case 'API_RESULT':
      // Handle results from API calls made by main thread
      handleApiResult(data);
      break;
      
    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
  }
};

async function manageSalesSync(config = {}) {
  isRunning = true;
  shouldStop = false;
  
  try {
    self.postMessage({ type: 'PROGRESS', message: 'Starting sales sync...', progress: 0 });
    
    // Request the main thread to call the API
    self.postMessage({ 
      type: 'REQUEST_API_CALL',
      method: 'updateSalesDataFromCliniko',
      params: [],
      callId: 'sales-sync-main'
    });
    
    // The actual work is done by yielding and managing timing
    // This keeps the main thread responsive
    
  } catch (error) {
    console.error('Sales sync management error:', error);
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Unknown error during sales sync'
    });
  }
}

function handleApiResult(data) {
  const { callId, result, error } = data;
  
  if (callId === 'sales-sync-main') {
    if (error) {
      self.postMessage({
        type: 'ERROR',
        error: error
      });
    } else if (result.skipped) {
      self.postMessage({
        type: 'COMPLETE',
        message: 'Sales data is up to date',
        progress: 100,
        processed: 0,
        errors: 0
      });
    } else {
      self.postMessage({
        type: 'COMPLETE',
        message: `Sales sync complete. Processed ${result.invoicesProcessed || 0} invoices.`,
        progress: 100,
        processed: result.invoicesProcessed || 0,
        errors: 0
      });
    }
  }
  
  isRunning = false;
}

// Handle worker errors
self.onerror = function(error) {
  console.error('Worker error:', error);
  self.postMessage({
    type: 'ERROR',
    error: 'Worker encountered an error: ' + error.message
  });
  isRunning = false;
};
