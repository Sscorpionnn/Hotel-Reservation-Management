import { Module } from "@nestjs/common";
import { AmenitiesService } from "./amenities.service";
import { AmenitiesController, RoomTypeAmenitiesController } from "./amenities.controller";

@Module({
  providers: [AmenitiesService],
  controllers: [AmenitiesController, RoomTypeAmenitiesController],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
