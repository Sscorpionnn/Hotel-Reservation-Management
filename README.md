# Aurora HRMS — Hotel & Reservation Management Platform

A production-shaped hotel operations platform: hotel/room/rate inventory,
availability search, a concurrency-safe reservation engine, payment-intent
metadata (no card data ever touches this system), guest management,
housekeeping, promotions, reporting, and an audit trail — all behind a
role-based, multi-tenant API with a Next.js operations dashboard on top.

All data in this repository (seed data, test fixtures) is synthetic. No
real guest, payment, or credential data is used anywhere.

## Stack

| Layer          | Choice                                             |
| -------------- | --------------------------------------------------- |
| API            | NestJS 10 + TypeScript, Prisma ORM                  |
| Database       | PostgreSQL 16                                       |
| Queues         | BullMQ on Redis 7 (hold-expiry, notifications)      |
| Realtime       | Socket.IO (availability-changed push)                |
| Web            | Next.js 16 (App Router) + React 19 + Tailwind CSS    |
| Auth           | JWT access tokens + rotating httpOnly refresh cookies |
| Payments       | Provider-abstraction interface; bundled mock provider |
| Testing        | Jest + Supertest (unit + e2e), Playwright (browser e2e) |
| CI/CD          | GitHub Actions (lint, typecheck, tests, build, Docker build, `pnpm audit`, gitleaks) |
| Containers     | Multi-stage Dockerfiles per app + `docker-compose.yml` |

## Why this architecture — the two decisions that mattered most

**Double-booking is prevented by the database, not application code.**
Every booked room-night is one row in `reservation_nights`, and a partial
unique index — `UNIQUE (room_id, stay_date) WHERE released_at IS NULL`
(see `apps/api/prisma/migrations/20260915190500_reservation_night_partial_unique/`)
— makes it physically impossible for two active reservations to hold the
same room on the same night, regardless of how many requests race for it
concurrently or how many API instances are running. The application layer
(`ReservationsService.createHold`) just tries candidate rooms inside a
transaction and treats a unique-constraint violation as "try the next
room" — see `apps/api/test/reservations/double-booking.e2e-spec.ts` for a
test that fires 20 concurrent hold requests at a single room and asserts
exactly one succeeds, against a real Postgres instance.

**Reservation state transitions are atomic compare-and-swap, not
read-then-write.** Every transition (`HELD → CONFIRMED`, `CONFIRMED →
CHECKED_IN`, etc.) is a single `UPDATE ... WHERE id = ? AND status =
<expected>` — Postgres' own row lock makes this race-safe without needing
SERIALIZABLE isolation or app-level locking. A losing concurrent request
gets 0 affected rows and a 409, deterministically, instead of silently
clobbering another request's change. The legal transition table lives in
`apps/api/src/reservations/reservation-state-machine.ts`.

## Local development

Requirements: Node 20+, pnpm 9, Docker (for Postgres/Redis).

```bash
pnpm install

# Postgres (dev + a separate test DB) and Redis, on non-default host ports
# to avoid clashing with anything else you have running locally:
docker compose -f docker-compose.dev.yml up -d

cp .env.example .env
# then fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / COOKIE_SECRET /
# PAYMENT_WEBHOOK_SECRET with your own random values (see the comments in
# .env.example), and point DATABASE_URL at the port docker-compose.dev.yml
# published for `postgres`.
cp .env apps/api/.env

pnpm --filter @hrms/api prisma:generate
pnpm --filter @hrms/api prisma:migrate   # applies migrations (prisma migrate deploy)
pnpm --filter @hrms/api prisma:seed      # optional: synthetic demo org/hotel/rooms

pnpm dev:api   # NestJS on :3001, Swagger docs at /api/docs outside production
pnpm dev:web   # Next.js on :3000
```

Demo login after seeding (see `apps/api/prisma/seed.ts`):
`org.admin@example.com` / `Demo-Password-123!`.

## Testing

