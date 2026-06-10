/**
 * error.js — Global Express error handler
 * Returns a standard JSON error envelope for all unhandled errors.
 *
 * Error envelope shape (matches API_Specification.md):
 *   { error: { code, message, requestId } }
 */

export const errorHandler = (err, req, res, next) => {
  // Already responded — pass through
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.headers['x-request-id'] ?? `req_${Date.now()}`;

  // Domain-specific custom errors
  if (err.statusCode && err.code) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
  }

  // PostgreSQL constraint / driver errors
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with this value already exists.',
        requestId,
      },
    });
  }

  if (err.code === '23503') {
    // Foreign key violation
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Referenced entity does not exist.',
        requestId,
      },
    });
  }

  if (err.code === '22P02') {
    // Invalid UUID or numeric input
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input syntax.',
        requestId,
      },
    });
  }

  // Generic server error
  console.error('[ERROR]', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    },
  });
};

// Keep legacy export name for backward compatibility
export const errorMiddleware = errorHandler;
