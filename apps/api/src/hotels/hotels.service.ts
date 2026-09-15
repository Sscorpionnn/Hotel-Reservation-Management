import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { UpdateHotelDto } from "./dto/update-hotel.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHotelDto, actor: RequestActor) {
    return this.prisma.hotel.create({
      data: { ...dto, organizationId: actor.organizationId },
    });
  }

  list(actor: RequestActor) {
    return this.prisma.hotel.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
    });
  }

  async get(id: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  async update(id: string, dto: UpdateHotelDto, actor: RequestActor) {
    await this.get(id, actor);
    return this.prisma.hotel.update({ where: { id }, data: dto });
  }
}
