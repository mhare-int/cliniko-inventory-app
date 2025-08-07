import React from 'react';
import './SmartPrompt.css';

const SmartPrompt = ({ prompt, onDismiss, onAction }) => {
  if (!prompt) return null;

  const getPromptStyle = (type) => {
    const styles = {
      tip: { borderColor: '#4CAF50', backgroundColor: '#E8F5E8' },
      feature_discovery: { borderColor: '#2196F3', backgroundColor: '#E3F2FD' },
      efficiency: { borderColor: '#FF9800', backgroundColor: '#FFF3E0' },
      help: { borderColor: '#9C27B0', backgroundColor: '#F3E5F5' },
      workflow: { borderColor: '#607D8B', backgroundColor: '#ECEFF1' },
      suggestion: { borderColor: '#795548', backgroundColor: '#EFEBE9' },
      engagement: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' }
    };
    return styles[type] || styles.tip;
  };

  const style = getPromptStyle(prompt.type);

  return (
    <div 
      className="smart-prompt"
      style={{
        borderLeftColor: style.borderColor,
        backgroundColor: style.backgroundColor
      }}
    >
      <div className="smart-prompt-content">
        <div className="smart-prompt-header">
          <h4 className="smart-prompt-title">{prompt.title}</h4>
          <button 
            className="smart-prompt-close"
            onClick={() => onDismiss(prompt.id)}
            title="Dismiss"
          >
            ×
          </button>
        </div>
        <p className="smart-prompt-message">{prompt.message}</p>
        {prompt.action && (
          <div className="smart-prompt-actions">
            <button 
              className="smart-prompt-action-btn"
              onClick={() => onAction(prompt)}
              style={{ backgroundColor: style.borderColor }}
            >
              {prompt.action}
            </button>
            <button 
              className="smart-prompt-dismiss-btn"
              onClick={() => onDismiss(prompt.id)}
            >
              Maybe Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartPrompt;
