import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateHousekeepingTaskDto } from "./dto/update-housekeeping-task.dto";
import { AssignHousekeepingTaskDto } from "./dto/assign-housekeeping-task.dto";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyHotel(hotelId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  async list(hotelId: string, status: string | undefined, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    return this.prisma.housekeepingTask.findMany({
      where: { hotelId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: "asc" },
      include: { room: true, assignedTo: true },
    });
  }

  private async verifyTask(hotelId: string, id: string, actor: RequestActor) {
    await this.verifyHotel(hotelId, actor);
    const task = await this.prisma.housekeepingTask.findFirst({ where: { id, hotelId } });
    if (!task) throw new NotFoundException("Housekeeping task not found");
    return task;
  }

  async update(hotelId: string, id: string, dto: UpdateHousekeepingTaskDto, actor: RequestActor) {
    await this.verifyTask(hotelId, id, actor);

    if (dto.assignedToId) {
      await this.assertAssignable(dto.assignedToId, actor);
    }

    return this.prisma.housekeepingTask.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        assignedToId: dto.assignedToId,
      },
    });
  }

  async assign(hotelId: string, id: string, dto: AssignHousekeepingTaskDto, actor: RequestActor) {
    await this.verifyTask(hotelId, id, actor);
    await this.assertAssignable(dto.assignedToId, actor);

    return this.prisma.housekeepingTask.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
    });
  }

  private async assertAssignable(userId: string, actor: RequestActor) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: actor.organizationId,
        role: { in: ["HOUSEKEEPING_STAFF", "HOTEL_MANAGER"] },
      },
    });
    if (!user) {
      throw new BadRequestException(
        "assignedToId must be a housekeeping staff member or hotel manager in this organization",
      );
    }
  }
}
