export interface CreatePaymentIntentInput {
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface ProviderPaymentIntent {
  providerRef: string;
  status: "REQUIRES_ACTION" | "PENDING";
  clientSecret?: string;
}

/**
 * Provider abstraction so the rest of the codebase never depends on a
 * specific payment gateway's SDK or webhook shape. Swapping providers
 * means implementing this interface — no changes to ReservationsService,
 * PaymentsService's public API, or the webhook signature-verification
 * contract below.
 */
export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent>;
  /** Verifies an inbound webhook's authenticity; throws if invalid. */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): void;
}

export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";
