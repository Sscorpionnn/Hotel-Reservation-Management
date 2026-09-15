import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsWebhookController } from "./payments-webhook.controller";
import { MockPaymentProvider } from "./providers/mock-payment.provider";
import { PAYMENT_PROVIDER } from "./providers/payment-provider.interface";
import { ReservationsModule } from "../reservations/reservations.module";

@Module({
  imports: [ReservationsModule],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: MockPaymentProvider,
    },
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
