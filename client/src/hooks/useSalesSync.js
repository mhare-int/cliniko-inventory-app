// Hook for managing sales sync using Web Workers
import { useState, useRef, useCallback } from 'react';

export const useSalesSync = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  const workerRef = useRef(null);
  
  const startSync = useCallback((config = {}) => {
    if (isRunning) {
      console.warn('Sales sync already running');
      return;
    }
    
    // Clean up any existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    try {
      // Create new worker
      workerRef.current = new Worker(
        new URL('../workers/salesSyncWorker.js', import.meta.url),
        { type: 'module' }
      );
      
      // Set up message handler
      workerRef.current.onmessage = async (e) => {
        const { type, ...data } = e.data;
        
        switch (type) {
          case 'PROGRESS':
            setProgress(data.progress || 0);
            setMessage(data.message || '');
            break;
            
          case 'REQUEST_API_CALL':
            // Handle API call requests from worker
            await handleWorkerApiRequest(data);
            break;
            
          case 'COMPLETE':
            setIsRunning(false);
            setProgress(100);
            setMessage(data.message || 'Sync complete');
            setResult({
              processed: data.processed || 0,
              errors: data.errors || 0
            });
            break;
            
          case 'ERROR':
            setIsRunning(false);
            setError(data.error || 'Unknown error');
            setMessage('Sync failed');
            break;
            
          case 'CANCELLED':
            setIsRunning(false);
            setMessage('Sync cancelled');
            break;
            
          case 'STOPPED':
            setIsRunning(false);
            setMessage('Sync stopped');
            break;
            
          default:
            console.warn('Unknown worker message type:', type);
        }
      };
      
      // Handle worker errors
      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        setIsRunning(false);
        setError('Worker error: ' + error.message);
        setMessage('Sync failed due to worker error');
      };
      
      // Start the sync
      setIsRunning(true);
      setProgress(0);
      setMessage('Initializing sync...');
      setError(null);
      setResult(null);
      
      workerRef.current.postMessage({
        type: 'START_SYNC',
        data: {
          batchSize: config.batchSize || 50,
          ...config
        }
      });
      
    } catch (err) {
      console.error('Failed to start sales sync worker:', err);
      setError('Failed to start sync: ' + err.message);
      setIsRunning(false);
    }
  }, [isRunning]);
  
  const handleWorkerApiRequest = async (requestData) => {
    const { method, params, callId } = requestData;
    
    try {
      if (!window.api || !window.api[method]) {
        throw new Error(`API method ${method} not available`);
      }
      
      // Call the API method
      const result = await window.api[method](...(params || []));
      
      // Send result back to worker
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'API_RESULT',
          data: {
            callId,
            result
          }
        });
      }
      
    } catch (error) {
      console.error(`API call ${method} failed:`, error);
      
      // Send error back to worker
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'API_RESULT',
          data: {
            callId,
            error: error.message || 'API call failed'
          }
        });
      }
    }
  };
  
  const stopSync = useCallback(() => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: 'STOP_SYNC' });
    }
  }, [isRunning]);
  
  const resetSync = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsRunning(false);
    setProgress(0);
    setMessage('');
    setError(null);
    setResult(null);
  }, []);
  
  // Clean up worker on unmount
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);
  
  return {
    isRunning,
    progress,
    message,
    error,
    result,
    startSync,
    stopSync,
    resetSync,
    cleanup
  };
};