```bash
# API unit tests (pure logic — state machine, webhook signature verification)
pnpm --filter @hrms/api test

# API e2e tests (real Postgres + Redis; run against the dedicated test DB
# docker-compose.dev.yml starts on a separate port) — covers double-booking
# concurrency, the full reservation lifecycle, idempotency, payment webhook
# signature/replay/timestamp validation, tenant isolation (IDOR), RBAC and
# privilege-escalation attempts, SQL/XSS injection resistance, and rate
# limiting:
pnpm --filter @hrms/api test:e2e

# Browser e2e (Playwright drives the real Next.js + NestJS stack end to
# end): register an org, build out a hotel's inventory, search
# availability, book, and walk a reservation through its full lifecycle —
# plus a two-browser-tab race proving the UI surfaces "Sold out" instead
# of double-booking.
pnpm --filter @hrms/web test:e2e
```

## Security controls (and where they're tested)

| Control | Where |
| --- | --- |
| Password hashing (argon2id), account lockout after 5 failed attempts, timing-safe "user not found" | `apps/api/src/auth/auth.service.ts`, `test/security/auth-session.e2e-spec.ts` |
| Refresh-token rotation with reuse (theft) detection — a replayed old token burns the whole session family | `auth.service.ts`, `test/security/auth-session.e2e-spec.ts` |
| CSRF protection (double-submit cookie) on the two cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`) | `common/guards/csrf.guard.ts` |
| Tenant isolation — every query scoped by the caller's `organizationId`; cross-tenant access returns 404, never 403 (no existence leak) | every `*.service.ts`, `test/security/tenant-isolation.e2e-spec.ts` |
| RBAC with an explicit assignable-role allow-list (`SUPER_ADMIN` is never settable through the API) and per-hotel scoping for hotel-assigned staff | `common/guards/roles.guard.ts`, `common/guards/hotel-scope.guard.ts`, `test/security/rbac.e2e-spec.ts` |
| Rate limiting, tracked by authenticated user id (falls back to IP for anonymous routes like login) | `common/guards/app-throttler.guard.ts`, `test/security/injection-and-abuse.e2e-spec.ts` |
| Payment webhook signature verification (HMAC-SHA256), timestamp-window replay protection, and idempotent event processing | `payments/providers/mock-payment.provider.ts`, `payments/payments.service.ts`, `test/payments/webhook-security.e2e-spec.ts` |
| SQL injection resistance (Prisma parameterizes every query; no string-built SQL anywhere in app code) | `test/security/injection-and-abuse.e2e-spec.ts` |
| Strict input validation (`whitelist` + `forbidNonWhitelisted`) — unknown/extra fields on any write are rejected, closing off mass-assignment | global `ValidationPipe` in `src/bootstrap.ts` |
| No card data ever stored — only provider references + card brand/last 4 | `prisma/schema.prisma` (`PaymentIntent`), `SECURITY.md` |
| Security headers (CSP, no X-Frame-Options embedding, etc.) | `src/bootstrap.ts` (API), `apps/web/next.config.ts` (web) |

## Repository layout

```
apps/
  api/                NestJS API (one module per domain area)
    prisma/           schema.prisma + migrations + seed script
    src/
      reservations/    the concurrency-critical booking engine
      payments/        provider abstraction + webhook verification
      common/          guards, decorators, tenant context, exception filter
      .../             one folder per domain module (hotels, rooms, guests, …)
    test/              Supertest e2e specs (security-focused suites under test/security/)
  web/                 Next.js operations dashboard
    src/app/(dashboard)/  one folder per feature area
    e2e/               Playwright specs
packages/
  shared/              types shared between api and web (enums, formatCents, …)
docker-compose.yml       production-shaped stack (build both apps + Postgres + Redis)
docker-compose.dev.yml   just Postgres (dev + test) + Redis, for local `pnpm dev:*`
.github/workflows/ci.yml  lint, typecheck, unit+e2e tests, both builds, Docker builds, audit, secret scan
```

## Deploying with Docker Compose

```bash
cp .env.example .env   # fill in real secrets — see the comments in the file
docker compose up -d --build
docker compose exec api sh -c "cd /workspace/apps/api && node_modules/.bin/prisma migrate deploy"
```

`docker-compose.yml` publishes Postgres on `5432` and Redis on `6379` by
default; if you already have something on those ports locally, add a
`docker-compose.override.yml` remapping them (Compose merges it in
automatically) rather than editing the base file.
