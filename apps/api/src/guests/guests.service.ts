import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGuestDto, actor: RequestActor) {
    return this.prisma.guest.create({
      data: { ...dto, organizationId: actor.organizationId },
    });
  }

  list(search: string | undefined, actor: RequestActor) {
    return this.prisma.guest.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { lastName: "asc" },
      take: 100,
    });
  }

  // Every lookup is filtered by the caller's organizationId at the query
  // level (not checked after the fact) — a guest id from another tenant
  // simply doesn't match any row, so this returns 404 rather than leaking
  // whether the id exists elsewhere (IDOR hardening).
  async get(id: string, actor: RequestActor) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!guest) throw new NotFoundException("Guest not found");
    return guest;
  }

  async update(id: string, dto: UpdateGuestDto, actor: RequestActor) {
    await this.get(id, actor);
    return this.prisma.guest.update({ where: { id }, data: dto });
  }
}
