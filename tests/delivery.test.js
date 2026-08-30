const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma');

describe('Phase 3: Widget Delivery Tests', () => {
  let tenant;
  let widget;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: 'Delivery Corp' }
    });

    widget = await prisma.widget.create({
      data: {
        tenantId: tenant.id,
        title: 'Delivery Newsletter',
        type: 'signup',
        description: 'Subscribe to updates',
        buttonText: 'Join Now',
        formFields: [
          { name: 'email', label: 'Email', type: 'email', required: true }
        ]
      }
    });
  });

  afterAll(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
    await prisma.$disconnect();
  });

  test('1. GET /widgets/:id/config returns 200, widget config data, and short-lived cache headers', async () => {
    const res = await request(app).get(`/widgets/${widget.id}/config`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(widget.id);
    expect(res.body.data.title).toBe('Delivery Newsletter');
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test('2. GET /widgets/:id/config with non-existent ID returns 404', async () => {
    const res = await request(app).get('/widgets/non-existent-widget-id/config');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Not Found');
  });

  test('3. GET /widget.v1.js returns 200, javascript content type, and long-lived cache headers', async () => {
    const res = await request(app).get('/widget.v1.js');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
    expect(res.headers['cache-control']).toContain('max-age=31536000');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.text).toContain('LeadCaptureWidget');
  });

  test('4. GET /widget.js returns 200 and bundle content', async () => {
    const res = await request(app).get('/widget.js');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
    expect(res.text).toContain('renderWidget');
  });

  test('5. Static test customer website HTML is served at /test-customer-site.html', async () => {
    const res = await request(app).get('/test-customer-site.html');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Customer Website — ACME Corp Demo');
  });
});
