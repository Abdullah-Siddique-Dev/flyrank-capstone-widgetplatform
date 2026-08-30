const { extractClientIp } = require('../utils/ipExtractor');
const config = require('../config');

// In-memory bucket store for rate limiting
const store = new Map();

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || config.RATE_LIMIT_WINDOW_MS;
  const max = options.max || config.RATE_LIMIT_MAX_REQUESTS;
  const keyGenerator = options.keyGenerator || ((req) => extractClientIp(req));

  return function rateLimiter(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store.has(key)) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    const record = store.get(key);

    if (now > record.resetTime) {
      // Window expired, reset counter
      record.count = 1;
      record.resetTime = now + windowMs;
      store.set(key, record);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfterSeconds
      });
    }

    record.count += 1;
    store.set(key, record);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    return next();
  };
}

// Utility to clear store for isolated testing
function resetRateLimitStore() {
  store.clear();
}

module.exports = { createRateLimiter, resetRateLimitStore };
