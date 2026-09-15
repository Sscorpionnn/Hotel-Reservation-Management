import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ReservationsService, HOLD_EXPIRY_QUEUE } from "./reservations.service";
import { ReservationsController } from "./reservations.controller";
import { ReservationsGateway } from "./reservations.gateway";
import { HoldExpiryProcessor } from "./hold-expiry.processor";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [BullModule.registerQueue({ name: HOLD_EXPIRY_QUEUE }), NotificationsModule],
  providers: [ReservationsService, ReservationsGateway, HoldExpiryProcessor],
  controllers: [ReservationsController],
  exports: [ReservationsService],
})
export class ReservationsModule {}
