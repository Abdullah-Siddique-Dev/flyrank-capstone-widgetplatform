# DATABASE.md

> Conceptual data model for the platform. The source documents name **Tenant**, **Widget**, and **Submission** explicitly, and state that "the exact column-by-column design still needs to be worked out in the design phase." A **User** entity is required to support authentication but is not explicitly modeled in the source docs — its shape below is a proposed decision.
> 📌 marks every attribute/column and every relationship detail not explicitly stated in the source material.

---

## 1. Tenant

**What the source says:** "A Tenant owns many Widgets" — the tenant is the customer/organization boundary that all isolation rules are built around.

| Field | Notes |
|---|---|
| `id` | 📌 Proposed — primary key. |
| `name` | 📌 Proposed — display name of the customer/organization. |
| `created_at` | 📌 Proposed. |
| `updated_at` | 📌 Proposed. |

📌 *The source docs do not specify further tenant attributes (e.g. billing info, plan) — none are invented here since none are required by the brief.*

## 2. User

**What the source says:** The brief requires "authenticated CRUD endpoints" and the Widget Owner "logs into our platform" — but the docs never explicitly separate the concept of a login-capable *User* from a *Tenant*. Two shapes are possible and this is left as an open design decision for the team:

- 📌 **Option A (proposed default):** `User` is a separate entity, belonging to exactly one `Tenant`, so a tenant could in principle have multiple team members logging in.
- 📌 **Option B:** `User` and `Tenant` are the same row (one login = one customer account), which is simpler and matches the brief's minimal-scope guidance.

Proposed attributes (if Option A is taken):

| Field | Notes |
|---|---|
| `id` | 📌 Proposed — primary key. |
| `tenant_id` | 📌 Proposed — foreign key to Tenant. |
| `email` | 📌 Proposed — login identifier. |
| `password_hash` | 📌 Proposed — never store plaintext; ties to the "secrets clean" non-functional requirement. |
| `created_at` | 📌 Proposed. |

## 3. Widget

**What the source says (explicit):** "Its own id, and which tenant (customer) owns it; Type, title, description; Form fields and button text; Display options; When it was created and last updated."

| Field | Source status |
|---|---|
| `id` | Explicit (source: "its own id") |
| `tenant_id` | Explicit (source: "which tenant owns it") |
| `type` | Explicit (e.g. signup form / CTA / popover) |
| `title` | Explicit |
| `description` | Explicit |
| `form_fields` | Explicit (source: "form fields") — 📌 storage shape (JSON column vs. normalized table) is a proposed decision |
| `button_text` | Explicit |
| `display_options` | Explicit — 📌 storage shape is a proposed decision |
| `created_at` | Explicit |
| `updated_at` | Explicit |

## 4. Submission

**What the source says (explicit):** "Its own id, and which widget and tenant it belongs to; The visitor's submitted answers (name, email, etc.); The visitor's IP address, country, and city; When it was submitted."

| Field | Source status |
|---|---|
| `id` | Explicit |
| `widget_id` | Explicit |
| `tenant_id` | Explicit (denormalized from widget, for direct tenant-scoped queries — 📌 proposed rationale, but the field itself is explicit) |
| `answers` | Explicit (source: "submitted answers") — 📌 storage shape (JSON column vs. normalized key/value table) is a proposed decision |
| `ip_address` | Explicit |
| `country` | Explicit |
| `city` | Explicit |
| `submitted_at` | Explicit |

📌 *Not stated in the source docs but likely needed for the abuse-protection requirements: a spam/honeypot flag and/or rate-limit bookkeeping. Whether this lives on the Submission row itself, or in a separate table/cache (e.g. for rate-limit counters), is a proposed decision left open for the design phase.*

## 5. Relationships

Explicit, from the source docs:

- **Tenant → Widget**: one Tenant owns many Widgets (1-to-many).
- **Widget → Submission**: one Widget can receive many Submissions (1-to-many).

Proposed (if User is modeled separately):

- 📌 **Tenant → User**: one Tenant has many Users (1-to-many).

```
Tenant (1) ───< (N) Widget (1) ───< (N) Submission
   │
   └──< (N) User   📌 proposed, if Users are modeled separately from Tenants
```

## 6. Tenant Isolation Rules

Explicit from the source docs — this is called out as a requirement to be *proven*, not just designed for:

- One tenant must never be able to **read or modify** another tenant's widgets or submissions, even by guessing or manually changing an ID in a request.
- Every query against `Widget` or `Submission` must be scoped by the authenticated caller's `tenant_id` at the data-access layer — not merely filtered in application code after the fact, and never left to the UI to enforce.
- Public, unauthenticated endpoints (widget config delivery, submission intake) are the one exception: they are looked up by widget ID without requiring the caller to be the owning tenant, since visitors and customer websites are not tenant-authenticated. The tenant scoping there matters on the *write* side (a submission must be correctly attributed to the right widget/tenant), not the read side.

## 7. Important Database Constraints

From the brief's shared cross-capstone requirements and the capstone's own emphasis:

- **Real persistence** — PostgreSQL, with schema managed as migrations (not ad hoc/manual DDL).
- **Correct indexes** — at minimum, foreign keys (`Widget.tenant_id`, `Submission.widget_id`, `Submission.tenant_id`) should be indexed to support tenant-scoped and per-widget queries efficiently, since the dashboard requires aggregation (counts over time, per-widget stats, geo breakdown). 📌 *Exact index list is a proposed decision, to be finalized once query patterns are confirmed.*
- **Isolated tenants** enforced at the schema/query level, per §6 above.
- **No secrets in the database or logs** — e.g. `password_hash` only, never plaintext passwords; connection strings/API keys live in environment variables, not in seed data or migrations.
- **Idempotency where it matters** — 📌 proposed: a uniqueness constraint or idempotency-key column on `Submission` if duplicate-submission prevention is implemented, per the shared cross-capstone requirement.
