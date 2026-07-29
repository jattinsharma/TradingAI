/**
 * API Error Parser
 *
 * Converts backend API error responses into clean, user-friendly messages.
 * Handles NestJS ValidationPipe errors, auth errors, and generic failures.
 *
 * Usage:
 *   const error = parseApiError(err);
 *   showError(error.message); // "Invalid email or password"
 *
 * The parser extracts validation messages from:
 * - NestJS 400 validation errors (array of constraint strings)
 * - NestJS 400 validation errors (object with message array)
 * - NestJS 4xx errors with message string
 * - Network errors (TypeError, AbortError)
 * - Generic/unknown errors
 */

export interface ParsedError {
  /** User-friendly error message (never shows JSON or status codes) */
  message: string;
  /** Specific field validation errors, keyed by field name */
  fields?: Record<string, string>;
  /** True if this is a known/expected error (vs unknown) */
  isKnown: boolean;
}

/**
 * Parse any error into a user-friendly message.
 * Never exposes JSON, status codes, or stack traces to the user.
 */
export function parseApiError(error: unknown): ParsedError {
  // Already a ParsedError — return as-is
  if (error && typeof error === 'object' && 'message' in error && 'isKnown' in error) {
    const pe = error as ParsedError;
    return pe;
  }

  // Handle string errors
  if (typeof error === 'string') {
    if (error.includes('Failed to fetch')) {
      return {
        message: 'Cannot connect to the backend. Check your internet connection and verify the backend URL in Settings.',
        isKnown: true,
      };
    }
    if (error.includes('timeout') || error.includes('timed out')) {
      return {
        message: 'The request timed out. The server may be under heavy load.',
        isKnown: true,
      };
    }
    return { message: error, isKnown: false };
  }

  if (!error || typeof error !== 'object') {
    return { message: 'An unexpected error occurred.', isKnown: false };
  }

  const err = error as Record<string, unknown>;

  // Handle NestJS HTTP exception responses (e.g. 401, 409, etc.)
  if (typeof err.message === 'string') {
    const msg = err.message;

    // Auth errors
    if (msg === 'Unauthorized' || msg === 'Invalid email or password') {
      return { message: 'Invalid email or password.', isKnown: true };
    }
    if (msg.includes('already exists') || msg.includes('already registered')) {
      return { message: 'This email is already registered. Try logging in instead.', isKnown: true };
    }
    if (msg.includes('not found')) {
      return { message: 'Account not found. Check your email or register a new account.', isKnown: true };
    }
    if (msg === 'Cannot GET' || msg === 'Not Found') {
      return { message: 'The requested resource was not found. The backend may have changed.', isKnown: true };
    }

    // Generic known errors
    if (msg === 'Forbidden' || msg === 'Forbidden resource') {
      return { message: 'You do not have permission to perform this action.', isKnown: true };
    }
    if (msg === 'Too Many Requests' || msg.includes('rate limit') || msg.includes('throttl')) {
      return { message: 'Too many requests. Please wait a moment before trying again.', isKnown: true };
    }

    // If it's a plain message (not a status code), return it directly
    if (!/^\d{3}/.test(msg)) {
      return { message: msg, isKnown: true };
    }
  }

  // Handle NestJS ValidationPipe errors (array of strings)
  // e.g. ["Password must contain at least one uppercase letter", "Password must be at least 8 characters"]
  if (Array.isArray(err.message)) {
    const messages = err.message as string[];
    const fields = extractFieldErrors(messages);
    return {
      message: messages[0] || 'Validation failed.',
      fields: fields,
      isKnown: true,
    };
  }

  // Handle NestJS raw message array (some versions return { message: [...] })
  if (err.message && Array.isArray(err.message)) {
    const rawMessages = err.message as string[];
    const messages = parseNestJSValidationMessages(rawMessages);
    if (messages.length > 0) {
      const fields = extractFieldErrors(messages);
      return {
        message: messages[0],
        fields: fields,
        isKnown: true,
      };
    }
  }

  // Handle NestJS structured validation errors
  // e.g. { message: [{ property: 'password', constraints: { ... } }] }
  if (Array.isArray(err.message)) {
    for (const item of err.message) {
      if (item && typeof item === 'object' && 'constraints' in item) {
        const constraints = (item as Record<string, unknown>).constraints as Record<string, string>;
        const field = String((item as Record<string, unknown>).property || '');
        const constraintMessages = Object.values(constraints);
        const fields: Record<string, string> = {};
        if (field && constraintMessages.length > 0) {
          fields[field] = constraintMessages[0];
        }
        return {
          message: constraintMessages[0] || 'Validation failed.',
          fields: Object.keys(fields).length > 0 ? fields : undefined,
          isKnown: true,
        };
      }
    }
  }

  // Handle AuthService thrown errors
  if (typeof err.message === 'string') {
    return { message: err.message, isKnown: true };
  }

  // Handle Error instances
  if (error instanceof Error) {
    const e = error as Error;
    if (e.name === 'AbortError') {
      return { message: 'Request timed out. The server may be under heavy load.', isKnown: true };
    }
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      return {
        message: 'Cannot connect to the backend. Check your internet connection and verify the backend URL in Settings.',
        isKnown: true,
      };
    }
    return { message: e.message, isKnown: true };
  }

  return { message: 'An unexpected error occurred.', isKnown: false };
}

