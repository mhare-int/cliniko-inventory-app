import React from 'react';

/**
 * Error Boundary component to catch React errors and prevent full app crashes
 * Displays a user-friendly error message with option to reload
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log to backend if logging API is available
    if (window.api && window.api.logError) {
      window.api.logError('React Error Boundary', {
        error: error.toString(),
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#f9fafb',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '40px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              ⚠️
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Something Went Wrong
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '24px',
              lineHeight: '1.5'
            }}>
              We encountered an unexpected error. Don't worry - your data is safe. 
              Try reloading the application to continue.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginBottom: '24px',
                textAlign: 'left',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '16px',
                fontSize: '14px',
                color: '#991b1b',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontSize: '12px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
              >
                Reload Application
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: 'white',
                  color: '#374151',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#f9fafb'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
