# ARCHITECTURE.md

> Describes *how* the system is structured: the three request paths, backend responsibilities, external dependencies, and the security/resilience patterns that hold the whole thing together.
> 📌 marks anything the source docs leave open, which the team is filling in as a design decision.

---

## 1. System Architecture Overview

The system has exactly three independent request paths, one per actor. The brief and understanding doc are explicit that these should be kept conceptually separate so the code stays clean:

```
Widget Owner (authenticated)
  → Widget Management API → Widget DB (tenant-isolated) → embed snippet

Customer Website (any origin)
  <script src="widget.js?id=123">
  → GET /widgets/:id/config   (public · cached · CORS)
  → render widget

Website Visitor
  → POST /submissions          (public · CORS)
      | CORS check       — is this origin allowed?
      | validation       — bad payload? → 4xx, never 500
      | payload size check
      | rate limit       — flood? → 429, service stays up
      | spam check       — honeypot / heuristic
      | geo enrichment   — Provider A → (fails) → Provider B → (fails) → store anyway
      | store submission — critical path, must succeed
      | side effect      — email/webhook (failure must NOT block success)
      → response: success

Widget Owner (authenticated)
  → Dashboard API ← submissions + stats
```

## 2. Actors

See PROJECT_CONTEXT.md §3 for full descriptions. In short: **Widget Owner** (authenticated, manages widgets and views the dashboard), **Customer Website** (any external origin, loads the embed script), **Website Visitor** (anonymous, submits the form — the untrusted actor).

## 3. Owner Flow (Path A — Widget Management)

1. Widget Owner authenticates. 📌 *Exact auth mechanism (session vs. JWT) is a proposed decision — see API.md.*
2. Owner performs CRUD on their own widgets: type (signup form / CTA / popover), title, description, form fields, button text, display options.
3. Every read/write is scoped to the authenticated owner's tenant — **tenant isolation is enforced in the query layer, not just the UI** (see §7 below).
4. On widget creation, the system generates the one-line embed snippet:
   ```html
   <script src="https://our-platform.com/widget.js?id=abc123"></script>
   ```

## 4. Widget Delivery Flow (Path B)

1. The Customer Website loads the embed `<script>` tag.
2. The script requests the widget's public configuration (fields, title, button text) from a public, cacheable endpoint.
3. The script renders the widget on the page using that config.
4. Because many visitors may load the same widget, responses carry `Cache-Control` headers:
   - The **script bundle** is versioned (new version = new URL or cache-bust) so it can be cached long-term ("cache long, bust on release").
   - The **config** payload uses a short-lived cache, since widget settings can change more often than the script itself.
5. This path is entirely public (no auth) and must handle CORS, since the requesting page is on a different origin than the API.

## 5. Submission Flow (Path C — the hardest path)

This is the pipeline every public submission passes through before a row is stored, in order:

1. **CORS check** — is this origin allowed to call the endpoint? Preflight (`OPTIONS`) requests must be answered correctly, or the real request never arrives.
2. **Validation** — every field is checked before touching business logic. Empty required fields or malformed data (e.g. a broken email) are rejected with a clean `400`, never a `500`.
3. **Payload size check** — oversized payloads are rejected with an appropriate 4xx.
4. **Rate limiting** — requests are counted (e.g. per IP, per widget). Once a threshold is crossed, the API returns `429 Too Many Requests`. Critically, a normal visitor must still be able to submit successfully *while* an attacker is being throttled.
5. **Spam protection** — at least one technique beyond rate limiting (e.g. a honeypot field invisible to humans but often filled in by simple bots). A tripped honeypot causes the submission to be silently dropped or rejected.
6. **Geo enrichment (fallback chain)** — the visitor's IP is resolved to a country/city via Provider A (ip-api.com); if that fails, Provider B (ipapi.co) is tried. If both fail, enrichment is simply skipped.
7. **Store submission** — this is the critical-path operation. It must succeed for a real, valid, non-spam submission regardless of what happened in enrichment.
8. **Side effect** — a confirmation email or webhook is triggered *after* the row is stored. A failure here must never roll back or block the stored submission or the success response returned to the visitor.
9. **Response** — the visitor receives a success response once the row is stored (independent of the side effect's outcome).

### Golden rule (from the source docs)
> Saving the submission is the main job. Everything else — geo, email, webhook — is a nice-to-have. A failure in the nice-to-have must never break the main job.

## 6. Backend Responsibilities (Layered Architecture)

The brief's shared cross-capstone requirement is a clean layered architecture. 📌 *The exact module/folder boundaries are a proposed decision; the required separation of concerns is not.*

| Layer | Responsibility |
|---|---|
| **HTTP layer** | Routing, request parsing, CORS handling, auth middleware, rate-limit middleware, response formatting. |
| **Business logic layer** | Validation rules, spam detection, enrichment orchestration (fallback chain), side-effect triggering, dashboard aggregation. |
| **Data access layer** | All database reads/writes, tenant-scoping enforcement, migrations. |
| **Background job(s)** | At least one operation moved off the synchronous request path (per the shared cross-capstone requirement). 📌 *Which operation — e.g. the email/webhook side effect — is a proposed decision.* |

## 7. External Services

| Service | Role | Failure handling |
|---|---|---|
| **ip-api.com** (Geo Provider A) | Primary IP → geolocation lookup | On failure/timeout, fall through to Provider B |
| **ipapi.co** (Geo Provider B) | Fallback IP → geolocation lookup | On failure, submission is stored without geo data |
| **Email / webhook side effect** | Confirmation notification after a successful submission | Failure is logged but never blocks or reverses the stored submission |
| **PostgreSQL** (via Docker) | Primary data store | Required for the critical path — this is the one dependency that must succeed for a submission to be accepted |

Fallback and side-effect providers must be **mockable/toggleable** so the fallback chain and failure-tolerance behavior can be demonstrated deterministically (per the brief's testing constraint), independent of the real free APIs' live availability.

## 8. Important Security & Resilience Concepts

- **Tenant isolation** — every widget/submission query is scoped by tenant ID at the data-access layer, so no amount of ID-guessing at the HTTP layer can expose another tenant's data. This is explicitly called out as something to be *proven*, not merely assumed.
- **CORS as an explicit allow-list**, not a wildcard-everything policy for authenticated routes; the public submission/config endpoints intentionally accept cross-origin calls, while owner/dashboard endpoints should not blindly trust arbitrary origins. 📌 *Exact CORS policy per route is a proposed decision.*
- **Never trust the client** — validation happens at the boundary, before any business logic runs; this applies specifically to the public submission endpoint, since "the client is the entire internet."
- **Fail closed on abuse, fail open on non-critical dependencies** — rate limiting and spam checks should reject suspicious traffic, while geo/email failures should never reject a legitimate submission.
- **Idempotency where it matters** — protects against duplicate side effects or duplicate rows on client retries. 📌 *Implementation approach (e.g. idempotency key on submission) is a proposed decision.*
- **Secrets management** — all credentials (DB, SMTP, any API keys) live only in environment variables, never committed, never logged.
