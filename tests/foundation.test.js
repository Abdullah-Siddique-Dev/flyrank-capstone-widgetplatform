const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma');

describe('Phase 1: Foundation Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET / returns 200 and running status', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('running');
  });

  test('GET /api/health verifies PostgreSQL database connection', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  test('Database schema models are operable (CRUD check)', async () => {
    // Create Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Corp' }
    });
    expect(tenant.id).toBeDefined();

    // Create User
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'dummyhash'
      }
    });
    expect(user.tenantId).toBe(tenant.id);

    // Create Widget
    const widget = await prisma.widget.create({
      data: {
        tenantId: tenant.id,
        title: 'Signup Newsletter',
        type: 'signup',
        formFields: [{ name: 'email', label: 'Email', type: 'email', required: true }]
      }
    });
    expect(widget.tenantId).toBe(tenant.id);

    // Create Submission
    const submission = await prisma.submission.create({
      data: {
        widgetId: widget.id,
        tenantId: tenant.id,
        answers: { email: 'visitor@example.com' },
        ipAddress: '127.0.0.1',
        country: 'US',
        city: 'San Francisco'
      }
    });
    expect(submission.widgetId).toBe(widget.id);

    // Clean up
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
