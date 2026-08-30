const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/auth');

// All widget management endpoints require tenant authentication
router.use(requireAuth);

router.post('/', widgetController.createWidget);
router.get('/', widgetController.listWidgets);
router.get('/:id', widgetController.getWidget);
router.patch('/:id', widgetController.updateWidget);
router.delete('/:id', widgetController.deleteWidget);

// Widget submissions and stats (scoped to tenant)
router.get('/:id/submissions', dashboardController.getWidgetSubmissions);
router.get('/:id/stats', dashboardController.getWidgetStats);

module.exports = router;
