import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { MockPaymentProvider } from "./mock-payment.provider";

const SECRET = "unit-test-webhook-secret";

function buildProvider(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    PAYMENT_WEBHOOK_SECRET: SECRET,
    PAYMENT_WEBHOOK_TOLERANCE_SECONDS: "300",
    ...overrides,
  };
  const config = { get: (k: string) => values[k], getOrThrow: (k: string) => values[k] };
  return new MockPaymentProvider(config as unknown as ConfigService);
}

function sign(payload: string, timestamp: number, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

describe("MockPaymentProvider.verifyWebhookSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });

  it("accepts a correctly-signed, fresh payload", () => {
    const provider = buildProvider();
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign(payload, ts)}`;
    expect(() => provider.verifyWebhookSignature(Buffer.from(payload), header)).not.toThrow();
  });

  it("rejects a missing signature header", () => {
    const provider = buildProvider();
    expect(() => provider.verifyWebhookSignature(Buffer.from(payload), undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a malformed signature header", () => {
    const provider = buildProvider();
    expect(() =>
      provider.verifyWebhookSignature(Buffer.from(payload), "not-a-valid-header"),
    ).toThrow(UnauthorizedException);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const provider = buildProvider();
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign(payload, ts, "wrong-secret")}`;
    expect(() => provider.verifyWebhookSignature(Buffer.from(payload), header)).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a timestamp older than the configured tolerance (replay protection)", () => {
    const provider = buildProvider({ PAYMENT_WEBHOOK_TOLERANCE_SECONDS: "60" });
    const ts = Math.floor(Date.now() / 1000) - 3600;
    const header = `t=${ts},v1=${sign(payload, ts)}`;
    expect(() => provider.verifyWebhookSignature(Buffer.from(payload), header)).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a payload that was altered after signing", () => {
    const provider = buildProvider();
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${sign(payload, ts)}`;
    const tamperedPayload = JSON.stringify({ id: "evt_1", type: "payment_intent.failed" });
    expect(() => provider.verifyWebhookSignature(Buffer.from(tamperedPayload), header)).toThrow(
      UnauthorizedException,
    );
  });
});
