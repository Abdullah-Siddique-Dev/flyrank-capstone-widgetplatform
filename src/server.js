const app = require('./app');
const config = require('./config');

const server = app.listen(config.PORT, () => {
  console.log(`Lead Capture Platform server running on port ${config.PORT}`);
});

module.exports = server;
