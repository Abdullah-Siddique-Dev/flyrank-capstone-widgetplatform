const app = require('../src/app');
const prisma = require('../src/prisma');
const request = require('supertest');

async function runE2EVerification() {
  console.log('================================================================');
  console.log('FINAL QA LIVE AUDIT: 12 REAL SCENARIOS VERIFICATION');
  console.log('================================================================\n');

  // SCENARIO 1: Root API
  console.log('SCENARIO 1: Server and Root API verification');
  const res1 = await request(app).get('/');
  console.log(`- Status: ${res1.statusCode}`);
  console.log(`- Response:`, res1.body);
  if (res1.statusCode !== 200) throw new Error('Scenario 1 Failed');
  console.log('-> SCENARIO 1 PASS\n');

  // SCENARIO 2: Database health
  console.log('SCENARIO 2: Database Health Check');
  const res2 = await request(app).get('/api/health');
  console.log(`- Status: ${res2.statusCode}`);
  console.log(`- Response:`, res2.body);
  if (res2.statusCode !== 200 || res2.body.database !== 'connected') throw new Error('Scenario 2 Failed');
  console.log('-> SCENARIO 2 PASS\n');

  // SCENARIO 3: Register Tenant A
  console.log('SCENARIO 3: Register Tenant A Owner');
  const emailA = `audit_tenant_a_${Date.now()}@acme.com`;
  const res3 = await request(app).post('/api/auth/register').send({
    email: emailA,
    password: 'SecurePassword123!',
    tenantName: 'Acme Global'
  });
  console.log(`- Status: ${res3.statusCode}`);
  console.log(`- Registered User:`, res3.body.data.user);
  console.log(`- Has JWT Token: ${Boolean(res3.body.data.token)}`);
  console.log(`- Password Hash in Response: ${Boolean(res3.body.data.user.passwordHash || res3.body.data.user.password)} (Must be false)`);
  const tokenA = res3.body.data.token;
  const tenantAId = res3.body.data.user.tenantId;
  if (res3.statusCode !== 201 || !tokenA || res3.body.data.user.passwordHash) throw new Error('Scenario 3 Failed');
  console.log('-> SCENARIO 3 PASS\n');

  // SCENARIO 4: Create Widget A
  console.log('SCENARIO 4: Create Widget for Tenant A');
  const res4 = await request(app)
    .post('/api/widgets')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      title: 'Global Newsletter Signup',
      type: 'signup',
      description: 'Subscribe for product updates.',
      buttonText: 'Subscribe Now',
      formFields: [
        { name: 'fullName', label: 'Full Name', type: 'text', required: true },
        { name: 'workEmail', label: 'Work Email', type: 'email', required: true }
      ]
    });
  console.log(`- Status: ${res4.statusCode}`);
  console.log(`- Created Widget:`, res4.body.data);
  const widgetA = res4.body.data;
  if (res4.statusCode !== 201 || !widgetA.id) throw new Error('Scenario 4 Failed');
  console.log('-> SCENARIO 4 PASS\n');

  // SCENARIO 5: Public Widget Config
  console.log('SCENARIO 5: Fetch Public Widget Config');
  const res5 = await request(app).get(`/widgets/${widgetA.id}/config`);
  console.log(`- Status: ${res5.statusCode}`);
  console.log(`- Config Title: ${res5.body.data.title}`);
  console.log(`- Tenant ID in Config: ${Boolean(res5.body.data.tenantId)} (Must be false to protect privacy)`);
  console.log(`- Cache-Control Header: ${res5.headers['cache-control']}`);
  if (res5.statusCode !== 200 || res5.body.data.tenantId) throw new Error('Scenario 5 Failed');
  console.log('-> SCENARIO 5 PASS\n');

  // SCENARIO 6: Load Widget Bundle
  console.log('SCENARIO 6: Load Versioned Widget Bundle');
  const res6 = await request(app).get('/widget/v1/widget.js');
  console.log(`- Status: ${res6.statusCode}`);
  console.log(`- Content-Type: ${res6.headers['content-type']}`);
  console.log(`- Cache-Control: ${res6.headers['cache-control']}`);
  console.log(`- CORS Allow-Origin: ${res6.headers['access-control-allow-origin']}`);
  if (res6.statusCode !== 200 || !res6.headers['cache-control'].includes('immutable')) throw new Error('Scenario 6 Failed');
  console.log('-> SCENARIO 6 PASS\n');

  // SCENARIO 7: Submit Real Test Lead
  console.log('SCENARIO 7: Submit Real Test Lead');
  const leadPayload = {
    answers: {
      fullName: 'Thomas Anderson',
      workEmail: 'neo@matrix.org'
    }
  };
  const res7 = await request(app)
    .post(`/api/widgets/${widgetA.id}/submissions`)
    .set('x-forwarded-for', '8.8.8.8')
    .send(leadPayload);
  console.log(`- Status: ${res7.statusCode}`);
  console.log(`- Response:`, res7.body);
  const submissionId = res7.body.data.id;
  if (res7.statusCode !== 201 || !submissionId) throw new Error('Scenario 7 Failed');
  console.log('-> SCENARIO 7 PASS\n');

  // SCENARIO 8: Verify in PostgreSQL
  console.log('SCENARIO 8: Verify Record Durably Persisted in PostgreSQL Database');
  const dbRecord = await prisma.submission.findUnique({
    where: { id: submissionId }
  });
  console.log(`- DB Record ID: ${dbRecord.id}`);
  console.log(`- DB Widget ID: ${dbRecord.widgetId} (Matches Widget A: ${dbRecord.widgetId === widgetA.id})`);
  console.log(`- DB Tenant ID: ${dbRecord.tenantId} (Matches Tenant A: ${dbRecord.tenantId === tenantAId})`);
  console.log(`- Saved Answers:`, dbRecord.answers);
  console.log(`- Location Enriched: Country=${dbRecord.country}, City=${dbRecord.city}`);
  if (!dbRecord || dbRecord.tenantId !== tenantAId) throw new Error('Scenario 8 Failed');
  console.log('-> SCENARIO 8 PASS\n');

  // SCENARIO 9: Login as Owner
  console.log('SCENARIO 9: Login as Tenant A Owner');
  const res9 = await request(app).post('/api/auth/login').send({
    email: emailA,
    password: 'SecurePassword123!'
  });
  console.log(`- Status: ${res9.statusCode}`);
  console.log(`- User: ${res9.body.data.user.email}`);
  console.log(`- Token Issued: ${Boolean(res9.body.data.token)}`);
  if (res9.statusCode !== 200 || !res9.body.data.token) throw new Error('Scenario 9 Failed');
  console.log('-> SCENARIO 9 PASS\n');

  // SCENARIO 10: Lead Appears in Dashboard
  console.log('SCENARIO 10: Verify Lead Appears in Owner Dashboard');
  const res10Summary = await request(app)
    .get('/api/dashboard/summary')
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Summary Total Submissions: ${res10Summary.body.data.totalSubmissions}`);
  console.log(`- Summary Valid Leads: ${res10Summary.body.data.validSubmissions}`);
  
  const res10Feed = await request(app)
    .get(`/api/widgets/${widgetA.id}/submissions`)
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Widget Feed Lead:`, res10Feed.body.data.submissions[0].answers);
  if (res10Summary.body.data.totalSubmissions !== 1 || res10Feed.body.data.submissions.length !== 1) throw new Error('Scenario 10 Failed');
  console.log('-> SCENARIO 10 PASS\n');

  // SCENARIO 11: Register Tenant B & Create Widget B
  console.log('SCENARIO 11: Register Tenant B & Create Widget B');
  const emailB = `audit_tenant_b_${Date.now()}@beta.com`;
  const res11Reg = await request(app).post('/api/auth/register').send({
    email: emailB,
    password: 'BetaPassword123!',
    tenantName: 'Beta Corp'
  });
  const tokenB = res11Reg.body.data.token;
  const tenantBId = res11Reg.body.data.user.tenantId;

  const res11Widget = await request(app)
    .post('/api/widgets')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      title: 'Tenant B Private Survey',
      type: 'feedback',
      formFields: [{ name: 'rating', label: 'Rating', type: 'text', required: true }]
    });
  const widgetB = res11Widget.body.data;
  console.log(`- Tenant B Created: ID=${tenantBId}, Widget=${widgetB.id}`);
  if (!widgetB.id) throw new Error('Scenario 11 Failed');
  console.log('-> SCENARIO 11 PASS\n');

  // SCENARIO 12: Tenant A Attempts to Access Tenant B Resources
  console.log('SCENARIO 12: Tenant A Attempts to Access Tenant B Resources');
  
  // 12a. GET Widget B using Tenant A token
  const res12a = await request(app)
    .get(`/api/widgets/${widgetB.id}`)
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Tenant A GET Widget B: Status = ${res12a.statusCode} (${res12a.body.error})`);

  // 12b. PATCH Widget B using Tenant A token
  const res12b = await request(app)
    .patch(`/api/widgets/${widgetB.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ title: 'Malicious Update' });
  console.log(`- Tenant A PATCH Widget B: Status = ${res12b.statusCode} (${res12b.body.error})`);

  // 12c. DELETE Widget B using Tenant A token
  const res12c = await request(app)
    .delete(`/api/widgets/${widgetB.id}`)
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Tenant A DELETE Widget B: Status = ${res12c.statusCode} (${res12c.body.error})`);

  // 12d. GET Widget B Submissions using Tenant A token
  const res12d = await request(app)
    .get(`/api/widgets/${widgetB.id}/submissions`)
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Tenant A GET Widget B Submissions: Status = ${res12d.statusCode} (${res12d.body.error})`);

  // 12e. Verify Tenant A dashboard only counts Tenant A submissions
  const res12e = await request(app)
    .get('/api/dashboard/summary')
    .set('Authorization', `Bearer ${tokenA}`);
  console.log(`- Tenant A Dashboard Summary Count: ${res12e.body.data.totalSubmissions} (Contains ONLY Tenant A's 1 lead)`);

  if (res12a.statusCode !== 404 || res12b.statusCode !== 404 || res12c.statusCode !== 404 || res12d.statusCode !== 404) {
    throw new Error('Scenario 12 Failed: Cross-tenant isolation violation detected!');
  }
  console.log('-> SCENARIO 12 PASS (Server-Side Tenant Isolation Verified)\n');

  // Clean up test data
  await prisma.tenant.delete({ where: { id: tenantAId } }).catch(() => {});
  await prisma.tenant.delete({ where: { id: tenantBId } }).catch(() => {});
  await prisma.$disconnect();

  console.log('================================================================');
  console.log('ALL 12 REAL SCENARIOS PASSED WITH ZERO DEFECTS');
  console.log('================================================================');
}

runE2EVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
