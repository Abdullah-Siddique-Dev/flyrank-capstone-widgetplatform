# API.md

> API surface for the platform, grouped by the three request paths (Owner, Delivery, Public submission) plus dashboard.
> The brief specifies *behavior* (auth required or not, status codes, caching, CORS) very precisely, but does not specify exact routes, request/response JSON shapes, or the auth mechanism. Every such detail below is marked **📌 Proposed implementation decision** — the behavioral requirement next to it is what's actually graded.

---

## 1. Authentication Endpoints

📌 **Proposed in full** — the brief requires "an authenticated admin API" but never specifies login mechanics, so the team must choose one. Proposed below: email/password with a session or JWT token (📌 pick one during Phase 1 design).

| Endpoint | 📌 `POST /auth/register` |
|---|---|
| Purpose | Create a Widget Owner account (and its Tenant, per DATABASE.md Option B) or attach a User to an existing Tenant (Option A). |
| Auth | None (public) |
| Request | 📌 `{ "email": string, "password": string }` |
| Response | 📌 `201` with `{ "id", "email" }` (never return password/hash) |
| Errors | `400` invalid/missing fields; `409` email already registered |

| Endpoint | 📌 `POST /auth/login` |
|---|---|
| Purpose | Authenticate a Widget Owner and issue a session/token. |
| Auth | None (public) |
| Request | 📌 `{ "email": string, "password": string }` |
| Response | 📌 `200` with a session cookie or `{ "token": string }` |
| Errors | `401` invalid credentials |

All endpoints under §2 (Widget management) and §5 (Dashboard) require this credential; unauthenticated requests to them must be rejected — this rejection behavior is explicit in the brief.

## 2. Widget Management Endpoints

Explicit requirement: full CRUD, authenticated, tenant-isolated, correct status codes.

| Endpoint | 📌 `POST /widgets` |
|---|---|
| Purpose | Create a widget for the authenticated owner's tenant. |
| Auth | Required |
| Request | 📌 `{ "type", "title", "description", "form_fields": [...], "button_text", "display_options": {...} }` |
| Response | `201` with the created widget, including its generated embed snippet (`<script src="...widget.js?id=...">`) |
| Errors | `400` invalid payload; `401` unauthenticated |

| Endpoint | 📌 `GET /widgets` |
|---|---|
| Purpose | List all widgets belonging to the authenticated owner's tenant only. |
| Auth | Required |
| Request | — (optional 📌 pagination query params) |
| Response | `200` with an array of widgets scoped to the caller's tenant |
| Errors | `401` unauthenticated |

| Endpoint | 📌 `GET /widgets/:id` |
|---|---|
| Purpose | Fetch a single widget owned by the caller's tenant. |
| Auth | Required |
| Response | `200` with the widget |
| Errors | `401` unauthenticated; `404` if the widget doesn't exist **or** belongs to another tenant — this is the explicit tenant-isolation behavior: a foreign widget must look identical to a nonexistent one, never a `403` that confirms it exists. 📌 *Choosing 404-over-403 here is a proposed decision to avoid leaking existence across tenants.* |

| Endpoint | 📌 `PATCH /widgets/:id` |
|---|---|
| Purpose | Update a widget's fields owned by the caller's tenant. |
| Auth | Required |
| Request | 📌 partial widget fields |
| Response | `200` with the updated widget |
| Errors | `400` invalid payload; `401` unauthenticated; `404` not found / not owned |

| Endpoint | 📌 `DELETE /widgets/:id` |
|---|---|
| Purpose | Delete a widget owned by the caller's tenant. |
| Auth | Required |
| Response | `204` on success |
| Errors | `401` unauthenticated; `404` not found / not owned |

## 3. Widget Delivery Endpoints (Public)

Explicit requirements: public, cacheable, CORS-enabled, small payloads, versioned script.

