const { AppError } = require('../utils/errors');
const { ZodError } = require('zod');

function errorHandler(err, req, res, next) {
  // Syntax error from malformed JSON in express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'The request body could not be parsed as valid JSON.'
    });
  }

  // Payload too large error (express.json limit)
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request payload exceeds maximum allowed size.'
    });
  }

  // Zod schema validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'One or more fields failed validation.',
      issues: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Custom application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  // Fallback production-safe 500 error
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred.'
  });
}

module.exports = errorHandler;
