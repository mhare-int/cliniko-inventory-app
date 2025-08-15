import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Custom hook for tracking user behavior
 * Automatically tracks page views, feature usage, and user interactions
 */
export const useBehaviorTracking = (user) => {
  const location = useLocation();
  const sessionIdRef = useRef(null);
  const pageStartTime = useRef(Date.now());
  const currentPage = useRef(location.pathname);
  const lastActivityTime = useRef(Date.now());
  const mouseTracker = useRef({ clicks: 0, moves: 0, scrolls: 0 });
  const keyboardTracker = useRef({ keystrokes: 0, shortcuts: 0 });
  const errorTracker = useRef([]);
  const performanceTracker = useRef({ pageLoads: [], apiCalls: [] });
  const idleTimer = useRef(null);
  const isIdle = useRef(false);

  // Generate a session ID if we don't have one
  useEffect(() => {
    if (user && !sessionIdRef.current) {
      sessionIdRef.current = `session_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Start session tracking
      if (window.api?.startUserSession) {
        window.api.startUserSession(user.id, sessionIdRef.current);
      }
      
      // Track device and browser capabilities
      logBehavior('session_start', 'system', location.pathname, 0, {
        deviceType: getDeviceType(),
        browserInfo: getBrowserInfo(),
        screenInfo: getScreenInfo(),
        networkInfo: getNetworkInfo(),
        accessibilityFeatures: getAccessibilityFeatures(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onlineStatus: navigator.onLine
      });
    }
  }, [user]);

  // Track mouse interactions
  useEffect(() => {
    if (!user) return;

    const handleMouseMove = (e) => {
      mouseTracker.current.moves++;
      updateLastActivity();
      
      // Sample mouse movement patterns (every 50th move to avoid spam)
      if (mouseTracker.current.moves % 50 === 0) {
        logBehavior('mouse_pattern', getFeatureFromPath(location.pathname), location.pathname, 0, {
          x: e.clientX,
          y: e.clientY,
          totalMoves: mouseTracker.current.moves,
          speed: calculateMouseSpeed(e)
        });
      }
    };

    const handleMouseClick = (e) => {
      mouseTracker.current.clicks++;
      updateLastActivity();
      
      logBehavior('mouse_click', getFeatureFromPath(location.pathname), location.pathname, 0, {
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        targetTag: e.target.tagName,
        targetClass: e.target.className,
        targetId: e.target.id,
        clickCount: mouseTracker.current.clicks
      });
    };

    const handleScroll = (e) => {
      mouseTracker.current.scrolls++;
      updateLastActivity();
      
      // Log scroll patterns every 10 scrolls
      if (mouseTracker.current.scrolls % 10 === 0) {
        logBehavior('scroll_pattern', getFeatureFromPath(location.pathname), location.pathname, 0, {
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          scrollPercentage: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100,
          totalScrolls: mouseTracker.current.scrolls
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleMouseClick);
    document.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleMouseClick);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [user, location.pathname]);

  // Track keyboard interactions
  useEffect(() => {
    if (!user) return;

    const handleKeyDown = (e) => {
      keyboardTracker.current.keystrokes++;
      updateLastActivity();
      
      // Track keyboard shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        keyboardTracker.current.shortcuts++;
        logBehavior('keyboard_shortcut', getFeatureFromPath(location.pathname), location.pathname, 0, {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          shortcutCount: keyboardTracker.current.shortcuts
        });
      }
      
      // Track form interactions
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        logBehavior('form_interaction', getFeatureFromPath(location.pathname), location.pathname, 0, {
          inputType: e.target.type,
          inputName: e.target.name,
          inputId: e.target.id,
          keystrokeCount: keyboardTracker.current.keystrokes,
          isRequired: e.target.required,
          hasValue: !!e.target.value
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [user, location.pathname]);

  // Track idle behavior
  useEffect(() => {
    if (!user) return;

    const resetIdleTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      
      if (isIdle.current) {
        isIdle.current = false;
        logBehavior('user_return', getFeatureFromPath(location.pathname), location.pathname, 0, {
          idleDuration: Date.now() - lastActivityTime.current,
          returnTime: new Date().toISOString()
        });
      }
      
      idleTimer.current = setTimeout(() => {
        isIdle.current = true;
        logBehavior('user_idle', getFeatureFromPath(location.pathname), location.pathname, 0, {
          idleStartTime: new Date().toISOString(),
          lastPage: location.pathname
        });
      }, 30000); // 30 seconds idle threshold
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetIdleTimer, true));
    resetIdleTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, resetIdleTimer, true));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
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
        userAgent: navigator.userAgent,
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

  // Track page views with enhanced context
  useEffect(() => {
    if (user && sessionIdRef.current) {
      const timeOnPreviousPage = Date.now() - pageStartTime.current;
      
      // Log previous page duration with enhanced metrics
      if (currentPage.current && currentPage.current !== location.pathname && timeOnPreviousPage > 1000) {
        logBehavior('page_view', getFeatureFromPath(currentPage.current), currentPage.current, timeOnPreviousPage, {
          pageMetrics: {
            mouseClicks: mouseTracker.current.clicks,
            mouseMoves: mouseTracker.current.moves,
            scrolls: mouseTracker.current.scrolls,
            keystrokes: keyboardTracker.current.keystrokes,
            shortcuts: keyboardTracker.current.shortcuts,
            errors: errorTracker.current.length
          },
          pageLoadTime: performanceTracker.current.pageLoads[performanceTracker.current.pageLoads.length - 1]?.loadTime,
          exitType: 'navigation'
        });
      }
      
      // Reset trackers for new page
      mouseTracker.current = { clicks: 0, moves: 0, scrolls: 0 };
      keyboardTracker.current = { keystrokes: 0, shortcuts: 0 };
      errorTracker.current = [];
      
      // Track page load performance
      const loadStartTime = Date.now();
      setTimeout(() => {
        const loadTime = Date.now() - loadStartTime;
        performanceTracker.current.pageLoads.push({
          page: location.pathname,
          loadTime,
          timestamp: new Date().toISOString()
        });
      }, 100);
      
      // Update tracking for new page
      pageStartTime.current = Date.now();
      currentPage.current = location.pathname;
      
      // Log new page view with context
      logBehavior('page_view', getFeatureFromPath(location.pathname), location.pathname, 0, {
        referrer: document.referrer,
        navigationTiming: getNavigationTiming(),
        memoryUsage: getMemoryUsage(),
        connectionType: getConnectionType(),
        batteryLevel: getBatteryLevel()
      });
    }
  }, [location.pathname, user]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    lastActivityTime.current = Date.now();
  }, []);

  // Helper function to calculate mouse speed
  const calculateMouseSpeed = useCallback((e) => {
    if (!window.lastMouseEvent) {
      window.lastMouseEvent = { x: e.clientX, y: e.clientY, time: Date.now() };
      return 0;
    }
    
    const dx = e.clientX - window.lastMouseEvent.x;
    const dy = e.clientY - window.lastMouseEvent.y;
    const dt = Date.now() - window.lastMouseEvent.time;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = distance / dt;
    
    window.lastMouseEvent = { x: e.clientX, y: e.clientY, time: Date.now() };
    return speed;
  }, []);

  // End session when component unmounts or user logs out
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && window.api?.endUserSession) {
        // Log final session metrics
        logBehavior('session_end', 'system', location.pathname, 0, {
          sessionMetrics: {
            totalMouseClicks: mouseTracker.current.clicks,
            totalMouseMoves: mouseTracker.current.moves,
            totalScrolls: mouseTracker.current.scrolls,
            totalKeystrokes: keyboardTracker.current.keystrokes,
            totalShortcuts: keyboardTracker.current.shortcuts,
            totalErrors: errorTracker.current.length,
            pageLoads: performanceTracker.current.pageLoads.length,
            apiCalls: performanceTracker.current.apiCalls.length
          }
        });
        
        window.api.endUserSession(sessionIdRef.current);
      }
    };
  }, []);

  // Enhanced log behavior function
  const logBehavior = useCallback((actionType, featureAccessed, pageUrl = location.pathname, durationMs = 0, metadata = {}) => {
    if (!user || !sessionIdRef.current || !window.api?.logUserBehavior) return;
    
    // Update last activity time
    lastActivityTime.current = Date.now();
    
    // Add comprehensive context to metadata
    const enrichedMetadata = {
      ...metadata,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      colorDepth: window.screen.colorDepth,
      orientation: window.screen.orientation?.type,
      timestamp: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onlineStatus: navigator.onLine,
      memoryUsage: getMemoryUsage(),
      connectionType: getConnectionType(),
      documentVisibility: document.visibilityState,
      pageTitle: document.title,
      url: window.location.href,
      sessionDuration: Date.now() - pageStartTime.current,
      isIdle: isIdle.current
    };

    window.api.logUserBehavior(
      user.id,
      sessionIdRef.current,
      actionType,
      featureAccessed,
      pageUrl,
      durationMs,
      enrichedMetadata
    ).catch(err => {
      console.warn('Failed to log user behavior:', err);
    });
  }, [user, location.pathname]);

  // Enhanced tracking functions
  const trackFeatureUse = useCallback((featureName, metadata = {}) => {
    const startTime = Date.now();
    logBehavior('feature_use', featureName, location.pathname, 0, {
      ...metadata,
      featureContext: {
        mouseClicks: mouseTracker.current.clicks,
        keystrokes: keyboardTracker.current.keystrokes,
        scrollPosition: window.scrollY,
        startTime
      }
    });
    
    // Return a function to log feature completion
    return (completionMetadata = {}) => {
      const duration = Date.now() - startTime;
      logBehavior('feature_complete', featureName, location.pathname, duration, {
        ...completionMetadata,
        featureDuration: duration
      });
    };
  }, [logBehavior, location.pathname]);

  const trackClick = useCallback((elementName, metadata = {}) => {
    logBehavior('click', getFeatureFromPath(location.pathname), location.pathname, 0, {
      ...metadata,
      elementName,
      clickContext: {
        totalClicks: mouseTracker.current.clicks,
        scrollPosition: window.scrollY,
        viewportPosition: getViewportPosition(metadata.element)
      }
    });
  }, [logBehavior, location.pathname]);

  const trackFormSubmit = useCallback((formName, formData = {}) => {
    const formMetrics = analyzeForm(formData);
    logBehavior('form_submit', getFeatureFromPath(location.pathname), location.pathname, 0, {
      formName,
      formMetrics,
      keystrokes: keyboardTracker.current.keystrokes,
      formFields: Object.keys(formData),
      formDataLength: JSON.stringify(formData).length
    });
  }, [logBehavior, location.pathname]);

  const trackSearch = useCallback((searchTerm, resultsCount = 0, metadata = {}) => {
    logBehavior('search', getFeatureFromPath(location.pathname), location.pathname, 0, {
      ...metadata,
      searchTerm: searchTerm?.length > 50 ? searchTerm.substring(0, 50) + '...' : searchTerm,
      searchLength: searchTerm?.length || 0,
      resultsCount,
      searchContext: {
        keystrokes: keyboardTracker.current.keystrokes,
        hasSpecialChars: /[^a-zA-Z0-9\s]/.test(searchTerm),
        wordCount: searchTerm?.split(' ').length || 0
      }
    });
  }, [logBehavior, location.pathname]);

  const trackTaskDuration = useCallback((taskName, startTime, metadata = {}) => {
    const duration = Date.now() - startTime;
    logBehavior('task_complete', getFeatureFromPath(location.pathname), location.pathname, duration, {
      ...metadata,
      taskName,
      taskMetrics: {
        duration,
        mouseClicks: mouseTracker.current.clicks,
        keystrokes: keyboardTracker.current.keystrokes,
        scrolls: mouseTracker.current.scrolls,
        errors: errorTracker.current.length
      }
    });
  }, [logBehavior, location.pathname]);

  const trackError = useCallback((errorType, errorMessage, metadata = {}) => {
    logBehavior('user_error', getFeatureFromPath(location.pathname), location.pathname, 0, {
      ...metadata,
      errorType,
      errorMessage,
      errorContext: {
        mouseClicks: mouseTracker.current.clicks,
        keystrokes: keyboardTracker.current.keystrokes,
        scrollPosition: window.scrollY,
        timestamp: new Date().toISOString()
      }
    });
  }, [logBehavior, location.pathname]);

  // Set user preferences with enhanced tracking
  const setPreference = useCallback(async (key, value) => {
    if (!user || !window.api?.setUserPreference) return;
    
    try {
      await window.api.setUserPreference(user.id, key, value);
      logBehavior('customization', 'user_preferences', location.pathname, 0, {
        preferenceKey: key,
        preferenceValue: typeof value === 'string' ? value : JSON.stringify(value),
        customizationContext: {
          mouseClicks: mouseTracker.current.clicks,
          keystrokes: keyboardTracker.current.keystrokes,
          sessionDuration: Date.now() - pageStartTime.current
        }
      });
    } catch (err) {
      console.warn('Failed to set user preference:', err);
    }
  }, [user, logBehavior, location.pathname]);

  const getPreferences = useCallback(async () => {
    if (!user || !window.api?.getUserPreferences) return {};
    
    try {
      return await window.api.getUserPreferences(user.id);
    } catch (err) {
      console.warn('Failed to get user preferences:', err);
      return {};
    }
  }, [user]);

  return {
    trackFeatureUse,
    trackClick,
    trackFormSubmit,
    trackSearch,
    trackTaskDuration,
    trackError,
    setPreference,
    getPreferences,
    sessionId: sessionIdRef.current
  };
};

/**
 * Extract feature name from URL path
 */
function getFeatureFromPath(pathname) {
  const pathMap = {
    '/': 'home',
    '/sales-insights': 'sales_insights',
    '/purchase-requests': 'purchase_requests',
    '/create-pr': 'create_purchase_requests',
    '/archived': 'archived_purchase_requests',
    '/receive-items': 'receive_items',
    '/generate-supplier-files': 'generate_supplier_files',
    '/master-list': 'master_list',
    '/admin': 'admin_panel',
    '/admin/users': 'user_management',
    '/admin/behavior-analytics': 'behavior_analytics',
    '/login': 'authentication'
  };
  
  return pathMap[pathname] || 'unknown_page';
}

/**
 * Get device type based on screen size and user agent
 */
function getDeviceType() {
  const width = window.screen.width;
  const userAgent = navigator.userAgent;
  
  if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    return width < 768 ? 'mobile' : 'tablet';
  }
  return width < 1024 ? 'tablet' : 'desktop';
}

/**
 * Get browser information
 */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = 'Unknown';
  
  if (ua.includes('Chrome') && !ua.includes('Chromium')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    version = ua.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
    version = ua.match(/Edge\/([0-9.]+)/)?.[1] || 'Unknown';
  }
  
  return {
    name: browser,
    version,
    userAgent: ua,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    javaEnabled: navigator.javaEnabled?.() || false,
    onLine: navigator.onLine
  };
}

/**
 * Get screen information
 */
function getScreenInfo() {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    pixelRatio: window.devicePixelRatio,
    orientation: window.screen.orientation?.type || 'unknown'
  };
}

/**
 * Get network information
 */
function getNetworkInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return { type: 'unknown' };
  
  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
    type: connection.type
  };
}

/**
 * Get accessibility features in use
 */
function getAccessibilityFeatures() {
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    reducedTransparency: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
    forcedColors: window.matchMedia('(forced-colors: active)').matches
  };
}

/**
 * Get navigation timing information
 */
function getNavigationTiming() {
  if (!window.performance || !window.performance.timing) return null;
  
  const timing = window.performance.timing;
  return {
    domLoading: timing.domLoading - timing.navigationStart,
    domInteractive: timing.domInteractive - timing.navigationStart,
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    loadComplete: timing.loadEventEnd - timing.navigationStart,
    redirect: timing.redirectEnd - timing.redirectStart,
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    connect: timing.connectEnd - timing.connectStart,
    request: timing.responseStart - timing.requestStart,
    response: timing.responseEnd - timing.responseStart
  };
}

/**
 * Get memory usage information
 */
function getMemoryUsage() {
  if (!window.performance || !window.performance.memory) return null;
  
  return {
    usedJSHeapSize: window.performance.memory.usedJSHeapSize,
    totalJSHeapSize: window.performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
  };
}

/**
 * Get connection type
 */
function getConnectionType() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return connection?.effectiveType || 'unknown';
}

/**
 * Get battery level (if available)
 */
function getBatteryLevel() {
  // Note: Battery API is deprecated in most browsers, but we'll try
  if (!navigator.getBattery) return null;
  
  navigator.getBattery().then(battery => {
    return {
      level: battery.level,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime
    };
  }).catch(() => null);
  
  return null;
}

/**
 * Get element viewport position
 */
function getViewportPosition(element) {
  if (!element) return null;
  
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight
  };
}

/**
 * Analyze form data for insights
 */
function analyzeForm(formData) {
  const fields = Object.keys(formData);
  const values = Object.values(formData);
  
  return {
    fieldCount: fields.length,
    emptyFields: values.filter(v => !v || v === '').length,
    numericFields: values.filter(v => !isNaN(v) && v !== '').length,
    totalCharacters: values.join('').length,
    averageFieldLength: values.reduce((acc, v) => acc + (v?.toString().length || 0), 0) / fields.length,
    hasSpecialChars: values.some(v => /[^a-zA-Z0-9\s]/.test(v?.toString() || ''))
  };
}

export default useBehaviorTracking;
