import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook for tracking user behavior (simplified and optimized)
 * Tracks only meaningful business actions, not technical noise
 */
export const useBehaviorTracking = (user) => {
  const location = useLocation();
  
  // Session tracking refs (simplified)
  const sessionIdRef = useRef(null);
  const sessionStartTime = useRef(Date.now());
  const pageStartTime = useRef(Date.now());
  const currentPage = useRef(location.pathname);
  const lastActivity = useRef(Date.now());
  const lastActivityTime = useRef(Date.now());
  const isIdle = useRef(false);
  const errorTracker = useRef([]);
  
  // Constants
  const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  // Generate a session ID if we don't have one
  useEffect(() => {
    if (user && !sessionIdRef.current) {
      sessionIdRef.current = `session_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Start session tracking
      if (window.api?.startUserSession) {
        window.api.startUserSession(user.id, sessionIdRef.current);
      }
      
      // Track session start
      logBehavior('session_start', 'system', location.pathname, 0, {
        deviceType: getDeviceType(),
        timestamp: new Date().toISOString()
      });
    }
  }, [user]);

  // Track only meaningful mouse interactions (remove excessive tracking)
  useEffect(() => {
    if (!user) return;

    // Only track meaningful clicks (buttons, links, important UI elements)
    const handleClick = (e) => {
      const element = e.target;
      const isActionableElement = element.tagName === 'BUTTON' || 
                                 element.tagName === 'A' || 
                                 element.type === 'submit' ||
                                 element.role === 'button' ||
                                 element.classList.contains('btn') ||
                                 element.classList.contains('clickable');
      
      if (isActionableElement) {
        updateLastActivity();
        logBehavior('meaningful_click', getFeatureFromPath(location.pathname), location.pathname, 0, {
          elementType: element.tagName,
          elementText: element.textContent?.substring(0, 50) || '',
          elementId: element.id || '',
          elementClass: element.className || ''
        });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [user, location.pathname]);

  // Track only important keyboard shortcuts (remove excessive keystroke tracking)
  useEffect(() => {
    if (!user) return;

    const handleKeyDown = (e) => {
      updateLastActivity();
      
      // Only track meaningful keyboard shortcuts and actions
      const isImportantShortcut = (e.ctrlKey || e.metaKey) && 
                                 ['s', 'z', 'y', 'c', 'v', 'x', 'f', 'p'].includes(e.key.toLowerCase());
      
      if (isImportantShortcut || e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        logBehavior('keyboard_action', getFeatureFromPath(location.pathname), location.pathname, 0, {
          key: e.key,
          shortcut: `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`,
          isShortcut: isImportantShortcut
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [user, location.pathname]);

  // Simplified idle/activity tracking (reduce frequency)
  useEffect(() => {
    if (!user) return;

    const checkIdleStatus = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity.current;
      const wasIdle = isIdle.current;
      isIdle.current = timeSinceLastActivity > IDLE_THRESHOLD;

      // Only log when idle state actually changes (not every 30 seconds)
      if (wasIdle !== isIdle.current) {
        logBehavior(isIdle.current ? 'user_idle' : 'user_active', getFeatureFromPath(location.pathname), location.pathname, 0, {
          sessionDuration: now - sessionStartTime.current,
          idleDuration: isIdle.current ? timeSinceLastActivity : 0
        });
      }
    };

    const idleInterval = setInterval(checkIdleStatus, 60000); // Check every minute instead of 30 seconds
    return () => clearInterval(idleInterval);
  }, [user, location.pathname]);

  // Track errors and exceptions
  useEffect(() => {
    if (!user) return;

    const handleError = (e) => {
      const errorInfo = {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        timestamp: new Date().toISOString(),
        url: location.pathname
      };
      
      errorTracker.current.push(errorInfo);
      
      logBehavior('javascript_error', getFeatureFromPath(location.pathname), location.pathname, 0, {
        errorInfo,
        totalErrors: errorTracker.current.length
      });
    };

    const handleUnhandledRejection = (e) => {
      const errorInfo = {
        reason: e.reason?.toString(),
        timestamp: new Date().toISOString(),
        url: location.pathname
      };
      
      errorTracker.current.push(errorInfo);
      
      logBehavior('promise_rejection', getFeatureFromPath(location.pathname), location.pathname, 0, {
        errorInfo,
        totalErrors: errorTracker.current.length
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user, location.pathname]);

  // Track page views (simplified)
  useEffect(() => {
    if (user && sessionIdRef.current) {
      const timeOnPreviousPage = Date.now() - pageStartTime.current;
      
      // Log previous page duration
      if (currentPage.current && currentPage.current !== location.pathname && timeOnPreviousPage > 1000) {
        logBehavior('page_duration', getFeatureFromPath(currentPage.current), currentPage.current, timeOnPreviousPage, {
          exitType: 'navigation'
        });
      }
      
      // Reset tracking for new page
      errorTracker.current = [];
      
      // Log page load performance (simplified)
      setTimeout(() => {
        const loadTime = Date.now() - pageStartTime.current;
        logBehavior('page_load', getFeatureFromPath(location.pathname), location.pathname, loadTime, {
          loadTime
        });
      }, 100);
      
      // Update tracking for new page
      pageStartTime.current = Date.now();
      currentPage.current = location.pathname;
      
      // Log new page view (simplified)
      logBehavior('page_view', getFeatureFromPath(location.pathname), location.pathname, 0, {
        referrer: document.referrer
      });
    }
  }, [location.pathname, user]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    lastActivity.current = Date.now();
    lastActivityTime.current = Date.now();
  }, []);

  // End session when component unmounts or user logs out
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && window.api?.endUserSession) {
        // Log final session metrics (simplified)
        logBehavior('session_end', 'system', location.pathname, 0, {
          sessionDuration: Date.now() - sessionStartTime.current
        });
        
        window.api.endUserSession(sessionIdRef.current);
      }
    };
  }, []);

  // Simplified log behavior function (focus on business value)
  const logBehavior = useCallback((actionType, featureAccessed, pageUrl = location.pathname, durationMs = 0, metadata = {}) => {
    if (!user || !sessionIdRef.current || !window.api?.logUserBehavior) return;
    
    // Update last activity time
    lastActivityTime.current = Date.now();
    
    // Minimal but useful metadata
    const simplifiedMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      sessionDuration: Date.now() - sessionStartTime.current,
      isOnline: navigator.onLine,
      pageTitle: document.title,
      userAgent: navigator.userAgent.substring(0, 100) // Truncated for brevity
    };

    window.api.logUserBehavior(
      user.id,
      sessionIdRef.current,
      actionType,
      featureAccessed,
      pageUrl,
      durationMs,
      simplifiedMetadata
    ).catch(err => {
      console.warn('Failed to log user behavior:', err);
    });
  }, [user, location.pathname]);

  // Enhanced tracking functions
  const trackFeatureUse = useCallback((featureName, metadata = {}) => {
    logBehavior('feature_use', featureName, location.pathname, 0, {
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }, [logBehavior, location.pathname]);

  const trackFormSubmission = useCallback((formName, formData = {}) => {
    logBehavior('form_submission', formName, location.pathname, 0, {
      formName,
      fieldCount: Object.keys(formData).length,
      timestamp: new Date().toISOString()
    });
  }, [logBehavior, location.pathname]);

  const trackSearchQuery = useCallback((query, resultsCount = 0) => {
    logBehavior('search_query', 'search', location.pathname, 0, {
      queryLength: query.length,
      resultsCount,
      timestamp: new Date().toISOString()
    });
  }, [logBehavior, location.pathname]);

  const trackError = useCallback((errorType, errorMessage) => {
    logBehavior('user_error', errorType, location.pathname, 0, {
      errorMessage: errorMessage.substring(0, 200),
      timestamp: new Date().toISOString()
    });
  }, [logBehavior, location.pathname]);

  const trackTiming = useCallback((actionName, durationMs, metadata = {}) => {
    logBehavior('performance_timing', actionName, location.pathname, durationMs, {
      ...metadata,
      durationMs,
      timestamp: new Date().toISOString()
    });
  }, [logBehavior, location.pathname]);

  return {
    trackFeatureUse,
    trackFormSubmission,
    trackSearchQuery,
    trackError,
    trackTiming,
    sessionId: sessionIdRef.current
  };
};

/**
 * Get device type based on screen size
 */
function getDeviceType() {
  const width = window.screen.width;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Get feature name from pathname (simplified mapping)
 */
function getFeatureFromPath(pathname) {
  const pathMap = {
    '/': 'home',
    '/purchase-requests': 'purchase_requests',
    '/suppliers': 'suppliers',
    '/generate-supplier-files': 'generate_supplier_files',
    '/master-list': 'master_list',
    '/admin': 'admin_panel',
    '/admin/users': 'user_management',
    '/admin/behavior-analytics': 'behavior_analytics',
    '/login': 'authentication'
  };
  
  return pathMap[pathname] || 'unknown_page';
}

export default useBehaviorTracking;
