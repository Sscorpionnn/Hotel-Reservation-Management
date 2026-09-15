import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAmenityDto } from "./dto/create-amenity.dto";
import { SetRoomTypeAmenitiesDto } from "./dto/set-room-type-amenities.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyHotel(hotelId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  async create(hotelId: string, dto: CreateAmenityDto, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.amenity.create({ data: { ...dto, hotelId } });
  }

  async list(hotelId: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.amenity.findMany({ where: { hotelId }, orderBy: { name: "asc" } });
  }

  async remove(hotelId: string, id: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    const amenity = await this.prisma.amenity.findFirst({ where: { id, hotelId } });
    if (!amenity) throw new NotFoundException("Amenity not found");
    await this.prisma.amenity.delete({ where: { id } });
  }

  async setRoomTypeAmenities(
    hotelId: string,
    roomTypeId: string,
    dto: SetRoomTypeAmenitiesDto,
    actor: RequestActor,
  ) {
    await this.verifyHotel(hotelId, actor);
    const roomType = await this.prisma.roomType.findFirst({ where: { id: roomTypeId, hotelId } });
    if (!roomType) throw new NotFoundException("Room type not found");

    if (dto.amenityIds.length > 0) {
      const owned = await this.prisma.amenity.count({
        where: { id: { in: dto.amenityIds }, hotelId },
      });
      if (owned !== dto.amenityIds.length) {
        throw new BadRequestException("One or more amenityIds do not belong to this hotel");
      }
    }

    await this.prisma.$transaction([
      this.prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId } }),
      this.prisma.roomTypeAmenity.createMany({
        data: dto.amenityIds.map((amenityId) => ({ roomTypeId, amenityId })),
      }),
    ]);

    return this.prisma.roomTypeAmenity.findMany({
      where: { roomTypeId },
      include: { amenity: true },
    });
  }
}
