import React, { createContext, useContext, useState, useEffect } from 'react';

export const SmartPromptsContext = createContext();

export const useSmartPromptsContext = () => {
  const context = useContext(SmartPromptsContext);
  if (!context) {
    throw new Error('useSmartPromptsContext must be used within a SmartPromptsProvider');
  }
  return context;
};

export const SmartPromptsProvider = ({ children }) => {
  const [smartPromptsEnabled, setSmartPromptsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch initial setting
  useEffect(() => {
    const fetchSetting = async () => {
      if (window.api && window.api.getSmartPromptsSetting) {
        try {
          const res = await window.api.getSmartPromptsSetting();
          setSmartPromptsEnabled(res.enabled === true);
        } catch (error) {
          setSmartPromptsEnabled(false);
        }
      }
      setLoading(false);
    };
    
    fetchSetting();
  }, []);

  const updateSmartPromptsSetting = async (enabled) => {
    if (!window.api || !window.api.setSmartPromptsSetting) {
      throw new Error('setSmartPromptsSetting not available');
    }
    await window.api.setSmartPromptsSetting(enabled);
    // Always fetch the latest value from backend after setting (prevents UI reversion)
    if (window.api && window.api.getSmartPromptsSetting) {
      const res = await window.api.getSmartPromptsSetting();
      setSmartPromptsEnabled(res.enabled === true);
    } else {
      setSmartPromptsEnabled(enabled);
    }
  };

  const refreshSetting = async () => {
    if (window.api && window.api.getSmartPromptsSetting) {
      try {
        const res = await window.api.getSmartPromptsSetting();
        setSmartPromptsEnabled(res.enabled === true);
      } catch (error) {
        setSmartPromptsEnabled(false);
      }
    }
  };

  const value = {
    smartPromptsEnabled,
    loading,
    updateSmartPromptsSetting,
    refreshSetting
  };

  return (
    <SmartPromptsContext.Provider value={value}>
      {children}
    </SmartPromptsContext.Provider>
  );
};
