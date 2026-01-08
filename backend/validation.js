/**
 * Input Validation for IPC Handlers
 * Validates data before passing to backend functions
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {any} [value] - Sanitized/coerced value if validation passed
 */

/**
 * Validate barcode string
 * @param {any} barcode - Barcode to validate
 * @returns {ValidationResult}
 */
function validateBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return { valid: false, error: 'Barcode must be a non-empty string' };
  }
  const trimmed = barcode.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Barcode cannot be empty' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate user ID
 * @param {any} userId - User ID to validate
 * @returns {ValidationResult}
 */
function validateUserId(userId) {
  const id = parseInt(userId, 10);
  if (isNaN(id) || id <= 0) {
    return { valid: false, error: 'User ID must be a positive integer' };
  }
  return { valid: true, value: id };
}

/**
 * Validate password
 * @param {any} password - Password to validate
 * @returns {ValidationResult}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password must be a non-empty string' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return { valid: true, value: password };
}

/**
 * Validate purchase request ID
 * @param {any} prId - Purchase request ID to validate
 * @returns {ValidationResult}
 */
function validatePrId(prId) {
  if (!prId || (typeof prId !== 'string' && typeof prId !== 'number')) {
    return { valid: false, error: 'Purchase request ID is required' };
  }
  const str = String(prId).trim();
  if (str.length === 0) {
    return { valid: false, error: 'Purchase request ID cannot be empty' };
  }
  return { valid: true, value: str };
}

/**
 * Validate received lines array
 * @param {any} lines - Lines array to validate
 * @returns {ValidationResult}
 */
function validateReceivedLines(lines) {
  if (!Array.isArray(lines)) {
    return { valid: false, error: 'Lines must be an array' };
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || typeof line !== 'object') {
      return { valid: false, error: `Line ${i} must be an object` };
    }
    if (!line.id || (typeof line.id !== 'string' && typeof line.id !== 'number')) {
      return { valid: false, error: `Line ${i} missing valid id` };
    }
    if (typeof line.received_so_far !== 'number' || line.received_so_far < 0) {
      return { valid: false, error: `Line ${i} received_so_far must be a non-negative number` };
    }
  }
  
  return { valid: true, value: lines };
}

/**
 * Validate item edits array
 * @param {any} edits - Edits array to validate
 * @returns {ValidationResult}
 */
function validateItemEdits(edits) {
  if (!Array.isArray(edits)) {
    return { valid: false, error: 'Edits must be an array' };
  }
  
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (!edit || typeof edit !== 'object') {
      return { valid: false, error: `Edit ${i} must be an object` };
    }
    if (!edit.id || (typeof edit.id !== 'string' && typeof edit.id !== 'number')) {
      return { valid: false, error: `Edit ${i} missing valid id` };
    }
  }
  
  return { valid: true, value: edits };
}

/**
 * Validate item ID
 * @param {any} itemId - Item ID to validate
 * @returns {ValidationResult}
 */
function validateItemId(itemId) {
  const id = parseInt(itemId, 10);
  if (isNaN(id) || id <= 0) {
    return { valid: false, error: 'Item ID must be a positive integer' };
  }
  return { valid: true, value: id };
}

/**
 * Validate quantity
 * @param {any} quantity - Quantity to validate
 * @returns {ValidationResult}
 */
function validateQuantity(quantity) {
  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    return { valid: false, error: 'Quantity must be a non-negative number' };
  }
  return { valid: true, value: qty };
}

/**
 * Validate session timeout hours
 * @param {any} hours - Hours to validate
 * @returns {ValidationResult}
 */
function validateSessionTimeout(hours) {
  const h = Number(hours);
  if (isNaN(h) || h < 0.1 || h > 168) { // Min 6 minutes, max 1 week
    return { valid: false, error: 'Session timeout must be between 0.1 and 168 hours' };
  }
  return { valid: true, value: h };
}

/**
 * Validate date string (ISO format)
 * @param {any} dateStr - Date string to validate
 * @param {boolean} [required=false] - Whether the date is required
 * @returns {ValidationResult}
 */
function validateDate(dateStr, required = false) {
  if (!dateStr) {
    if (required) {
      return { valid: false, error: 'Date is required' };
    }
    return { valid: true, value: null };
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  return { valid: true, value: dateStr };
}

/**
 * Validate optional comment string
 * @param {any} comment - Comment to validate
 * @returns {ValidationResult}
 */
function validateComment(comment) {
  if (comment === null || comment === undefined) {
    return { valid: true, value: '' };
  }
  if (typeof comment !== 'string') {
    return { valid: false, error: 'Comment must be a string' };
  }
  return { valid: true, value: comment };
}

/**
 * Validate username
 * @param {any} username - Username to validate
 * @returns {ValidationResult}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username must be a non-empty string' };
  }
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate purchase request updates object
 * @param {any} updates - Updates object to validate
 * @returns {ValidationResult}
 */
function validatePrUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return { valid: false, error: 'Updates must be an object' };
  }
  // Allow any properties for flexibility, just ensure it's an object
  return { valid: true, value: updates };
}

/**
 * Validate limit parameter for pagination
 * @param {any} limit - Limit to validate
 * @param {number} [defaultValue=50] - Default value
 * @returns {ValidationResult}
 */
function validateLimit(limit, defaultValue = 50) {
  if (limit === null || limit === undefined) {
    return { valid: true, value: defaultValue };
  }
  const num = parseInt(limit, 10);
  if (isNaN(num) || num < 1 || num > 1000) {
    return { valid: false, error: 'Limit must be between 1 and 1000' };
  }
  return { valid: true, value: num };
}

module.exports = {
  validateBarcode,
  validateUserId,
  validatePassword,
  validatePrId,
  validateReceivedLines,
  validateItemEdits,
  validateItemId,
  validateQuantity,
  validateSessionTimeout,
  validateDate,
  validateComment,
  validateUsername,
  validatePrUpdates,
  validateLimit
};
