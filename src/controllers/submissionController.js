const submissionService = require('../services/submissionService');
const { extractClientIp } = require('../utils/ipExtractor');

async function createSubmission(req, res, next) {
  try {
    const widgetId = req.params.id || req.body.widgetId;
    const answers = req.body.answers || req.body;
    
    // Honeypot fields check
    const honeypotValue = req.body._hp || req.body.hp_field || req.body.website || req.body.honeypot || null;
    
    // Remove metadata fields from answers if body was passed directly
    if (answers && typeof answers === 'object') {
      delete answers._hp;
      delete answers.hp_field;
      delete answers.website;
      delete answers.honeypot;
      delete answers.widgetId;
      delete answers.idempotencyKey;
    }

    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;
    const ipAddress = extractClientIp(req);
    
    // Test mode overrides via headers for deterministic probe testing
    const geoMockMode = req.headers['x-geo-mock-mode'] || null;
    const sideEffectForceFail = req.headers['x-side-effect-fail'] === 'true';

    const result = await submissionService.processSubmission({
      widgetId,
      answers,
      honeypotValue,
      ipAddress,
      idempotencyKey,
      geoMockMode,
      sideEffectForceFail
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSubmission
};