| Endpoint | 📌 `GET /widget.js?id={widgetId}` |
|---|---|
| Purpose | Serve the embeddable widget JavaScript bundle that renders the form and wires up submission. |
| Auth | None — public, cross-origin |
| Request | Query param: widget ID |
| Response | `200`, `application/javascript`, with a long-lived `Cache-Control` (e.g. `max-age` in the hundreds of thousands of seconds) since the bundle is versioned — new content ships under a new URL/cache-bust rather than mutating the same URL. 📌 *Exact max-age and versioning scheme (query hash vs. path segment) is a proposed decision.* |
| Errors | `404` if the widget doesn't exist (widget ID is public information here, since it's embedded in a public `<script>` tag — this is not a tenant-isolation violation) |

| Endpoint | 📌 `GET /widgets/:id/config` |
|---|---|
| Purpose | Serve the widget's public configuration (fields, title, button text, display options) so the script can render the form. |
| Auth | None — public, cross-origin |
| Request | Path param: widget ID |
| Response | `200`, small JSON payload, with a **short-lived** `Cache-Control` (config can change more often than the script) |
| Errors | `404` widget not found |
| CORS | Must allow any origin to fetch this (it's meant to be embedded anywhere) — must correctly answer `OPTIONS` preflight |

## 4. Submission Endpoint (Public)

The hardest and most explicitly specified path in the brief.

| Endpoint | 📌 `POST /widgets/:id/submissions` (or `POST /submissions` with widget ID in the body — 📌 proposed, pick one) |
|---|---|
| Purpose | Accept a visitor's filled-in form from any origin, validate it, protect against abuse, enrich it, store it, and trigger a safe side effect. |
| Auth | None — public, cross-origin (this is the "client is the entire internet" endpoint) |
| Request | 📌 `{ "answers": { ...form field values }, "honeypot_field_name": "" }` — the honeypot field name/shape is a proposed decision |
| Response | `2xx` on success, once the row is stored (independent of enrichment/side-effect outcome) |
| Errors (all explicit behaviors from the brief) | `400` malformed or invalid fields, with a clean JSON error body — never a `500`; `413`/`400` oversized payload; `429` when the caller has exceeded the rate limit (per-IP and/or per-widget); a tripped honeypot results in either a silent success-looking response or a rejection — 📌 *which of the two is a proposed decision, but it must not reveal to the bot that it was detected*; `404` if the widget doesn't exist |
| CORS | Must accept cross-origin `POST` with correct preflight (`OPTIONS`) handling |
| Side effects | After the row is stored, a confirmation email/webhook is attempted; its failure must never change the response already promised to the visitor |

## 5. Dashboard Endpoints (Authenticated)

Explicit requirement: owner views submissions with basic analytics — counts over time, per-widget stats, geo breakdown.

| Endpoint | 📌 `GET /dashboard/summary` |
|---|---|
| Purpose | Aggregate counts across all of the tenant's widgets (e.g. total submissions, submissions over time). |
| Auth | Required |
| Response | `200` with 📌 `{ "total_submissions", "submissions_over_time": [...] }` — exact shape proposed |
| Errors | `401` unauthenticated |

| Endpoint | 📌 `GET /widgets/:id/submissions` |
|---|---|
| Purpose | List raw submissions for one widget owned by the caller's tenant, e.g. for a simple table view. |
| Auth | Required |
| Response | `200` with an array of submissions, tenant/ownership-checked |
| Errors | `401` unauthenticated; `404` not found / not owned |

| Endpoint | 📌 `GET /widgets/:id/stats` |
|---|---|
| Purpose | Per-widget analytics, including geo breakdown. |
| Auth | Required |
| Response | `200` with 📌 `{ "submission_count", "geo_breakdown": [{ "country", "count" }, ...] }` — exact shape proposed |
| Errors | `401` unauthenticated; `404` not found / not owned |

---

## Summary of what's explicit vs. proposed

- **Explicit (graded) behaviors**: which endpoints require auth vs. are public; that widget CRUD is tenant-isolated; that config/script delivery is cached and versioned; that the submission endpoint runs through CORS → validation → size check → rate limit → spam check → enrichment (with fallback) → store → side effect, in that order, with failures degrading gracefully; that the dashboard exposes counts over time, per-widget stats, and geo breakdown.
- **Proposed (team's implementation choice)**: exact route paths, JSON field names/shapes, the auth mechanism, exact cache `max-age` values, and the precise honeypot-rejection behavior. These should be confirmed and locked down during the Phase 1 design step, then treated as the real contract for implementation.
