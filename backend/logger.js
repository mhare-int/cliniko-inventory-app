/**
 * Async Logger Utility
 * Replaces synchronous fs.appendFileSync calls to prevent UI blocking
 * Includes automatic sanitization of sensitive data
 */

const fs = require('fs');
const path = require('path');

// Sensitive field names to redact
const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'token', 'apiKey', 'api_key', 'apikey',
  'secret', 'jwt_secret', 'authorization', 'auth', 'github_token',
  'access_token', 'refresh_token', 'Bearer'
];

/**
 * Sanitize data for logging by redacting sensitive fields
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized copy of data
 */
function sanitize(data) {
  if (!data) return data;
  
  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }
  
  // Handle objects - deep clone and redact
  const sanitized = {};
  for (const key in data) {
    if (!data.hasOwnProperty(key)) continue;
    
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      // Redact but show type
      const value = data[key];
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof data[key] === 'object') {
      sanitized[key] = sanitize(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

// Buffer for batching log writes
let logBuffer = [];
let flushTimer = null;
let isWriting = false;

// Get the correct log path based on environment
function getLogPath() {
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) {
      return path.join(app.getPath('userData'), 'backend.log');
    }
  } catch (e) {
    // Not running in Electron
  }
  return path.join(__dirname, 'backend.log');
}

// Async flush function - writes buffered logs to disk
async function flushLogs() {
  if (isWriting || logBuffer.length === 0) return;
  
  isWriting = true;
  const toWrite = logBuffer.splice(0, logBuffer.length);
  const content = toWrite.join('');
  
  try {
    await fs.promises.appendFile(getLogPath(), content);
  } catch (e) {
    // If write fails, just log to console (don't block or throw)
    console.error('Logger: Failed to write to log file:', e.message);
  }
  
  isWriting = false;
  
  // If more logs accumulated while writing, schedule another flush
  if (logBuffer.length > 0) {
    scheduleFlush();
  }
}

// Schedule a flush (debounced to batch writes)
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, 100); // 100ms debounce
}

/**
 * Log a message asynchronously (non-blocking)
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log (will be sanitized)
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] ${message}`;
  
  if (data !== null && data !== undefined) {
    try {
      const sanitized = sanitize(data);
      line += ` ${JSON.stringify(sanitized)}`;
    } catch (e) {
      line += ` [Could not stringify data]`;
    }
  }
  
  line += '\n';
  logBuffer.push(line);
  scheduleFlush();
}

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Error|any} [err] - Optional error object
 */
function logError(message, err = null) {
  const errDetails = err ? ` - ${err.message || err}` : '';
  log(`ERROR: ${message}${errDetails}`);
}

/**
 * Log a debug message (only in development)
 * @param {string} message - Debug message
 */
function debug(message) {
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) return; // Skip in production
  } catch (e) {
    // Not in Electron, check NODE_ENV
    if (process.env.NODE_ENV === 'production') return;
  }
  log(`DEBUG: ${message}`);
}

/**
 * Flush all pending logs immediately (call before app exit)
 * @returns {Promise<void>}
 */
async function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushLogs();
}

module.exports = {
  log,
  logError,
  debug,
  flushNow,
  getLogPath,
  sanitize
};
