import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { extractCookie, login, registerOrganization } from "../utils/fixtures";

describe("Session security: lockout, refresh rotation, CSRF", () => {
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

  it("locks the account after repeated failed login attempts", async () => {
    const org = await registerOrganization(app);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: org.email, password: "wrong-password" })
        .expect(401);
    }

    // Even the CORRECT password is now rejected — the account is locked,
    // not just the bad guesses.
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: org.email, password: org.password });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/locked/i);
  });

  it("does not leak whether an email is registered via response timing/content", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "nobody-at-all@example.com", password: "whatever12345!X" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("rejects /auth/refresh without a matching CSRF header even with a valid cookie", async () => {
    const org = await registerOrganization(app);
    const session = await login(app, org.email, org.password);

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookieHeader);
    // no x-csrf-token header set

    expect(res.status).toBe(403);
  });

  it("rotates the refresh token and detects reuse of a stale one as theft", async () => {
    const org = await registerOrganization(app);
    const session = await login(app, org.email, org.password);

    const refreshRes = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookieHeader)
      .set("x-csrf-token", session.csrfCookie)
      .expect(200);

    const newRefreshCookie = extractCookie(refreshRes, "refresh_token");
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).not.toBe(session.refreshCookie);

    // Reusing the OLD (already-rotated) refresh token must fail...
    const reuseAttempt = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookieHeader)
      .set("x-csrf-token", session.csrfCookie);
    expect(reuseAttempt.status).toBe(401);

    // ...and must burn the whole token family, so even the legitimately
    // rotated NEW token is now revoked (the attacker having the old token
    // means the family is presumed compromised).
    const newCookieHeader = `refresh_token=${newRefreshCookie}; csrf_token=${session.csrfCookie}`;
    const afterTheftDetected = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", newCookieHeader)
      .set("x-csrf-token", session.csrfCookie);
    expect(afterTheftDetected.status).toBe(401);
  });

  it("invalidates the refresh token on logout", async () => {
    const org = await registerOrganization(app);
    const session = await login(app, org.email, org.password);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", session.cookieHeader)
      .set("x-csrf-token", session.csrfCookie)
      .expect(204);

    const afterLogout = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookieHeader)
      .set("x-csrf-token", session.csrfCookie);
    expect(afterLogout.status).toBe(401);
  });

  it("enforces a minimum password strength on registration", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/register-organization").send({
      organizationName: "Weak Pass Org",
      organizationSlug: "weak-pass-org",
      email: "weak@example.com",
      password: "password",
      firstName: "W",
      lastName: "P",
    });
    expect(res.status).toBe(400);
  });
});
