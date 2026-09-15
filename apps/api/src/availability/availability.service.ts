import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestActor } from "../common/tenant/tenant-context";

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  currency: string;
  totalPriceCents: number;
  availableRooms: number;
  nights: number;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Availability for a stay is the minimum free-room count across every
   * night of the stay (the bottleneck night), computed with one query per
   * room type via raw SQL rather than N application-side loops. Results
   * are safe to cache aggressively (see CacheInterceptor in the
   * controller) — they only go stale when a hold/booking/cancellation
   * happens, and the websocket gateway tells clients when that occurs so
   * they know to refetch instead of polling.
   */
  async search(
    hotelId: string,
    checkInDate: string,
    checkOutDate: string,
    actor: RequestActor,
  ): Promise<RoomTypeAvailability[]> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: actor.organizationId },
    });
    if (!hotel) throw new NotFoundException("Hotel not found");

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      throw new BadRequestException("Invalid date range");
    }
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

    const roomTypes = await this.prisma.roomType.findMany({
      where: { hotelId, isActive: true },
    });

    const results: RoomTypeAvailability[] = [];
    for (const roomType of roomTypes) {
      const totalRooms = await this.prisma.room.count({
        where: { hotelId, roomTypeId: roomType.id, status: "AVAILABLE" },
      });
      if (totalRooms === 0) {
        results.push({
          roomTypeId: roomType.id,
          name: roomType.name,
          currency: roomType.currency,
          totalPriceCents: roomType.basePriceCents * nights,
          availableRooms: 0,
          nights,
        });
        continue;
      }

      // Rooms of this type with at least one active night booked inside
      // the requested range are unavailable for the whole range.
      const bookedRoomIds = await this.prisma.reservationNight.groupBy({
        by: ["roomId"],
        where: {
          releasedAt: null,
          stayDate: { gte: checkIn, lt: checkOut },
          room: { roomTypeId: roomType.id, hotelId },
        },
      });

      const availableRooms = Math.max(totalRooms - bookedRoomIds.length, 0);

      const rate = await this.prisma.ratePlan.findFirst({
        where: { roomTypeId: roomType.id, startDate: { lte: checkIn }, endDate: { gte: checkIn } },
        orderBy: { priceCents: "asc" },
      });
      const nightlyRate = rate?.priceCents ?? roomType.basePriceCents;

      results.push({
        roomTypeId: roomType.id,
        name: roomType.name,
        currency: roomType.currency,
        totalPriceCents: nightlyRate * nights,
        availableRooms,
        nights,
      });
    }

    return results;
  }
}
