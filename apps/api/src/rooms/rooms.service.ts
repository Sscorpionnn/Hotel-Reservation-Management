import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyHotel(hotelId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  async create(hotelId: string, dto: CreateRoomDto, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, hotelId },
    });
    if (!roomType) throw new BadRequestException("roomTypeId does not belong to this hotel");

    return this.prisma.room.create({
      data: { hotelId, roomTypeId: dto.roomTypeId, roomNumber: dto.roomNumber, floor: dto.floor },
    });
  }

  async list(hotelId: string, status: string | undefined, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.room.findMany({
      where: { hotelId, ...(status ? { status: status as never } : {}) },
      orderBy: { roomNumber: "asc" },
    });
  }

  async get(hotelId: string, id: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    const room = await this.prisma.room.findFirst({ where: { id, hotelId } });
    if (!room) throw new NotFoundException("Room not found");
    return room;
  }

  async update(hotelId: string, id: string, dto: UpdateRoomDto, actor: RequestActor) {
    await this.get(hotelId, id, actor);
    return this.prisma.room.update({ where: { id }, data: dto });
  }
}
