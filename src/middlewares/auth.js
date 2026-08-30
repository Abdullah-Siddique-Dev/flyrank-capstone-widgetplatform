const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../utils/errors');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected Bearer token.'
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.'
    });
  }
}

module.exports = { requireAuth };
