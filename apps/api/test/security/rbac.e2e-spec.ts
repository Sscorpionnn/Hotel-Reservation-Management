import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { createHotel, registerAndLogin, uniqueEmail } from "../utils/fixtures";

describe("Role-based access control / privilege escalation", () => {
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

  async function createGuestPortalUser(orgAdmin: Awaited<ReturnType<typeof registerAndLogin>>) {
    const email = uniqueEmail("guest-portal");
    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${orgAdmin.accessToken}`)
      .send({
        email,
        password: "Guest-Portal-Pass-1!",
        firstName: "Guest",
        lastName: "Portal",
        role: "GUEST_PORTAL",
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "Guest-Portal-Pass-1!" })
      .expect(200);
    return login.body.accessToken as string;
  }

  it("rejects SUPER_ADMIN as an assignable role at the DTO level", async () => {
    const orgAdmin = await registerAndLogin(app);
    const res = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${orgAdmin.accessToken}`)
      .send({
        email: uniqueEmail("wannabe-super"),
        password: "Wannabe-Pass-1!",
        firstName: "W",
        lastName: "S",
        role: "SUPER_ADMIN",
      });

    expect(res.status).toBe(400);
  });

  it("blocks a low-privilege actor from creating staff users (403, not silently ignored)", async () => {
    const orgAdmin = await registerAndLogin(app);
    const guestToken = await createGuestPortalUser(orgAdmin);

    const res = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({
        email: uniqueEmail("escalated"),
        password: "Escalate-Pass-1!",
        firstName: "E",
        lastName: "P",
        role: "ORG_ADMIN",
      });

    expect(res.status).toBe(403);
  });

  it("blocks a low-privilege actor from creating a hotel", async () => {
    const orgAdmin = await registerAndLogin(app);
    const guestToken = await createGuestPortalUser(orgAdmin);

    const res = await request(app.getHttpServer())
      .post("/api/v1/hotels")
      .set("Authorization", `Bearer ${guestToken}`)
      .send({
        name: "Rogue Hotel",
        slug: "rogue-hotel",
        timezone: "UTC",
        currency: "USD",
        addressLine: "1 Rogue St",
        city: "Rogueville",
        country: "US",
      });

    expect(res.status).toBe(403);
  });

  it("revokes an already-issued session immediately when a role changes", async () => {
    const orgAdmin = await registerAndLogin(app);
    const email = uniqueEmail("front-desk");
    const created = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${orgAdmin.accessToken}`)
      .send({
        email,
        password: "Front-Desk-Pass-1!",
        firstName: "F",
        lastName: "D",
        role: "HOTEL_MANAGER",
        hotelId: (await createHotel(app, orgAdmin.accessToken)).id,
      })
      .expect(201);

    const staffLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "Front-Desk-Pass-1!" })
      .expect(200);
    const staffToken = staffLogin.body.accessToken as string;

    // Confirm the token works before the change.
    await request(app.getHttpServer())
      .get("/api/v1/hotels")
      .set("Authorization", `Bearer ${staffToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${created.body.id}/suspend`)
      .set("Authorization", `Bearer ${orgAdmin.accessToken}`)
      .expect(200);

    const afterSuspend = await request(app.getHttpServer())
      .get("/api/v1/hotels")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(afterSuspend.status).toBe(401);
  });

  it("blocks a staff member assigned to one hotel from touching a different hotel in the same org", async () => {
    const orgAdmin = await registerAndLogin(app);
    const hotelA = await createHotel(app, orgAdmin.accessToken, { slug: "hotel-a" });
    const hotelB = await createHotel(app, orgAdmin.accessToken, { slug: "hotel-b" });

    const email = uniqueEmail("manager-a");
    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${orgAdmin.accessToken}`)
      .send({
        email,
        password: "Manager-A-Pass-1!",
        firstName: "M",
        lastName: "A",
        role: "HOTEL_MANAGER",
        hotelId: hotelA.id,
      })
      .expect(201);

    const managerLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "Manager-A-Pass-1!" })
      .expect(200);
    const managerToken = managerLogin.body.accessToken as string;

    const ownHotel = await request(app.getHttpServer())
      .get(`/api/v1/hotels/${hotelA.id}/rooms`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(ownHotel.status).toBe(200);

    const otherHotel = await request(app.getHttpServer())
      .get(`/api/v1/hotels/${hotelB.id}/rooms`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(otherHotel.status).toBe(403);
  });
});
