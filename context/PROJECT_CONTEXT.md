# PROJECT_CONTEXT.md

> Source of truth for *what* this project is and *why* it exists.
> Primary sources: FlyRank Capstone Brief ("Embeddable Widget & Lead-Capture Platform") and the team's "Understanding the Capstone" document.
> Anything not explicitly stated in those sources is marked **📌 Proposed decision** and is open for the team to confirm or change.

---

## 1. Project Purpose

Build a platform that lets a customer ("Widget Owner") create an embeddable widget (e.g. a signup form), receive a single `<script>` tag, and paste it into any website — regardless of who hosts that website or what server it runs on. When a visitor on that external site submits the widget's form, the submission must travel across the open internet back to our backend, where it is safely validated, protected from abuse, enriched with location data, stored, and made visible to the owner in a dashboard.

In one sentence (from the source docs): **We are not building a form. We are building a service that safely hands out forms to websites we do not control, and safely catches whatever comes back.**

## 2. Problem Being Solved

Unlike a typical private/internal project, this system receives requests directly from browsers we don't control, on origins we don't control, from users we cannot vet. The core problem the capstone is designed to teach is:

> **How do you build an API that survives being exposed to the public internet?**

Concretely, this means we cannot trust: the origin of a request, the shape or size of the payload, the rate at which requests arrive, or the intent (human vs. bot) behind a submission.

## 3. Actors

| Actor | Description |
|---|---|
| **Widget Owner** | Our customer (e.g. a restaurant owner, SaaS founder, marketing agency). Logs into the platform (authenticated), creates/manages widgets, and views their own dashboard. |
| **Customer Website** | The Widget Owner's own website, running on an origin different from our API (e.g. a different port or domain). It loads our embed script and renders the widget. |
| **Website Visitor** | An anonymous end user browsing the Customer Website who fills in and submits the widget's form. This is the actor we cannot trust or authenticate. |

## 4. Core Concepts

These are the seven ideas the capstone is built to teach, plus the supporting patterns explicitly named in the source docs:

- **Authentication** — protecting the widget-management and dashboard APIs.
- **Multi-tenancy / Tenant isolation** — one customer (tenant) must never see or modify another tenant's widgets or submissions, even via guessed/modified IDs.
- **CORS** — explicitly allowing cross-origin browsers to call our public endpoints, including handling preflight (`OPTIONS`) requests.
- **Validation at the boundary** — every incoming field is validated before touching business logic; bad input returns a clean 4xx, never a 500.
- **Rate limiting** — per-IP and/or per-widget request limits; floods return `429` while legitimate traffic keeps flowing.
- **Spam protection** — at least one technique (e.g. honeypot field) to catch bots that stay under the rate limit.
- **Caching** — the widget script and config are served with correct `Cache-Control` headers; the script is versioned so it can be cached long-term.
- **Enrichment with a fallback chain** — IP → geolocation via Provider A, falling back to Provider B on failure.
- **Graceful degradation** — if all geo providers fail, the submission is still stored, just without location data.
- **Safe side effects** — a failing confirmation email/webhook must never prevent the submission from being stored or the visitor from getting a success response.

## 5. Functional Requirements

Grouped as in the brief (Section 6/8), each is a pass/fail acceptance item:

**Widget management**
- Authenticated CRUD endpoints for widgets; unauthenticated requests are rejected.
- Multi-tenant isolation proven — tenant A cannot read or modify tenant B's widgets or submissions.

**Widget delivery**
- Embed snippet generated per widget.
- Public config endpoint serves a small payload with correct HTTP cache headers.
- Widget JavaScript served as a versioned bundle (new version → new URL or cache-bust).
- Widget renders correctly on a page served from a different origin than the API.

**Public submission API**
- Cross-origin submissions work: correct CORS headers, preflight (`OPTIONS`) handled.
- All incoming input validated; malformed/oversized payloads rejected with an appropriate 4xx and a JSON error body.
- Valid submissions stored safely, linked to the correct widget and tenant.

**Abuse protection**
- Rate limiting (per IP and/or per widget) returns `429` under burst load, while the API keeps serving legitimate traffic.
- At least one spam-prevention technique (honeypot, token, or heuristic) demonstrably blocks a spam submission.

**Enrichment & safe side effects**
- IP→geo enrichment uses a provider fallback chain (Provider A → Provider B).
- If all providers are down, the submission still succeeds, without geo data.
- A failing confirmation email/webhook does not prevent the submission from being stored.

