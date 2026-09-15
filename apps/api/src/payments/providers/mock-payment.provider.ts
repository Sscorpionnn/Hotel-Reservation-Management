import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderPaymentIntent,
} from "./payment-provider.interface";

/**
 * Deterministic, offline stand-in for a real gateway (Stripe/Adyen/etc).
 * It never touches real card data — only ever amount/currency metadata —
 * and it signs webhooks the same way most real providers do:
 * `t=<unix ts>,v1=<hex hmac-sha256 of "t.rawBody">`, which is what
 * verifyWebhookSignature checks on the way back in.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(_input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    return {
      providerRef: `mock_pi_${randomUUID()}`,
      status: "PENDING",
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): void {
    if (!signatureHeader) throw new UnauthorizedException("Missing webhook signature");

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k, v];
      }),
    );
    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) {
      throw new UnauthorizedException("Malformed webhook signature");
    }

    const toleranceSeconds = Number(this.config.get("PAYMENT_WEBHOOK_TOLERANCE_SECONDS") ?? 300);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) {
      throw new UnauthorizedException(
        "Webhook timestamp outside tolerance window (possible replay)",
      );
    }

    const secret = this.config.getOrThrow<string>("PAYMENT_WEBHOOK_SECRET");
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new UnauthorizedException("Webhook signature mismatch");
    }
  }
}
