import { HttpError } from '../utils/httpErrors.js';

const safeMessage = (err, fallback) => (typeof err.message === 'string' && err.message ? err.message : fallback);

const getErrorStatusCode = (err, isHttpError) => {
  const statusCode = err.statusCode ?? err.status;
  if ((isHttpError || err.type === 'entity.parse.failed' || err.type === 'entity.too.large') && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
};

const getErrorCode = (err, isHttpError, statusCode) => {
  if (isHttpError && err.code) return err.code;
  if (err.type === 'entity.parse.failed') return 'INVALID_JSON';
  if (err.type === 'entity.too.large') return 'PAYLOAD_TOO_LARGE';
  if (statusCode === 404) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
};

const getErrorMessage = (err, isHttpError, statusCode, code) => {
  if (statusCode >= 500 && !isHttpError) return 'Internal server error';
  if (err.type === 'entity.parse.failed') return 'Request body must be valid JSON';
  if (err.type === 'entity.too.large') return 'Request body is too large';
  return safeMessage(err, code);
};

export const notFoundMiddleware = (req) => {
  throw new HttpError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
};

export const errorMiddleware = (err, req, res, next) => {
  const isHttpError = err instanceof HttpError;
  const statusCode = getErrorStatusCode(err, isHttpError);
  const code = getErrorCode(err, isHttpError, statusCode);
  const message = getErrorMessage(err, isHttpError, statusCode, code);

  if (statusCode >= 500 && !isHttpError) {
    console.error('[HTTP]', err.code || 'UNHANDLED_ERROR', safeMessage(err, 'Unknown error'));
  }

  const body = {
    error: {
      code,
      message
    }
  };

  if (isHttpError && err.details) {
    body.error.details = err.details;
  }

  res.status(statusCode).json(body);
};