/**
 * Parse NestJS validation messages like:
 * "password must be at least 8 characters"
 * "email must be an email"
 * Into clean, readable messages.
 */
function parseNestJSValidationMessages(messages: string[]): string[] {
  return messages.map(m => {
    // Skip raw constraint strings that already look user-friendly
    if (m.startsWith('Password') || m.startsWith('Email') || m.startsWith('Name')) {
      return cleanValidationMessage(m);
    }
    // Parse NestJS defaults
    return cleanValidationMessage(m);
  });
}

/**
 * Clean up validation messages into user-friendly format.
 */
function cleanValidationMessage(msg: string): string {
  // Already clean
  if (msg.endsWith('.') || msg.endsWith('!')) return msg;

  // Capitalize first letter
  const cleaned = msg.charAt(0).toUpperCase() + msg.slice(1);

  // Map known NestJS defaults
  const replacements: Record<string, string> = {
    'Email must be an email': 'Email is not valid.',
    'email must be an email': 'Email is not valid.',
    'password must be longer than or equal to 8 characters': 'Password must be at least 8 characters long.',
    'Password must be longer than or equal to 8 characters': 'Password must be at least 8 characters long.',
    'password must be longer than or equal to 1 characters': 'Password is required.',
    'name must be longer than or equal to 1 characters': 'Name is required.',
    'name must be shorter than or equal to 100 characters': 'Name must be 100 characters or fewer.',
  };

  if (replacements[cleaned]) return replacements[cleaned];

  return cleaned;
}

/**
 * Extract field-specific validation errors from a list of error messages.
 * Groups messages by the field they relate to.
 */
function extractFieldErrors(messages: string[]): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const msg of messages) {
    const lower = msg.toLowerCase();

    if (lower.includes('uppercase') || lower.includes('upper case')) {
      fields.password = 'Must contain at least one uppercase letter.';
    } else if (lower.includes('lowercase') || lower.includes('lower case')) {
      fields.password = 'Must contain at least one lowercase letter.';
    } else if (lower.includes('number') || lower.includes('digit')) {
      fields.password = 'Must contain at least one number.';
    } else if (lower.includes('8 characters') || lower.includes('at least 8')) {
      fields.password = 'Must be at least 8 characters long.';
    } else if (lower.includes('email')) {
      fields.email = 'Please enter a valid email address.';
    } else if (lower.includes('name')) {
      fields.name = 'Name is required.';
    }
  }

  return fields;
}

/**
 * Validate password requirements locally (client-side).
 * Returns an array of requirement strings with their status.
 */
export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
  ];
}

/**
 * Check if a password meets all requirements.
 */
export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every(r => r.met);
}
