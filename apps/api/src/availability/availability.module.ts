import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AvailabilityService } from "./availability.service";
import { AvailabilityController } from "./availability.controller";

@Module({
  imports: [CacheModule.register()],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
})
export class AvailabilityModule {}
