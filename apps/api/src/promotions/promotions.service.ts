import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePromotionDto } from "./dto/create-promotion.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto, actor: RequestActor) {
    if (dto.discountType === "PERCENTAGE" && dto.discountValue > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100");
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }

    if (dto.hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: dto.hotelId, organizationId: actor.organizationId },
      });
      if (!hotel) throw new NotFoundException("Hotel not found");
    }

    return this.prisma.promotion.create({
      data: {
        organizationId: actor.organizationId,
        hotelId: dto.hotelId,
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        startsAt,
        endsAt,
        maxRedemptions: dto.maxRedemptions,
      },
    });
  }

  list(actor: RequestActor) {
    return this.prisma.promotion.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deactivate(id: string, actor: RequestActor) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!promotion) throw new NotFoundException("Promotion not found");

    return this.prisma.promotion.update({ where: { id }, data: { isActive: false } });
  }
}
