import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class RoomTypesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyHotel(hotelId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  async create(hotelId: string, dto: CreateRoomTypeDto, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.roomType.create({ data: { ...dto, hotelId } });
  }

  async list(hotelId: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.roomType.findMany({ where: { hotelId }, orderBy: { name: "asc" } });
  }

  async get(hotelId: string, id: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    const roomType = await this.prisma.roomType.findFirst({ where: { id, hotelId } });
    if (!roomType) throw new NotFoundException("Room type not found");
    return roomType;
  }

  async update(hotelId: string, id: string, dto: UpdateRoomTypeDto, actor: RequestActor) {
    await this.get(hotelId, id, actor);
    return this.prisma.roomType.update({ where: { id }, data: dto });
  }
}
