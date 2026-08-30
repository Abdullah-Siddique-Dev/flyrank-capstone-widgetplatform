const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma');
const { resetRateLimitStore } = require('../src/middlewares/rateLimiter');

jest.setTimeout(30000);

describe('Phase 2: Hardened Submission Path Tests', () => {
  let tenant;
  let widget;

  beforeAll(async () => {
    // Create test tenant and widget
    tenant = await prisma.tenant.create({
      data: { name: 'Acme Test Corp' }
    });

    widget = await prisma.widget.create({
      data: {
        tenantId: tenant.id,
        title: 'Lead Capture Form',
        type: 'signup',
        formFields: [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email Address', type: 'email', required: true },
          { name: 'company', label: 'Company', type: 'text', required: false }
        ]
      }
    });
  });

  beforeEach(() => {
    resetRateLimitStore();
  });

  afterAll(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
  });

  test('1. Valid submission stores record and returns 201', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-forwarded-for', '8.8.8.8')
      .set('x-geo-mock-mode', 'mock_success')
      .send({
        answers: {
          name: 'John Doe',
          email: 'john@example.com',
          company: 'Acme'
        }
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    const saved = await prisma.submission.findUnique({
      where: { id: res.body.data.id }
    });
    expect(saved).not.toBeNull();
    expect(saved.widgetId).toBe(widget.id);
    expect(saved.tenantId).toBe(tenant.id);
    expect(saved.answers.email).toBe('john@example.com');
    expect(saved.country).toBe('United States');
  });

  test('2. Invalid submission (missing required field) returns 400 with clean JSON error', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .send({
        answers: {
          company: 'Missing name and email'
        }
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('required');
  });

  test('3. Invalid submission (invalid email format) returns 400', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .send({
        answers: {
          name: 'Jane Doe',
          email: 'not-an-email'
        }
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  test('4. Oversized payload returns 413 or 400', async () => {
    // Generate large payload > 50kb
    const largeData = 'a'.repeat(60 * 1024);
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .send({
        answers: {
          name: 'Heavy User',
          email: 'heavy@example.com',
          company: largeData
        }
      });

    expect([413, 400]).toContain(res.statusCode);
  });

  test('5. Malformed JSON payload returns 400', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('Content-Type', 'application/json')
      .send('{"invalid_json_format":');

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid JSON');
  });

  test('6. Honeypot spam submission sets isSpam: true and returns success to deceive bots', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .send({
        answers: {
          name: 'Spam Bot',
          email: 'bot@spam.com'
        },
        _hp: 'i am a bot filling hidden field'
      });

    expect(res.statusCode).toBe(201);
    const saved = await prisma.submission.findUnique({
      where: { id: res.body.data.id }
    });
    expect(saved.isSpam).toBe(true);
  });

  test('7. Rate limiting blocks burst traffic with 429 while legitimate users continue', async () => {
    const attackerIp = '198.51.100.1';
    const normalIp = '198.51.100.2';

    // Attacker sends 10 requests (up to limit)
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post(`/api/widgets/${widget.id}/submissions`)
        .set('x-forwarded-for', attackerIp)
        .send({ answers: { name: `Burst ${i}`, email: `burst${i}@example.com` } });
      expect(res.statusCode).toBe(201);
    }

    // Attacker's 11th request gets 429
    const throttledRes = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-forwarded-for', attackerIp)
      .send({ answers: { name: 'Burst 11', email: 'burst11@example.com' } });
    expect(throttledRes.statusCode).toBe(429);
    expect(throttledRes.body.error).toBe('Too Many Requests');

    // Legitimate user from different IP succeeds without interference
    const legitimateRes = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-forwarded-for', normalIp)
      .send({ answers: { name: 'Legit User', email: 'legit@example.com' } });
    expect(legitimateRes.statusCode).toBe(201);
  });

  test('8. Geo provider fallback: Provider A fails -> fallback to Provider B', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-forwarded-for', '8.8.8.8')
      .set('x-geo-mock-mode', 'fail_a')
      .send({
        answers: {
          name: 'Fallback User',
          email: 'fallback@example.com'
        }
      });

    expect(res.statusCode).toBe(201);
    const saved = await prisma.submission.findUnique({
      where: { id: res.body.data.id }
    });
    expect(saved).not.toBeNull();
  });

  test('9. Both geo providers fail: graceful degradation stores submission without geo', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-forwarded-for', '8.8.8.8')
      .set('x-geo-mock-mode', 'fail_both')
      .send({
        answers: {
          name: 'No Geo User',
          email: 'nogeo@example.com'
        }
      });

    expect(res.statusCode).toBe(201);
    const saved = await prisma.submission.findUnique({
      where: { id: res.body.data.id }
    });
    expect(saved).not.toBeNull();
    expect(saved.country).toBeNull();
  });

  test('10. Safe side effect: email/webhook failure does NOT rollback submission persistence', async () => {
    const res = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-side-effect-fail', 'true')
      .send({
        answers: {
          name: 'Side Effect Test',
          email: 'sideeffect@example.com'
        }
      });

    expect(res.statusCode).toBe(201);
    const saved = await prisma.submission.findUnique({
      where: { id: res.body.data.id }
    });
    expect(saved).not.toBeNull();
    expect(saved.answers.email).toBe('sideeffect@example.com');
    // Allow background job queue to settle
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  test('11. CORS preflight OPTIONS request returns 204 with correct headers', async () => {
    const res = await request(app)
      .options(`/api/widgets/${widget.id}/submissions`)
      .set('Origin', 'http://external-customer-website.com');

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('12. Idempotency: duplicate request with same idempotency key returns existing submission', async () => {
    const key = `idem_${Date.now()}`;
    const res1 = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-idempotency-key', key)
      .send({
        answers: { name: 'Idempotent User', email: 'idempotent@example.com' }
      });

    expect(res1.statusCode).toBe(201);
    const subId1 = res1.body.data.id;

    // Retry request with same key
    const res2 = await request(app)
      .post(`/api/widgets/${widget.id}/submissions`)
      .set('x-idempotency-key', key)
      .send({
        answers: { name: 'Idempotent User', email: 'idempotent@example.com' }
      });

    expect(res2.statusCode).toBe(201);
    expect(res2.body.data.id).toBe(subId1);
    expect(res2.body.data.isDuplicate).toBe(true);

    const count = await prisma.submission.count({
      where: { idempotencyKey: key }
    });
    expect(count).toBe(1);
  });

  test('13. Widget validation: Non-existent widget ID returns 404', async () => {
    const res = await request(app)
      .post('/api/widgets/non-existent-widget-uuid/submissions')
      .send({
        answers: { name: 'Nobody', email: 'nobody@example.com' }
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');
  });
});
