const express = require('express');
const router = express.Router();
const cors = require('cors');
const submissionController = require('../controllers/submissionController');
const { createRateLimiter } = require('../middlewares/rateLimiter');

// Explicit CORS middleware for public submission path: allows all origins
const publicCors = cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Geo-Mock-Mode', 'X-Side-Effect-Fail']
});

// Apply rate limiting specifically on submission endpoint
const submissionRateLimiter = createRateLimiter();

// Support OPTIONS preflight explicitly
router.options('/:id/submissions', publicCors, (req, res) => res.sendStatus(204));
router.options('/', publicCors, (req, res) => res.sendStatus(204));

// POST /widgets/:id/submissions
router.post(
  '/:id/submissions',
  publicCors,
  submissionRateLimiter,
  submissionController.createSubmission
);

// POST /submissions (alternative route with widgetId in body)
router.post(
  '/',
  publicCors,
  submissionRateLimiter,
  submissionController.createSubmission
);

module.exports = router;
