// Runs before the Jest test framework is installed (jest "setupFiles"),
// so every value here is in place before AppModule/ConfigModule ever
// reads process.env. Points at the dedicated hrms_test database and
// a separate Redis logical DB so e2e runs never touch dev data.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://hrms_app:changeme@localhost:5433/hrms_test?schema=public";
process.env.REDIS_URL ??= "redis://localhost:6379/2";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-do-not-use-in-production-aaaaaaaaaaaaaaaa";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-do-not-use-in-production-bbbbbbbbbbbbbbbb";
process.env.JWT_ACCESS_TTL ??= "15m";
process.env.JWT_REFRESH_TTL ??= "7d";
process.env.COOKIE_SECRET ??= "test-cookie-secret-cccccccccccccccccccccc";
process.env.PAYMENT_PROVIDER ??= "mock";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret-dddddddddddddddddddddd";
process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS ??= "300";
process.env.THROTTLE_TTL ??= "60";
process.env.THROTTLE_LIMIT ??= "1000";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
// Off by default so unrelated specs aren't tripped by production-tight
// per-route limits (e.g. 5 new orgs/min) from reusing one app/IP across
// many test cases. The rate-limit spec itself flips this on.
process.env.DISABLE_RATE_LIMITING ??= "true";
