const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/auth');

// All dashboard endpoints require tenant authentication
router.use(requireAuth);

router.get('/summary', dashboardController.getSummary);
router.get('/widgets/:id/submissions', dashboardController.getWidgetSubmissions);
router.get('/widgets/:id/stats', dashboardController.getWidgetStats);

module.exports = router;
