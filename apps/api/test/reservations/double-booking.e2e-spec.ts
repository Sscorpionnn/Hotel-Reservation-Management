import { randomUUID } from "node:crypto";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { futureDateString, setupHotelWithSingleRoom } from "../utils/fixtures";

describe("Reservation concurrency (double-booking prevention)", () => {
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

  it("allows exactly one of many concurrent holds on the same single room to succeed", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const checkInDate = futureDateString(30);
    const checkOutDate = futureDateString(32);

    // Kept comfortably under the route's own rate limit (40/min/user) so
    // this test proves the database-level concurrency guarantee, not the
    // unrelated throttling guard — the other tests in this file share the
    // same app instance and its throttle window.
    const CONCURRENCY = 20;
    const requests = Array.from({ length: CONCURRENCY }, () =>
      request(app.getHttpServer())
        .post("/api/v1/reservations")
        .set("Authorization", `Bearer ${fixture.accessToken}`)
        .send({
          hotelId: fixture.hotelId,
          roomTypeId: fixture.roomTypeId,
          guestId: fixture.guestId,
          checkInDate,
          checkOutDate,
          roomsRequested: 1,
          adults: 2,
          children: 0,
          idempotencyKey: randomUUID(),
        }),
    );

    const responses = await Promise.all(requests);

    const succeeded = responses.filter((r) => r.status === 201);
    const conflicted = responses.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(CONCURRENCY - 1);
    expect(succeeded[0].body.status).toBe("HELD");

    // The database must reflect exactly one active booking for exactly
    // the two nights requested — no partial writes from any loser.
    const nights = await ctx.prisma.reservationNight.findMany({
      where: { roomId: fixture.roomId, releasedAt: null },
    });
    expect(nights).toHaveLength(2);

    const reservationCount = await ctx.prisma.reservation.count({
      where: { hotelId: fixture.hotelId },
    });
    expect(reservationCount).toBe(1);
  });

  it("frees the room immediately on cancellation so a new hold can claim it", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const checkInDate = futureDateString(40);
    const checkOutDate = futureDateString(42);

    const first = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate,
        checkOutDate,
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${first.body.id}/cancel`)
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({ reason: "test" })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate,
        checkOutDate,
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      });

    expect(second.status).toBe(201);
  });

  it("rejects a hold with no rooms available", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const checkInDate = futureDateString(50);
    const checkOutDate = futureDateString(52);

    await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate,
        checkOutDate,
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const overbook = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate,
        checkOutDate,
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      });

    expect(overbook.status).toBe(409);
  });
});
