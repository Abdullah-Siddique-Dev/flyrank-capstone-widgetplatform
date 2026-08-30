const express = require('express');
const router = express.Router();
const cors = require('cors');
const deliveryController = require('../controllers/deliveryController');

const publicCors = cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

// OPTIONS preflight
router.options('/widgets/:id/config', publicCors, (req, res) => res.sendStatus(204));
router.options('/:id/config', publicCors, (req, res) => res.sendStatus(204));

// Widget Config Endpoints
router.get('/widgets/:id/config', publicCors, deliveryController.getWidgetConfig);
router.get('/:id/config', publicCors, deliveryController.getWidgetConfig);

// Versioned Widget Bundles
router.get('/widget.js', publicCors, deliveryController.serveWidgetScript);
router.get('/widget.:version.js', publicCors, deliveryController.serveWidgetScript);

module.exports = router;
