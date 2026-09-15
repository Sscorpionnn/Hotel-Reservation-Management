import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestActor } from "../common/tenant/tenant-context";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async occupancy(hotelId: string, from: string, to: string, actor: RequestActor) {
    const hotel = await this.assertHotel(hotelId, actor);
    const { fromDate, toDate } = this.parseRange(from, to);

    const totalRooms = await this.prisma.room.count({ where: { hotelId, status: "AVAILABLE" } });
    const bookedNights = await this.prisma.reservationNight.count({
      where: {
        releasedAt: null,
        stayDate: { gte: fromDate, lt: toDate },
        room: { hotelId },
      },
    });
    const totalNightCapacity = totalRooms * diffDays(fromDate, toDate);

    return {
      hotelId,
      hotelName: hotel.name,
      from,
      to,
      totalRooms,
      bookedRoomNights: bookedNights,
      availableRoomNights: totalNightCapacity,
      occupancyRate:
        totalNightCapacity > 0 ? Number((bookedNights / totalNightCapacity).toFixed(4)) : 0,
    };
  }

  async revenue(hotelId: string, from: string, to: string, actor: RequestActor) {
    const hotel = await this.assertHotel(hotelId, actor);
    const { fromDate, toDate } = this.parseRange(from, to);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        hotelId,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkInDate: { gte: fromDate, lt: toDate },
      },
      select: { totalCents: true, discountCents: true, status: true },
    });

    const grossCents = reservations.reduce((sum, r) => sum + r.totalCents, 0);
    const discountCents = reservations.reduce((sum, r) => sum + r.discountCents, 0);

    return {
      hotelId,
      hotelName: hotel.name,
      currency: hotel.currency,
      from,
      to,
      reservationCount: reservations.length,
      grossRevenueCents: grossCents,
      totalDiscountCents: discountCents,
    };
  }

  private async assertHotel(hotelId: string, actor: RequestActor) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");
    return hotel;
  }

  private parseRange(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate <= fromDate) {
      throw new BadRequestException("Invalid date range");
    }
    return { fromDate, toDate };
  }
}

function diffDays(from: Date, to: Date): number {
  return Math.max(Math.round((to.getTime() - from.getTime()) / 86_400_000), 0);
}
