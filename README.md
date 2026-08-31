# Multi-Tenant Lead Capture Platform

A production-ready, multi-tenant lead capture and widget delivery platform built with **Node.js**, **Express**, **PostgreSQL 17**, and **Prisma ORM**.

---

## Architecture Overview

```
                        [ Customer Website ]
                                 │
                  (Embeds /widget/v1/widget.js)
                                 │
                    [ Public Ingestion API ]
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
      [ Hardened Pipeline ]            [ Owner Dashboard ]
      - Rate Limiting (Sliding Window)  - React SPA
      - Honeypot Spam Trap             - JWT Auth
      - IP & Geo Enrichment (Fallback) - Tenant Scoped
      - Idempotency Deduplication      - Analytics
                │
                ▼
       [ PostgreSQL (Prisma) ]
       - Multi-tenant Isolation
       - Cascade Constraints
                │
                ▼
       [ Async Side Effects ]
       - Email / Webhook Queue
       - Resilient Retries
```

---

## Tech Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js 5
- **Database:** PostgreSQL 17 (Dockerized)
- **ORM:** Prisma 6.12.0
- **Authentication:** JWT (`jsonwebtoken`) & `bcryptjs`
- **Testing:** Jest & Supertest
- **Frontend:** React 18 SPA + Tailwind CSS (Embedded)

---

## Key Features

1. **Strict Server-Side Tenant Isolation:**
   - Multi-tenant data model with `Tenant`, `User`, `Widget`, and `Submission`.
   - All authenticated queries are strictly scoped by `tenantId` in the Prisma data layer.
   - Cross-tenant resource queries return `404 Not Found` to prevent ID enumeration.

2. **Hardened Public Submission Pipeline:**
   - Rate limiting per IP (sliding window) returning `429 Too Many Requests`.
   - Honeypot field (`_hp`) bot trap tagging spam without alerting attackers.
   - Geolocation enrichment with primary (`ip-api.com`) $\rightarrow$ secondary (`ipapi.co`) provider fallback and graceful degradation to `null` location on failure.
   - Payload size boundary protection (50kb limit) and client IP extraction behind reverse proxies.
   - Idempotency deduplication via `X-Idempotency-Key` or hashed payloads.
   - Durable PostgreSQL persistence before acknowledging client (`201 Created`).

3. **Resilient Background Side Effects:**
   - Off-the-critical-path background task queue for email confirmations and webhooks.
   - Automatic exponential retry logic (3 attempts).
   - Side effect failures never compromise database persistence.

4. **Versioned Embeddable Widget Delivery:**
   - Versioned asset route: `/widget/v1/widget.js` (and `/widget.v1.js`).
   - Immutable cache headers (`public, max-age=31536000, immutable`).
   - Public configuration endpoint (`GET /widgets/:id/config`) with short-term cache headers (`max-age=300`) and stripped `tenantId`.
   - Standalone customer test page (`/test-customer-site.html`).

5. **Owner Dashboard:**
   - Single-Page Application at `/dashboard/index.html`.
   - Organization overview, lead conversion metrics, country breakdown, widget creator with embed snippets, and live submission logs.

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Docker & Docker Compose (or local PostgreSQL 17 instance)

### 1. Environment Setup

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lead_capture?schema=public"
JWT_SECRET="lead-capture-super-secret-jwt-key-2026"
JWT_EXPIRES_IN="7d"
MAX_PAYLOAD_SIZE="50kb"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

### 2. Database Initialization

Start the PostgreSQL 17 container:

```bash
docker run --name lead-capture-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lead_capture -p 5432:5432 -d postgres:17
```

Apply Prisma database migrations:

```bash
npx prisma migrate dev --name init
```

### 3. Start Application

Development server (with hot-reload):
```bash
npm run dev
```

Production server:
```bash
npm start
```

---

## API Reference

### Health Check
- `GET /api/health` — Probes PostgreSQL connectivity and server uptime.

### Public Ingestion & Widget Delivery
- `GET /widgets/:id/config` — Fetches public widget form schema.
- `GET /widget/v1/widget.js` — Serves embeddable JavaScript bundle with immutable caching.
- `POST /api/widgets/:id/submissions` — Ingests lead submissions with validation, rate limiting, and spam filtering.

### Owner Authentication
- `POST /api/auth/register` — Registers new organization tenant and owner user.
- `POST /api/auth/login` — Authenticates user and returns JWT bearer token.
- `GET /api/auth/me` — Returns authenticated user profile (requires `Bearer <TOKEN>`).

### Widget Management (Protected)
- `GET /api/widgets` — Lists caller tenant's widgets.
- `POST /api/widgets` — Creates a new widget and generates embed snippet.
- `GET /api/widgets/:id` — Gets a single widget.
- `PATCH /api/widgets/:id` — Updates widget settings.
- `DELETE /api/widgets/:id` — Deletes widget and cascades submissions.

### Dashboard Analytics (Protected)
- `GET /api/dashboard/summary` — Returns aggregate counts and country breakdown.
- `GET /api/widgets/:id/submissions` — Returns submission feed for a specific widget.
- `GET /api/widgets/:id/stats` — Returns per-widget conversion stats.

---

## Testing & Quality Assurance

Run the automated test suite (36 tests across 4 suites):
```bash
npm test
```

Run tests with open handle detection:
```bash
npx jest --runInBand --detectOpenHandles
```

Run the live 12-scenario end-to-end QA audit against PostgreSQL:
```bash
node scripts/finalQAAudit.js
```

---

## License

ISC