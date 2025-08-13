import { useState, useEffect, useCallback } from 'react';

/**
 * Smart prompting system that provides contextual tips and suggestions
 * based on user behavior patterns and current context
 */
export const useSmartPrompts = (user, currentPath) => {
  const [activePrompt, setActivePrompt] = useState(null);
  const [promptHistory, setPromptHistory] = useState(new Set());
  const [userAnalytics, setUserAnalytics] = useState(null);

  // Fetch user behavior analytics
  const fetchUserAnalytics = useCallback(async () => {
    if (!user || !window.api?.getUserBehaviorAnalytics) return;
    
    try {
      const analytics = await window.api.getUserBehaviorAnalytics(user.id, 30);
      setUserAnalytics(analytics);
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchUserAnalytics();
  }, [fetchUserAnalytics]);

  // Generate smart prompts based on behavior patterns
  const generateSmartPrompt = useCallback(() => {
    if (!userAnalytics || !user) return null;

    const { sessionStats, featureUsage, topPages } = userAnalytics;
    
    // Analyze user proficiency and patterns
    const totalSessions = sessionStats?.total_sessions || 0;
    const avgActionsPerSession = sessionStats?.avg_actions_per_session || 0;
    const featureCount = featureUsage?.length || 0;
    
    // User proficiency levels
    const isNewUser = totalSessions < 3;
    const isIntermediateUser = totalSessions >= 3 && totalSessions < 10;
    const isExperiencedUser = totalSessions >= 10;
    
    // Feature usage patterns
    const hasUsedPurchaseRequests = featureUsage?.some(f => f.feature_accessed === 'purchase_requests') || false;
    const hasUsedSalesInsights = featureUsage?.some(f => f.feature_accessed === 'sales_insights') || false;
    const hasUsedMasterList = featureUsage?.some(f => f.feature_accessed === 'master_list') || false;
    const hasUsedReceiveItems = featureUsage?.some(f => f.feature_accessed === 'receive_items') || false;
    
    // Navigation patterns
    const frequentPage = topPages?.[0]?.page_url || '/';
    const visitedPages = topPages?.map(p => p.page_url) || [];
    
    const prompts = [];

    // NEW USER ONBOARDING PROMPTS
    if (isNewUser) {
      if (currentPath === '/' && !hasUsedMasterList) {
        prompts.push({
          id: 'onboarding_knowledge_base',
          type: 'tip',
          title: '📚 New Here? Check the Guide',
          message: 'Welcome! Visit our Knowledge Base to learn how each feature works and see example workflows.',
          action: 'View Knowledge Base',
          actionPath: '/knowledge-base',
          priority: 11
        });
        
        prompts.push({
          id: 'onboarding_master_list',
          type: 'tip',
          title: '🎯 Start Here: Master Stock List',
          message: 'Check out the Master Stock List to see all your products and their current stock levels.',
          action: 'View Master List',
          actionPath: '/master-list',
          priority: 10
        });
      }
      
      if (currentPath === '/master-list' && !hasUsedPurchaseRequests) {
        prompts.push({
          id: 'onboarding_purchase_requests',
          type: 'tip',
          title: '📝 Next Step: Create Purchase Requests',
          message: 'Great! Now you can create purchase requests for items that are running low.',
          action: 'Create Purchase Request',
          actionPath: '/create-pr',
          priority: 9
        });
      }
    }

    // INTERMEDIATE USER EFFICIENCY PROMPTS
    if (isIntermediateUser) {
      if (hasUsedPurchaseRequests && !hasUsedReceiveItems) {
        prompts.push({
          id: 'discover_receive_items',
          type: 'feature_discovery',
          title: '📦 New Feature: Receive Items',
          message: 'Speed up your workflow! Use the Receive Items page to quickly check in stock deliveries.',
          action: 'Try Receive Items',
          actionPath: '/receive-items',
          priority: 7
        });
      }

      if (hasUsedMasterList && hasUsedPurchaseRequests && !hasUsedSalesInsights) {
        prompts.push({
          id: 'discover_sales_insights',
          type: 'feature_discovery',
          title: '📊 Discover: Sales Insights',
          message: 'Want to see your best-selling products? Check out Sales Insights for detailed analytics.',
          action: 'View Sales Insights',
          actionPath: '/sales-insights',
          priority: 6
        });
      }
    }

    // WORKFLOW OPTIMIZATION PROMPTS
    if (currentPath === '/master-list' && hasUsedPurchaseRequests) {
      prompts.push({
        id: 'workflow_bulk_selection',
        type: 'efficiency',
        title: '⚡ Pro Tip: Bulk Selection',
        message: 'You can select multiple items at once when creating purchase requests. Use Ctrl/Cmd + click!',
        priority: 5
      });
    }

    // CONTEXTUAL HELP PROMPTS
    if (currentPath === '/create-pr' && avgActionsPerSession < 3) {
      prompts.push({
        id: 'help_create_pr',
        type: 'help',
        title: '💡 Quick Guide',
        message: 'Select products from the list, set quantities, and click "Create Purchase Request" to get started.',
        priority: 8
      });
    }

    // PATTERN-BASED SUGGESTIONS
    if (visitedPages.includes('/master-list') && visitedPages.includes('/purchase-requests') && !visitedPages.includes('/generate-supplier-files')) {
      prompts.push({
        id: 'suggest_supplier_files',
        type: 'workflow',
        title: '🏢 Complete the Workflow',
        message: 'Send your purchase orders directly to suppliers with organized order files.',
        action: 'Send Orders',
        actionPath: '/generate-supplier-files',
        priority: 4
      });
    }

    // TIME-BASED PROMPTS
    const now = new Date();
    const isMonday = now.getDay() === 1;
    const isMorning = now.getHours() >= 8 && now.getHours() < 12;
    
    if (isMonday && isMorning && currentPath === '/' && isExperiencedUser) {
      prompts.push({
        id: 'weekly_review',
        type: 'suggestion',
        title: '📅 Monday Check-in',
        message: 'Start your week right! Review your sales insights and check for low stock items.',
        action: 'Weekly Review',
        actionPath: '/sales-insights',
        priority: 3
      });
    }

    // ENGAGEMENT PROMPTS
    if (featureCount >= 4 && !visitedPages.includes('/admin/behavior-analytics')) {
      prompts.push({
        id: 'view_analytics',
        type: 'engagement',
        title: '🎯 See Your Progress',
        message: 'You\'re becoming a power user! Check out your usage analytics in the Admin Panel.',
        action: 'View Analytics',
        actionPath: '/admin/behavior-analytics',
        priority: 2
      });
    }

    // HELP AND GUIDANCE PROMPTS
    if (avgActionsPerSession < 2 && totalSessions > 1) {
      prompts.push({
        id: 'need_help',
        type: 'help',
        title: '❓ Need Some Guidance?',
        message: 'Having trouble finding what you need? Our Knowledge Base has detailed guides for every feature.',
        action: 'Get Help',
        actionPath: '/knowledge-base',
        priority: 9
      });
    }

    // Return highest priority prompt that hasn't been shown recently
    return prompts
      .filter(prompt => !promptHistory.has(prompt.id))
      .sort((a, b) => b.priority - a.priority)[0] || null;

  }, [userAnalytics, currentPath, user, promptHistory]);

  // Check for new prompts when context changes
  useEffect(() => {
    const prompt = generateSmartPrompt();
    if (prompt && prompt.id !== activePrompt?.id) {
      setActivePrompt(prompt);
    }
  }, [generateSmartPrompt, activePrompt]);

  const dismissPrompt = useCallback((promptId) => {
    setActivePrompt(null);
    setPromptHistory(prev => new Set(prev).add(promptId));
    
    // Clear prompt history after 24 hours to allow prompts to resurface
    setTimeout(() => {
      setPromptHistory(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptId);
        return newSet;
      });
    }, 24 * 60 * 60 * 1000);
  }, []);

  const executePromptAction = useCallback((prompt) => {
    if (prompt.actionPath && window.location) {
      window.location.hash = `#${prompt.actionPath}`;
    }
    dismissPrompt(prompt.id);
  }, [dismissPrompt]);

  return {
    activePrompt,
    dismissPrompt,
    executePromptAction,
    refreshAnalytics: fetchUserAnalytics
  };
};
