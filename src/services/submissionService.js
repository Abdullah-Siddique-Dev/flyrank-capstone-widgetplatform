const prisma = require('../prisma');
const { AppError } = require('../utils/errors');
const geoService = require('./geoService');
const sideEffectQueue = require('./sideEffectQueue');

// Email regex pattern for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class SubmissionService {
  async processSubmission({ widgetId, answers, honeypotValue, ipAddress, idempotencyKey, geoMockMode, sideEffectForceFail }) {
    // 1. Fetch widget
    const widget = await prisma.widget.findUnique({
      where: { id: widgetId }
    });

    if (!widget) {
      throw new AppError('Widget not found', 404);
    }

    // 2. Validate answers object
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length === 0) {
      throw new AppError('Invalid submission answers. Expected non-empty key-value pairs.', 400);
    }

    // 3. Form fields schema validation
    const fields = Array.isArray(widget.formFields) ? widget.formFields : [];
    for (const field of fields) {
      const val = answers[field.name];
      if (field.required && (val === undefined || val === null || val === '')) {
        throw new AppError(`Field '${field.label || field.name}' is required.`, 400, {
          missingField: field.name
        });
      }

      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'email' && !EMAIL_REGEX.test(String(val))) {
          throw new AppError(`Invalid email address provided for '${field.label || field.name}'.`, 400, {
            field: field.name,
            value: val
          });
        }
      }
    }

    // 4. Honeypot spam check
    // If honeypot is filled, detect as bot spam
    const isSpam = Boolean(honeypotValue && String(honeypotValue).trim() !== '');

    // 5. Idempotency Check (if key provided)
    if (idempotencyKey) {
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey }
      });
      if (existing) {
        return {
          id: existing.id,
          widgetId: existing.widgetId,
          submittedAt: existing.submittedAt,
          isDuplicate: true,
          message: 'Submission already processed'
        };
      }
    }

    // 6. IP Geo Enrichment with Fallback Chain
    let geo = { country: null, city: null };
    try {
      geo = await geoService.enrichIp(ipAddress, geoMockMode);
    } catch (geoErr) {
      console.warn(`[SubmissionService] Geo enrichment error (degrading gracefully): ${geoErr.message}`);
    }

    // 7. Store Submission in PostgreSQL (Critical Path - Must Succeed)
    let submission;
    try {
      submission = await prisma.submission.create({
        data: {
          widgetId: widget.id,
          tenantId: widget.tenantId,
          answers,
          ipAddress,
          country: geo.country,
          city: geo.city,
          isSpam,
          idempotencyKey: idempotencyKey || null
        }
      });
    } catch (dbErr) {
      // If unique constraint error on idempotency key race condition
      if (dbErr.code === 'P2002' && idempotencyKey) {
        const existing = await prisma.submission.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return {
            id: existing.id,
            widgetId: existing.widgetId,
            submittedAt: existing.submittedAt,
            isDuplicate: true,
            message: 'Submission already processed'
          };
        }
      }
      throw dbErr;
    }

    // 8. Safe Side Effects (Background job off request path)
    if (!isSpam) {
      const emailField = answers.email || Object.values(answers).find(v => typeof v === 'string' && EMAIL_REGEX.test(v));
      
      sideEffectQueue.enqueue('SEND_CONFIRMATION_EMAIL', {
        submissionId: submission.id,
        widgetId: widget.id,
        widgetTitle: widget.title,
        email: emailField,
        forceFail: sideEffectForceFail
      });
    }

    return {
      id: submission.id,
      widgetId: widget.id,
      submittedAt: submission.submittedAt,
      message: 'Submission received successfully'
    };
  }
}

module.exports = new SubmissionService();
