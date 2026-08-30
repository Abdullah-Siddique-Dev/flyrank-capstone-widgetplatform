const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

router.get('/health', async (req, res, next) => {
  try {
    // Verify DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

module.exports = router;
