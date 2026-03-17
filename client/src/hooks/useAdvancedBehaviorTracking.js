import { useEffect, useRef, useCallback } from 'react';

/**
 * Advanced behavior tracking hook for workflow patterns and user frustration
 */
export const useAdvancedBehaviorTracking = (user, behaviorTracking) => {
  const workflowTracker = useRef({
    currentWorkflow: null,
    workflowSteps: [],
    startTime: null,
    errors: [],
    retries: 0
  });
  
  const frustrationIndicators = useRef({
    rapidClicks: 0,
    backButtonUse: 0,
    refreshAttempts: 0,
    formResubmissions: 0,
    searchRefinements: 0,
    idleAfterError: 0
  });
  
  const performanceIssues = useRef({
    slowPageLoads: [],
    failedRequests: [],
    jsErrors: [],
    memoryWarnings: []
  });

  // Track workflow patterns
  const startWorkflow = useCallback((workflowName, initialData = {}) => {
    workflowTracker.current = {
      currentWorkflow: workflowName,
      workflowSteps: [{
        step: 'start',
        timestamp: new Date().toISOString(),
        data: initialData
      }],
      startTime: Date.now(),
      errors: [],
      retries: 0
    };
    
    if (behaviorTracking?.trackFeatureUse) {
      behaviorTracking.trackFeatureUse('workflow', {
        action: 'start_workflow',
        workflowName,
        initialData
      });
    }
  }, [behaviorTracking]);

  const addWorkflowStep = useCallback((stepName, stepData = {}) => {
    if (!workflowTracker.current.currentWorkflow) return;
    
    const step = {
      step: stepName,
      timestamp: new Date().toISOString(),
      data: stepData,
      timeSinceStart: Date.now() - workflowTracker.current.startTime
    };
    
    workflowTracker.current.workflowSteps.push(step);
    
    if (behaviorTracking?.trackFeatureUse) {
      behaviorTracking.trackFeatureUse('workflow', {
        action: 'workflow_step',
        workflowName: workflowTracker.current.currentWorkflow,
        stepName,
        stepData,
        timeSinceStart: step.timeSinceStart,
        totalSteps: workflowTracker.current.workflowSteps.length
      });
    }
  }, [behaviorTracking]);

  const completeWorkflow = useCallback((success = true, finalData = {}) => {
    if (!workflowTracker.current.currentWorkflow) return;
    
    const totalDuration = Date.now() - workflowTracker.current.startTime;
    const workflowData = {
      workflowName: workflowTracker.current.currentWorkflow,
      success,
      totalDuration,
      totalSteps: workflowTracker.current.workflowSteps.length,
      errors: workflowTracker.current.errors,
      retries: workflowTracker.current.retries,
      steps: workflowTracker.current.workflowSteps,
      finalData
    };
    
    if (behaviorTracking?.trackTaskDuration) {
      behaviorTracking.trackTaskDuration(
        workflowTracker.current.currentWorkflow,
        workflowTracker.current.startTime,
        workflowData
      );
    }
    
    // Reset workflow tracker
    workflowTracker.current = {
      currentWorkflow: null,
      workflowSteps: [],
      startTime: null,
      errors: [],
      retries: 0
    };
  }, [behaviorTracking]);

  const addWorkflowError = useCallback((errorType, errorMessage, errorData = {}) => {
    if (!workflowTracker.current.currentWorkflow) return;
    
    const error = {
      type: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      data: errorData,
      step: workflowTracker.current.workflowSteps[workflowTracker.current.workflowSteps.length - 1]?.step
    };
    
    workflowTracker.current.errors.push(error);
    
    if (behaviorTracking?.trackError) {
      behaviorTracking.trackError(errorType, errorMessage, {
        ...errorData,
        workflowName: workflowTracker.current.currentWorkflow,
        workflowStep: error.step,
        workflowErrors: workflowTracker.current.errors.length
      });
    }
  }, [behaviorTracking]);

  // Track frustration indicators
  useEffect(() => {
    if (!user) return;

    let rapidClickTimer = null;
    let clickCount = 0;

    const trackRapidClicks = (e) => {
      clickCount++;
      
      if (rapidClickTimer) clearTimeout(rapidClickTimer);
      
      rapidClickTimer = setTimeout(() => {
        if (clickCount >= 3) {
          frustrationIndicators.current.rapidClicks++;
          
          if (behaviorTracking?.trackFeatureUse) {
            behaviorTracking.trackFeatureUse('frustration', {
              indicator: 'rapid_clicks',
              clickCount,
              element: e.target.tagName,
              elementClass: e.target.className,
              totalRapidClicks: frustrationIndicators.current.rapidClicks
            });
          }
        }
        clickCount = 0;
      }, 2000);
    };

    const trackBackButton = () => {
      frustrationIndicators.current.backButtonUse++;
      
      if (behaviorTracking?.trackFeatureUse) {
        behaviorTracking.trackFeatureUse('frustration', {
          indicator: 'back_button_use',
          totalBackButtonUse: frustrationIndicators.current.backButtonUse,
          currentWorkflow: workflowTracker.current.currentWorkflow
        });
      }
    };

    const trackPageRefresh = () => {
      frustrationIndicators.current.refreshAttempts++;
      
      if (behaviorTracking?.trackFeatureUse) {
        behaviorTracking.trackFeatureUse('frustration', {
          indicator: 'page_refresh',
          totalRefreshAttempts: frustrationIndicators.current.refreshAttempts
        });
      }
    };

    document.addEventListener('click', trackRapidClicks);
    window.addEventListener('popstate', trackBackButton);
    window.addEventListener('beforeunload', trackPageRefresh);

    return () => {
      document.removeEventListener('click', trackRapidClicks);
      window.removeEventListener('popstate', trackBackButton);
      window.removeEventListener('beforeunload', trackPageRefresh);
      if (rapidClickTimer) clearTimeout(rapidClickTimer);
    };
  }, [user, behaviorTracking]);

  // Track performance issues
  useEffect(() => {
    if (!user) return;

    const trackSlowPageLoad = () => {
      if (window.performance && window.performance.timing) {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        
        if (loadTime > 3000) { // Consider > 3s as slow
          performanceIssues.current.slowPageLoads.push({
            loadTime,
            url: window.location.pathname,
            timestamp: new Date().toISOString()
          });
          
          if (behaviorTracking?.trackFeatureUse) {
            behaviorTracking.trackFeatureUse('performance', {
              issue: 'slow_page_load',
              loadTime,
              threshold: 3000,
              totalSlowLoads: performanceIssues.current.slowPageLoads.length
            });
          }
        }
      }
    };

    const trackFailedRequests = (error) => {
      if (error.target && error.target.tagName === 'IMG') return; // Skip image errors
      
      performanceIssues.current.failedRequests.push({
        message: error.message,
        filename: error.filename,
        timestamp: new Date().toISOString()
      });
      
      if (behaviorTracking?.trackError) {
        behaviorTracking.trackError('network_error', error.message, {
          totalFailedRequests: performanceIssues.current.failedRequests.length
        });
      }
    };

    const trackMemoryWarnings = () => {
      if (window.performance && window.performance.memory) {
        const memoryUsage = window.performance.memory.usedJSHeapSize / window.performance.memory.jsHeapSizeLimit;
        
        if (memoryUsage > 0.8) { // Warn when > 80% memory usage
          performanceIssues.current.memoryWarnings.push({
            memoryUsage,
            timestamp: new Date().toISOString()
          });
          
          if (behaviorTracking?.trackFeatureUse) {
            behaviorTracking.trackFeatureUse('performance', {
              issue: 'high_memory_usage',
              memoryUsage,
              threshold: 0.8,
              totalMemoryWarnings: performanceIssues.current.memoryWarnings.length
            });
          }
        }
      }
    };

    window.addEventListener('load', trackSlowPageLoad);
    window.addEventListener('error', trackFailedRequests);
    
    // Check memory usage every 30 seconds
    const memoryInterval = setInterval(trackMemoryWarnings, 30000);

    return () => {
      window.removeEventListener('load', trackSlowPageLoad);
      window.removeEventListener('error', trackFailedRequests);
      clearInterval(memoryInterval);
    };
  }, [user, behaviorTracking]);

  // Track search refinement patterns
  const trackSearchRefinement = useCallback((originalTerm, newTerm, resultsCount) => {
    frustrationIndicators.current.searchRefinements++;
    
    if (behaviorTracking?.trackSearch) {
      behaviorTracking.trackSearch(newTerm, resultsCount, {
        refinement: true,
        originalTerm,
        refinementNumber: frustrationIndicators.current.searchRefinements,
        similarity: calculateStringSimilarity(originalTerm, newTerm)
      });
    }
  }, [behaviorTracking]);

  // Track form resubmission patterns
  const trackFormResubmission = useCallback((formName, errorMessage = '') => {
    frustrationIndicators.current.formResubmissions++;
    
    if (behaviorTracking?.trackFormSubmit) {
      behaviorTracking.trackFormSubmit(formName, {
        isResubmission: true,
        resubmissionNumber: frustrationIndicators.current.formResubmissions,
        errorMessage
      });
    }
  }, [behaviorTracking]);

  // Track accessibility usage patterns
  const trackAccessibilityFeature = useCallback((featureName, featureData = {}) => {
    if (behaviorTracking?.trackFeatureUse) {
      behaviorTracking.trackFeatureUse('accessibility', {
        feature: featureName,
        ...featureData
      });
    }
  }, [behaviorTracking]);

  // Track multi-tab behavior
  useEffect(() => {
    if (!user) return;

    const trackVisibilityChange = () => {
      if (behaviorTracking?.trackFeatureUse) {
        behaviorTracking.trackFeatureUse('tab_behavior', {
          visible: !document.hidden,
          timestamp: new Date().toISOString(),
          currentWorkflow: workflowTracker.current.currentWorkflow
        });
      }
    };

    document.addEventListener('visibilitychange', trackVisibilityChange);
    return () => document.removeEventListener('visibilitychange', trackVisibilityChange);
  }, [user, behaviorTracking]);

  return {
    // Workflow tracking
    startWorkflow,
    addWorkflowStep,
    completeWorkflow,
    addWorkflowError,
    
    // Frustration tracking
    trackSearchRefinement,
    trackFormResubmission,
    
    // Accessibility tracking
    trackAccessibilityFeature,
    
    // Get current state
    getCurrentWorkflow: () => workflowTracker.current.currentWorkflow,
    getFrustrationIndicators: () => ({ ...frustrationIndicators.current }),
    getPerformanceIssues: () => ({ ...performanceIssues.current })
  };
};

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

export default useAdvancedBehaviorTracking;
