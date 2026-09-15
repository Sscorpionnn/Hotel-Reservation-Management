import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRatePlanDto } from "./dto/create-rate-plan.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyRoomType(hotelId: string, roomTypeId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");

    const roomType = await this.prisma.roomType.findFirst({ where: { id: roomTypeId, hotelId } });
    if (!roomType) throw new NotFoundException("Room type not found");
    return roomType;
  }

  async create(hotelId: string, roomTypeId: string, dto: CreateRatePlanDto, actor: RequestActor) {
    await this.verifyRoomType(hotelId, roomTypeId, actor);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException("endDate must be after startDate");
    }

    return this.prisma.ratePlan.create({
      data: {
        roomTypeId,
        name: dto.name,
        startDate,
        endDate,
        priceCents: dto.priceCents,
        currency: dto.currency,
        minStayNights: dto.minStayNights,
        isRefundable: dto.isRefundable,
      },
    });
  }

  async list(hotelId: string, roomTypeId: string, actor: RequestActor) {
    await this.verifyRoomType(hotelId, roomTypeId, actor);
    return this.prisma.ratePlan.findMany({
      where: { roomTypeId },
      orderBy: { startDate: "asc" },
    });
  }

  async remove(hotelId: string, roomTypeId: string, id: string, actor: RequestActor) {
    await this.verifyRoomType(hotelId, roomTypeId, actor);
    const rate = await this.prisma.ratePlan.findFirst({ where: { id, roomTypeId } });
    if (!rate) throw new NotFoundException("Rate plan not found");
    await this.prisma.ratePlan.delete({ where: { id } });
  }
}
