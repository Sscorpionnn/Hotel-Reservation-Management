import { randomUUID } from "node:crypto";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";

export const DEMO_PASSWORD = "Fixture-Pass-123!";

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID().slice(0, 8)}@example.com`;
}

export interface RegisteredOrg {
  organizationId: string;
  userId: string;
  email: string;
  password: string;
}

export async function registerOrganization(
  app: INestApplication,
  overrides: Partial<{ organizationName: string; organizationSlug: string; email: string }> = {},
): Promise<RegisteredOrg> {
  const email = overrides.email ?? uniqueEmail("admin");
  const body = {
    organizationName: overrides.organizationName ?? "Test Org",
    organizationSlug: overrides.organizationSlug ?? uniqueSlug("test-org"),
    email,
    password: DEMO_PASSWORD,
    firstName: "Test",
    lastName: "Admin",
  };
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/register-organization")
    .send(body)
    .expect(201);

  return {
    organizationId: res.body.organizationId,
    userId: res.body.userId,
    email,
    password: DEMO_PASSWORD,
  };
}

export interface LoginResult {
  accessToken: string;
  refreshCookie: string;
  csrfCookie: string;
  cookieHeader: string;
}

export function extractCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = cookies.find((c: string) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return match.split(";")[0].split("=")[1];
}

export async function login(
  app: INestApplication,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<LoginResult> {
  const res = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);

  const refreshCookie = extractCookie(res, "refresh_token");
  const csrfCookie = extractCookie(res, "csrf_token");
  if (!refreshCookie || !csrfCookie) {
    throw new Error("Login did not set expected session cookies");
  }

  return {
    accessToken: res.body.accessToken,
    refreshCookie,
    csrfCookie,
    cookieHeader: `refresh_token=${refreshCookie}; csrf_token=${csrfCookie}`,
  };
}

export async function registerAndLogin(
  app: INestApplication,
  overrides: Parameters<typeof registerOrganization>[1] = {},
): Promise<RegisteredOrg & LoginResult> {
  const org = await registerOrganization(app, overrides);
  const session = await login(app, org.email, org.password);
  return { ...org, ...session };
}

export async function createHotel(
  app: INestApplication,
  token: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/hotels")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Fixture Hotel",
      slug: uniqueSlug("fixture-hotel"),
      timezone: "UTC",
      currency: "USD",
      addressLine: "1 Fixture St",
      city: "Fixtureville",
      country: "US",
      ...overrides,
    })
    .expect(201);
  return res.body;
}

export async function createRoomType(
  app: INestApplication,
  token: string,
  hotelId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/hotels/${hotelId}/room-types`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Standard",
      capacityAdults: 2,
      capacityChildren: 0,
      basePriceCents: 10_000,
      currency: "USD",
      ...overrides,
    })
    .expect(201);
  return res.body;
}

export async function createRoom(
  app: INestApplication,
  token: string,
  hotelId: string,
  roomTypeId: string,
  roomNumber: string,
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/hotels/${hotelId}/rooms`)
    .set("Authorization", `Bearer ${token}`)
    .send({ roomTypeId, roomNumber, floor: 1 })
    .expect(201);
  return res.body;
}

export async function createGuest(
  app: INestApplication,
  token: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const res = await request(app.getHttpServer())
    .post("/api/v1/guests")
    .set("Authorization", `Bearer ${token}`)
    .send({
      email: uniqueEmail("guest"),
      firstName: "Gina",
      lastName: "Guest",
      ...overrides,
    })
    .expect(201);
  return res.body;
}

export interface SingleRoomFixture extends RegisteredOrg, LoginResult {
  hotelId: string;
  roomTypeId: string;
  roomId: string;
  guestId: string;
}

/** One organization, one hotel, one room type, exactly one physical room, one guest. */
export async function setupHotelWithSingleRoom(app: INestApplication): Promise<SingleRoomFixture> {
  const session = await registerAndLogin(app);
  const hotel = await createHotel(app, session.accessToken);
  const roomType = await createRoomType(app, session.accessToken, hotel.id);
  const room = await createRoom(app, session.accessToken, hotel.id, roomType.id, "101");
  const guest = await createGuest(app, session.accessToken);

  return {
    ...session,
    hotelId: hotel.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    guestId: guest.id,
  };
}

export function futureDateString(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
