import { randomUUID } from "node:crypto";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { futureDateString, setupHotelWithSingleRoom } from "../utils/fixtures";

describe("Reservation state machine", () => {
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

  async function createHold(fixture: Awaited<ReturnType<typeof setupHotelWithSingleRoom>>) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate: futureDateString(10),
        checkOutDate: futureDateString(12),
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    return res.body;
  }

  it("walks HELD -> CONFIRMED -> CHECKED_IN -> CHECKED_OUT and creates a housekeeping task", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const reservation = await createHold(fixture);
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };

    const confirmed = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set(auth)
      .expect(200);
    expect(confirmed.body.status).toBe("CONFIRMED");

    const checkedIn = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/check-in`)
      .set(auth)
      .expect(200);
    expect(checkedIn.body.status).toBe("CHECKED_IN");

    const checkedOut = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/check-out`)
      .set(auth)
      .expect(200);
    expect(checkedOut.body.status).toBe("CHECKED_OUT");

    const tasks = await ctx.prisma.housekeepingTask.findMany({
      where: { roomId: fixture.roomId },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("DIRTY");
  });

  it.each(["check-in", "check-out"])("rejects %s on a reservation still in HELD", async (verb) => {
    const fixture = await setupHotelWithSingleRoom(app);
    const reservation = await createHold(fixture);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/${verb}`)
      .set("Authorization", `Bearer ${fixture.accessToken}`);
    expect(res.status).toBe(409);
  });

  it("returns 409, not 500, when confirming an already-confirmed reservation", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const reservation = await createHold(fixture);
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set(auth)
      .expect(200);

    const secondConfirm = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set(auth);

    expect(secondConfirm.status).toBe(409);
  });

  it("cannot cancel a checked-out (terminal) reservation", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const reservation = await createHold(fixture);
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };

    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/confirm`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/check-in`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/check-out`)
      .set(auth)
      .expect(200);

    const cancelAttempt = await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${reservation.id}/cancel`)
      .set(auth)
      .send({ reason: "too late" });

    expect(cancelAttempt.status).toBe(409);
  });

  it("replays an identical create-hold request idempotently instead of double-booking", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const idempotencyKey = randomUUID();
    const payload = {
      hotelId: fixture.hotelId,
      roomTypeId: fixture.roomTypeId,
      guestId: fixture.guestId,
      checkInDate: futureDateString(20),
      checkOutDate: futureDateString(22),
      roomsRequested: 1,
      idempotencyKey,
    };
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };

    const first = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set(auth)
      .send(payload)
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set(auth)
      .send(payload)
      .expect(201);

    expect(replay.body.id).toBe(first.body.id);

    const count = await ctx.prisma.reservation.count({ where: { hotelId: fixture.hotelId } });
    expect(count).toBe(1);
  });
});
