import { ConflictException } from "@nestjs/common";
import { ReservationStatus } from "@prisma/client";

/**
 * The only legal transitions in the reservation lifecycle. Every state
 * change in ReservationsService goes through an atomic
 * `UPDATE ... WHERE id = ? AND status = <from>` so a concurrent transition
 * attempted from a stale state loses the race deterministically (0 rows
 * affected) instead of corrupting state.
 */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  HELD: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function assertTransitionAllowed(from: ReservationStatus, to: ReservationStatus): void {
  if (!RESERVATION_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictException(`Cannot transition reservation from ${from} to ${to}`);
  }
}
