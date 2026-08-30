const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const healthRoutes = require('./routes/health');
const submissionRoutes = require('./routes/submissionRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');

const app = express();

// Trust proxy for correct client IP extraction behind load balancers/proxies
app.set('trust proxy', true);

// Global CORS handling
app.use(cors());

// Payload size limit & JSON parsing
app.use(express.json({ limit: config.MAX_PAYLOAD_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_PAYLOAD_SIZE }));

// Health check
app.use('/api', healthRoutes);

// Public widget delivery routes (sets explicit cache headers and mime types)
app.use('/', deliveryRoutes);
app.use('/api', deliveryRoutes);

// Static assets (test customer site, fallback public assets)
app.use(express.static('public'));

// Public submission routes
app.use('/api/widgets', submissionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/widgets', submissionRoutes);
app.use('/submissions', submissionRoutes);

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
