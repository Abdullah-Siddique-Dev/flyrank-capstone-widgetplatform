require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_super_secret_jwt_key_lead_capture_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Rate limiting defaults
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
  
  // Payload size limit
  MAX_PAYLOAD_SIZE: process.env.MAX_PAYLOAD_SIZE || '50kb',
  
  // Geo enrichment configuration
  GEO_TIMEOUT_MS: parseInt(process.env.GEO_TIMEOUT_MS || '3000', 10),
  GEO_MOCK_MODE: process.env.GEO_MOCK_MODE || 'live', // 'live' | 'fail_a' | 'fail_both' | 'mock_success'
  
  // Side effects configuration
  SIDE_EFFECT_FAIL_MODE: process.env.SIDE_EFFECT_FAIL_MODE === 'true',
};
