import React from 'react';
import SmartPrompt from './SmartPrompt';
import { useSmartPrompts } from './hooks/useSmartPrompts';
import { useLocation } from 'react-router-dom';
import { useSmartPromptsContext } from './contexts/SmartPromptsContext';

const PageWrapper = ({ children, user, className = '' }) => {
  const location = useLocation();
  const { activePrompt, dismissPrompt, executePromptAction } = useSmartPrompts(user, location.pathname);
  const { smartPromptsEnabled } = useSmartPromptsContext();

  return (
    <div className={`page-wrapper ${className}`}>
      {smartPromptsEnabled && activePrompt && (
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto 20px auto', 
          padding: '0 20px'
        }}>
          <SmartPrompt 
            prompt={activePrompt}
            onDismiss={dismissPrompt}
            onAction={executePromptAction}
          />
        </div>
      )}
      {children}
    </div>
  );
};

export default PageWrapper;
