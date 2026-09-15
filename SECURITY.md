# Security Policy

## Reporting a vulnerability

This is a demonstration project seeded with synthetic data only — it holds
no real guest, payment, or organizational data. If you still find a
security issue in the code (an injection vector, an access-control gap, a
cryptographic mistake), please open a private report via GitHub's
["Report a vulnerability"](../../security/advisories/new) flow on this
repository rather than a public issue, so any fix can land before the
details are public.

## Scope and known trade-offs

- **Payments**: the bundled `MockPaymentProvider` is a local stand-in for a
  real gateway. No card number or CVV is ever accepted, transmitted, or
  stored anywhere in this codebase — only provider references and the
  card brand/last four digits returned by a (mocked) capture event.
- **Secrets**: `.env.example` lists every configuration value the app
  reads. Nothing in `.env.example` is a usable credential; real deployments
  must generate their own secrets (see the comments in that file).
- **Demo data**: `apps/api/prisma/seed.ts` creates only fictional
  organizations, hotels, and guests under `@example.com` addresses.

## Reporting non-security bugs

Please use the normal GitHub Issues tracker for anything that isn't a
security concern.
