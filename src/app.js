const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const healthRoutes = require('./routes/health');

const app = express();

// Trust proxy for correct client IP extraction behind load balancers/proxies
app.set('trust proxy', true);

// Standard CORS (can be overridden/customized per route)
app.use(cors());

// Payload size limit & JSON parsing
app.use(express.json({ limit: config.MAX_PAYLOAD_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_PAYLOAD_SIZE }));

// Widget Delivery Routes (mounted first so explicit Cache-Control & CORS headers take effect)
app.use('/', require('./routes/deliveryRoutes'));
app.use('/api', require('./routes/deliveryRoutes'));

// Serve static public assets (e.g. test customer site)
app.use(express.static('public'));

// Routes
app.use('/api', healthRoutes);
app.use('/api/widgets', require('./routes/submissionRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Lead Capture Platform API',
    version: '1.0.0',
    status: 'running'
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
