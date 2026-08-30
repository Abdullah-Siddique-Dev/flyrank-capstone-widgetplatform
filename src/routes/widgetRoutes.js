const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { requireAuth } = require('../middlewares/auth');

// All widget management endpoints require tenant authentication
router.use(requireAuth);

router.post('/', widgetController.createWidget);
router.get('/', widgetController.listWidgets);
router.get('/:id', widgetController.getWidget);
router.patch('/:id', widgetController.updateWidget);
router.delete('/:id', widgetController.deleteWidget);

module.exports = router;
