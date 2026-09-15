import { Module } from "@nestjs/common";
import { GuestsService } from "./guests.service";
import { GuestsController } from "./guests.controller";

@Module({
  providers: [GuestsService],
  controllers: [GuestsController],
  exports: [GuestsService],
})
export class GuestsModule {}
