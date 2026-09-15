import { randomUUID, createHmac } from "node:crypto";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, resetDatabase, TestApp } from "../utils/test-app";
import { futureDateString, setupHotelWithSingleRoom } from "../utils/fixtures";

function sign(payload: string, timestamp: number): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET as string;
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

describe("Payment webhook security", () => {
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

  async function createPendingIntent() {
    const fixture = await setupHotelWithSingleRoom(app);
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };
    const hold = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set(auth)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate: futureDateString(15),
        checkOutDate: futureDateString(17),
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const intent = await request(app.getHttpServer())
      .post("/api/v1/payments/intents")
      .set(auth)
      .send({ reservationId: hold.body.id, idempotencyKey: randomUUID() })
      .expect(201);

    return { fixture, reservationId: hold.body.id, intent: intent.body };
  }

  it("rejects a webhook with no signature header", async () => {
    const { intent } = await createPendingIntent();
    const payload = JSON.stringify({
      id: randomUUID(),
      type: "payment_intent.succeeded",
      data: { providerRef: intent.providerRef },
    });

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(401);
  });

  it("rejects a webhook with a forged signature", async () => {
    const { intent } = await createPendingIntent();
    const payload = JSON.stringify({
      id: randomUUID(),
      type: "payment_intent.succeeded",
      data: { providerRef: intent.providerRef },
    });

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("x-hrms-signature", `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`)
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(401);
  });

  it("rejects a webhook whose timestamp is outside the replay tolerance window", async () => {
    const { intent } = await createPendingIntent();
    const payload = JSON.stringify({
      id: randomUUID(),
      type: "payment_intent.succeeded",
      data: { providerRef: intent.providerRef },
    });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 10_000;

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("x-hrms-signature", `t=${staleTimestamp},v1=${sign(payload, staleTimestamp)}`)
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(401);
  });

  it("accepts a validly-signed webhook and confirms the reservation exactly once, even when redelivered", async () => {
    const { intent, reservationId, fixture } = await createPendingIntent();
    const eventId = randomUUID();
    const payload = JSON.stringify({
      id: eventId,
      type: "payment_intent.succeeded",
      data: { providerRef: intent.providerRef, cardBrand: "visa", cardLast4: "4242" },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = `t=${timestamp},v1=${sign(payload, timestamp)}`;

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("x-hrms-signature", signature)
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(201);

    const reservationRes = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}`)
      .set("Authorization", `Bearer ${fixture.accessToken}`)
      .expect(200);
    expect(reservationRes.body.status).toBe("CONFIRMED");

    // Redeliver the exact same event (same event id + signature) — the
    // gateway retrying after a slow ack is the realistic case this guards.
    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("x-hrms-signature", signature)
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(201);

    const webhookEvents = await ctx.prisma.paymentWebhookEvent.findMany({
      where: { providerEventId: eventId },
    });
    expect(webhookEvents).toHaveLength(1);

    const paymentIntent = await ctx.prisma.paymentIntent.findUniqueOrThrow({
      where: { id: intent.id },
    });
    expect(paymentIntent.status).toBe("CAPTURED");
  });

  it("replays an identical payment-intent creation request idempotently", async () => {
    const fixture = await setupHotelWithSingleRoom(app);
    const auth = { Authorization: `Bearer ${fixture.accessToken}` };
    const hold = await request(app.getHttpServer())
      .post("/api/v1/reservations")
      .set(auth)
      .send({
        hotelId: fixture.hotelId,
        roomTypeId: fixture.roomTypeId,
        guestId: fixture.guestId,
        checkInDate: futureDateString(25),
        checkOutDate: futureDateString(27),
        roomsRequested: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const idempotencyKey = randomUUID();
    const first = await request(app.getHttpServer())
      .post("/api/v1/payments/intents")
      .set(auth)
      .send({ reservationId: hold.body.id, idempotencyKey })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/payments/intents")
      .set(auth)
      .send({ reservationId: hold.body.id, idempotencyKey })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const count = await ctx.prisma.paymentIntent.count({ where: { reservationId: hold.body.id } });
    expect(count).toBe(1);
  });
});
