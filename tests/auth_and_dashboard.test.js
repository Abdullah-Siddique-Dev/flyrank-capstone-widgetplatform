const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma');

jest.setTimeout(30000);

describe('Phase 4: Authentication, Tenant Isolation & Dashboard Tests', () => {
  let userA, tokenA, tenantA, widgetA1, widgetA2, subA1;
  let userB, tokenB, tenantB, widgetB1, subB1;

  beforeAll(async () => {
    // 1. Register Tenant A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        email: `tenantA_${Date.now()}@example.com`,
        password: 'Password123!',
        tenantName: 'Tenant A Corp'
      });
    expect(resA.statusCode).toBe(201);
    tokenA = resA.body.data.token;
    userA = resA.body.data.user;
    tenantA = { id: userA.tenantId };

    // 2. Register Tenant B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `tenantB_${Date.now()}@example.com`,
        password: 'Password456!',
        tenantName: 'Tenant B Corp'
      });
    expect(resB.statusCode).toBe(201);
    tokenB = resB.body.data.token;
    userB = resB.body.data.user;
    tenantB = { id: userB.tenantId };

    // Create Widget A1 and A2 for Tenant A
    const wResA1 = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Tenant A Form 1',
        type: 'signup',
        formFields: [{ name: 'email', label: 'Email', type: 'email', required: true }]
      });
    widgetA1 = wResA1.body.data;

    const wResA2 = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Tenant A Form 2',
        type: 'contact',
        formFields: [{ name: 'email', label: 'Email', type: 'email', required: true }]
      });
    widgetA2 = wResA2.body.data;

    // Create Widget B1 for Tenant B
    const wResB1 = await request(app)
      .post('/api/widgets')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        title: 'Tenant B Form 1',
        type: 'signup',
        formFields: [{ name: 'email', label: 'Email', type: 'email', required: true }]
      });
    widgetB1 = wResB1.body.data;

    // Submit a lead to Widget A1
    const subResA = await request(app)
      .post(`/api/widgets/${widgetA1.id}/submissions`)
      .send({
        answers: { email: 'lead-a@example.com' }
      });
    subA1 = subResA.body.data;

    // Submit a lead to Widget B1
    const subResB = await request(app)
      .post(`/api/widgets/${widgetB1.id}/submissions`)
      .send({
        answers: { email: 'lead-b@example.com' }
      });
    subB1 = subResB.body.data;
  });

  afterAll(async () => {
    if (tenantA?.id) {
      await prisma.tenant.delete({ where: { id: tenantA.id } }).catch(() => {});
    }
    if (tenantB?.id) {
      await prisma.tenant.delete({ where: { id: tenantB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // --- AUTHENTICATION TESTS ---
  test('1. Successful login returns 200, JWT token, and user metadata', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: userA.email,
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(userA.email);
    expect(res.body.data.user.tenantId).toBe(tenantA.id);
  });

  test('2. Invalid login credentials returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: userA.email,
        password: 'WrongPassword!'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Invalid email or password');
  });

  test('3. Protected endpoint without authentication token returns 401', async () => {
    const res = await request(app).get('/api/widgets');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('4. Protected endpoint with valid Bearer token returns 200', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(userA.email);
  });

  test('5. Password hash is never exposed in register, login, or me endpoints', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(meRes.body.data.passwordHash).toBeUndefined();
    expect(meRes.body.data.password).toBeUndefined();
  });

  // --- TENANT ISOLATION TESTS ---
  test('6. Tenant A can read their own widgets and submissions', async () => {
    const listRes = await request(app)
      .get('/api/widgets')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.statusCode).toBe(200);
    const widgetIds = listRes.body.data.map(w => w.id);
    expect(widgetIds).toContain(widgetA1.id);
    expect(widgetIds).toContain(widgetA2.id);
    expect(widgetIds).not.toContain(widgetB1.id);
  });

  test('7. Tenant A attempting to access Tenant B widget returns 404 (preventing discovery)', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetB1.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');
  });

  test('8. Tenant A attempting to update Tenant B widget returns 404', async () => {
    const res = await request(app)
      .patch(`/api/widgets/${widgetB1.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Hacked Title' });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');

    // Verify widget B was not changed
    const unchanged = await prisma.widget.findUnique({ where: { id: widgetB1.id } });
    expect(unchanged.title).toBe('Tenant B Form 1');
  });

  test('9. Tenant A attempting to delete Tenant B widget returns 404', async () => {
    const res = await request(app)
      .delete(`/api/widgets/${widgetB1.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');

    // Verify widget B still exists
    const stillExists = await prisma.widget.findUnique({ where: { id: widgetB1.id } });
    expect(stillExists).not.toBeNull();
  });

  test('10. Tenant A attempting to view Tenant B submissions returns 404', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetB1.id}/submissions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');
  });

  test('11. Tenant A attempting to view Tenant B stats returns 404', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetB1.id}/stats`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Widget not found');
  });

  // --- DASHBOARD & ANALYTICS TESTS ---
  test('12. Dashboard summary statistics are strictly scoped to caller tenant', async () => {
    const sumResA = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(sumResA.statusCode).toBe(200);
    expect(sumResA.body.data.totalWidgets).toBe(2);
    expect(sumResA.body.data.totalSubmissions).toBe(1);

    const sumResB = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(sumResB.statusCode).toBe(200);
    expect(sumResB.body.data.totalWidgets).toBe(1);
    expect(sumResB.body.data.totalSubmissions).toBe(1);
  });

  test('13. Per-widget submissions list returns submissions belonging to that widget', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetA1.id}/submissions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.submissions.length).toBe(1);
    expect(res.body.data.submissions[0].answers.email).toBe('lead-a@example.com');
  });

  test('14. Per-widget stats returns geo breakdown and counts', async () => {
    const res = await request(app)
      .get(`/api/widgets/${widgetA1.id}/stats`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalSubmissions).toBe(1);
    expect(Array.isArray(res.body.data.geoBreakdown)).toBe(true);
  });
});
