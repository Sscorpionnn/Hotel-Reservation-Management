import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { createGuest, registerAndLogin, uniqueEmail } from "../utils/fixtures";

describe("Injection resistance and abuse controls", () => {
  let ctx: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it("treats SQL metacharacters in a search query as ordinary text (Prisma parameterizes all queries)", async () => {
    const org = await registerAndLogin(app);
    await createGuest(app, org.accessToken, { firstName: "Normal", lastName: "Guest" });

    const payload = "'; DROP TABLE guests; --";
    const res = await request(app.getHttpServer())
      .get("/api/v1/guests")
      .query({ search: payload })
      .set("Authorization", `Bearer ${org.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Prove the table is still there and usable after the attempt.
    const stillWorks = await request(app.getHttpServer())
      .get("/api/v1/guests")
      .set("Authorization", `Bearer ${org.accessToken}`)
      .expect(200);
    expect(stillWorks.body.length).toBeGreaterThan(0);
  });

  it("rejects a SQL-injection-flavored email at the DTO validation layer, before it reaches the database", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "' OR '1'='1", password: "irrelevant-password-1!" });

    expect(res.status).toBe(400);
  });

  it("stores and returns an XSS-flavored payload as inert JSON data, not markup", async () => {
    const org = await registerAndLogin(app);
    const payload = "<script>alert('xss')</script>";
    const guest = await createGuest(app, org.accessToken, {
      firstName: payload,
      email: uniqueEmail("xss-guest"),
    });

    expect(guest.firstName).toBe(payload);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/guests/${guest.id}`)
      .set("Authorization", `Bearer ${org.accessToken}`)
      .expect(200);

    // The API is a JSON endpoint: the content-type must never allow a
    // browser to sniff/execute this as HTML.
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.firstName).toBe(payload);
  });

  it("rate-limits repeated login attempts (429 after the configured burst)", async () => {
    const org = await registerAndLogin(app);

    // Every other test in this file runs with rate limiting off (see
    // test/setup-env.ts) so reusing one app/IP across many cases doesn't
    // trip production-tight limits unrelated to what each test checks.
    // This is the one spec that exists to prove throttling itself works,
    // so it flips the guard on for just its own requests.
    process.env.DISABLE_RATE_LIMITING = "false";
    try {
      const attempts = Array.from({ length: 15 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email: org.email, password: "still-wrong-1!" }),
      );
      const responses = await Promise.all(attempts);

      const throttled = responses.filter((r) => r.status === 429);
      expect(throttled.length).toBeGreaterThan(0);
    } finally {
      process.env.DISABLE_RATE_LIMITING = "true";
    }
  });

  it("rejects unknown fields on write DTOs instead of silently accepting them (mass-assignment guard)", async () => {
    const org = await registerAndLogin(app);

    const res = await request(app.getHttpServer())
      .post("/api/v1/guests")
      .set("Authorization", `Bearer ${org.accessToken}`)
      .send({
        email: uniqueEmail("mass-assign"),
        firstName: "A",
        lastName: "B",
        organizationId: "00000000-0000-0000-0000-000000000000", // not a real field on the DTO
      });

    expect(res.status).toBe(400);
  });
});
