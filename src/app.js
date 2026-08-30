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

// Public Delivery Routes
app.use('/', require('./routes/deliveryRoutes'));
app.use('/api', require('./routes/deliveryRoutes'));

// Static assets (dashboard UI, test customer website)
app.use(express.static('public'));

// Health check
app.use('/api', healthRoutes);

// Public Submission Routes
app.use('/api/widgets', require('./routes/submissionRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/widgets', require('./routes/submissionRoutes'));
app.use('/submissions', require('./routes/submissionRoutes'));

// Authenticated Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/auth', require('./routes/authRoutes'));

// Authenticated Widget Management Routes
app.use('/api/widgets', require('./routes/widgetRoutes'));
app.use('/widgets', require('./routes/widgetRoutes'));

// Authenticated Dashboard Analytics Routes
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/dashboard/api', require('./routes/dashboardRoutes'));

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