**Dashboard**
- Authenticated owner can view submission counts over time, per-widget stats, and a geo breakdown.

**Documentation**
- README with architecture diagram, setup instructions, and API documentation, plus all required repo files (see Section 11 of the brief: `README.md`, `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, `.env.example`).

## 6. Non-Functional Requirements

These are the "shared requirements" every capstone in the track must demonstrate, plus resilience expectations specific to this project:

1. **Layered architecture** — data / business logic / HTTP layers kept separate.
2. **Validation at the boundary** — bad input never reaches business logic or causes a 500.
3. **At least one background job** — slow or bulk work taken off the request path, with retries and a failure alert. 📌 *Which operation becomes the background job (e.g. geo enrichment, or the email/webhook side effect) is a proposed decision — the brief does not name one specifically.*
4. **Real persistence** — schema managed as migrations, correct indexes, isolated tenants.
5. **Idempotency where it matters** — a retried action happens once. 📌 *Exactly where idempotency is enforced (e.g. submission endpoint under retry) is a proposed decision.*
6. **Secrets kept clean** — configuration only via environment variables, never logged, never committed.
7. **AI usage cost tracked** — if AI tools are used to build, cost/attribution is logged (per the brief's `BUILDLOG.md` requirement).
8. **Resilience / graceful degradation** — every non-critical dependency (geo providers, email/webhook) must be able to fail without failing the primary request.
9. **Performance** — widget delivery must be fast and cache-friendly ("a widget that loads slowly is a widget customers remove").

## 7. Tech Stack

As decided in the team's "Understanding the Capstone" document (this is the team's stated choice, not an open proposal):

| Layer | Choice |
|---|---|
| Backend runtime/framework | Node.js + Express |
| Database | PostgreSQL |
| Containerization | Docker |
| Test "customer website" | Plain HTML file on a second local port |
| Geo Provider A | ip-api.com (no key, ~45 req/min free) |
| Geo Provider B (fallback) | ipapi.co (no key, ~1,000 lookups/day free) |
| Email/webhook side effect | Console log, or Mailpit (local mail catcher) |
| Repo/CI | GitHub (public repo) |
| Hosting | None required — runs locally |

This choice fits the team's existing MERN/JavaScript background, and satisfies the brief's "$0, no credit card" constraint end-to-end.

## 8. Scope and Non-Goals

**In scope** (explicitly, from the brief and understanding doc):
- One or two widget types are sufficient to prove the pattern.
- A minimal widget UI (a div with a form and submit button) — grading is on backend behavior.
- The "customer site" is a plain HTML file on a different local origin — no real hosting/CDN/domain needed.
- Fake email (console log or Mailpit) — only the failure-tolerance behavior is graded.
- Mocked geo providers when *proving* the fallback chain (deterministic), while real free APIs may be used in normal development.

**Explicit non-goals** (Section 14 of the understanding doc / Section 7 of the brief):
- No real CDN, domain name, or paid cloud hosting.
- No polished, fancy front-end design.
- No complex drag-and-drop form builder.
- No wide range of widget types.
- No production-grade email infrastructure.

📌 *The brief requires the team to write down "one explicit non-goal" as part of the Phase 1 design doc — this list captures the non-goals already named in the source material, but the team should still record its own single chosen non-goal statement per the brief's Phase 1 gate.*

## 9. Important Project Constraints

- **$0, no credit card, ever.** Every tool used must have a genuinely free tier with no card required. If a tool ever asks for a card, that's a wrong turn.
- **One dedicated, public GitHub repository**, created from day one — never mixed into another repo.
- **Self-paced, no deadlines** — but work should proceed through the three phases in order (Design → Hardened submission path → Delivery/Dashboard/Proof).
- **No secrets ever committed.** `.env` is git-ignored from the first commit; a `.env.example` with placeholder values is committed instead.
- **AI-assisted building is allowed but must be owned** — `BUILDLOG.md` must honestly record where AI helped, where it was wrong, and what was changed. The author must be able to explain any 2–3 lines an evaluator points to.
- **Deterministic fallback proof required** — the geo-provider fallback chain must be provable via a mockable/toggleable provider, not only via the real live APIs.
- **Required repo files at submission**: `README.md`, `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, `.env.example`.
- **Evaluation is two-layered**: (1) a machine-checkable submission pack (required files + a working `run:` command), and (2) six behavioral acceptance probes run against the live system (see ARCHITECTURE.md for the probe list).
