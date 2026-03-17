/**
 * Centralized error handling utility
 * Standardizes error responses across IPC handlers and backend operations
 */

/**
 * Standard error codes for the application
 */
const ErrorCode = {
  // Authentication & Authorization
  AUTH_FAILED: 'AUTH_FAILED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // External API
  API_ERROR: 'API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Application
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  OPERATION_FAILED: 'OPERATION_FAILED',
  TIMEOUT: 'TIMEOUT'
};

/**
 * Application error class with structured error information
 */
class AppError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
  
  /**
   * Convert error to JSON-serializable object for IPC responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Wrap IPC handler function with standardized error handling
 * @param {Function} handler - Async function that implements the handler logic
 * @param {Object} logger - Optional logger instance
 * @returns {Function} Wrapped handler with error handling
 */
function wrapHandler(handler, logger = console) {
  return async (event, ...args) => {
    try {
      const result = await handler(event, ...args);
      
      // If result is already a structured response, return it
      if (result && typeof result === 'object' && 'success' in result) {
        return result;
      }
      
      // Otherwise wrap in success response
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // Log error with context
      const errorContext = {
        handler: handler.name || 'anonymous',
        args: args.length > 0 ? `${args.length} args` : 'no args',
        error: error.message
      };
      
      if (logger.logError) {
        logger.logError('IPC handler error', errorContext, error);
      } else {
        logger.error('IPC handler error', errorContext, error);
      }
      
      // Return structured error response
      if (error instanceof AppError) {
        return error.toJSON();
      }
      
      // Handle known error types
      if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE constraint')) {
        return new AppError(
          ErrorCode.DUPLICATE_ENTRY,
          'The operation would create a duplicate entry',
          { originalError: error.message }
        ).toJSON();
      }
      
      if (error.code === 'SQLITE_BUSY') {
        return new AppError(
          ErrorCode.DATABASE_ERROR,
          'Database is temporarily busy, please retry',
          { originalError: error.message }
        ).toJSON();
      }
      
      if (error.message && error.message.includes('not found')) {
        return new AppError(
          ErrorCode.NOT_FOUND,
          error.message,
          { originalError: error.message }
        ).toJSON();
      }
      
      // Default to internal error
      return new AppError(
        ErrorCode.INTERNAL_ERROR,
        'An unexpected error occurred',
        { originalError: error.message }
      ).toJSON();
    }
  };
}

/**
 * Create a validation error with detailed field information
 * @param {string} message - Error message
 * @param {Object} fields - Object mapping field names to error messages
 * @returns {AppError}
 */
function validationError(message, fields = null) {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, fields);
}

/**
 * Create a not found error
 * @param {string} resource - Type of resource that was not found
 * @param {string|number} id - Identifier that was not found
 * @returns {AppError}
 */
function notFoundError(resource, id) {
  return new AppError(
    ErrorCode.NOT_FOUND,
    `${resource} with id '${id}' not found`,
    { resource, id }
  );
}

/**
 * Create a database error from SQLite error
 * @param {Error} sqliteError - Original SQLite error
 * @param {string} operation - Description of operation that failed
 * @returns {AppError}
 */
function databaseError(sqliteError, operation) {
  let code = ErrorCode.DATABASE_ERROR;
  let message = `Database operation failed: ${operation}`;
  
  // Map SQLite errors to specific codes
  if (sqliteError.code === 'SQLITE_CONSTRAINT') {
    code = ErrorCode.CONSTRAINT_VIOLATION;
    message = `Constraint violation during ${operation}`;
  } else if (sqliteError.code === 'SQLITE_BUSY') {
    code = ErrorCode.DATABASE_ERROR;
    message = 'Database is busy, please retry';
  }
  
  return new AppError(code, message, {
    operation,
    sqliteCode: sqliteError.code,
    sqliteMessage: sqliteError.message
  });
}

/**
 * Create an authentication error
 * @param {string} message - Error message
 * @returns {AppError}
 */
function authError(message = 'Authentication failed') {
  return new AppError(ErrorCode.AUTH_FAILED, message);
}

/**
 * Create an API error
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} responseData - API response data
 * @returns {AppError}
 */
function apiError(message, statusCode = null, responseData = null) {
  return new AppError(ErrorCode.API_ERROR, message, {
    statusCode,
    responseData
  });
}

module.exports = {
  ErrorCode,
  AppError,
  wrapHandler,
  validationError,
  notFoundError,
  databaseError,
  authError,
  apiError
};
