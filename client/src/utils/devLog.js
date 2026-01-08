/**
 * Development-only logging utility
 * Logs are only output when NODE_ENV is not 'production'
 * or when running in Electron dev mode
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const devLog = {
  /**
   * Log general information (replaces console.log)
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log warnings (always shown)
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log debug information (only in development)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log with prefix for better filtering
   */
  info: (...args) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  }
};

export default devLog;
