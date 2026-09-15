export type UserRole =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "HOTEL_MANAGER"
  | "FRONT_DESK_AGENT"
  | "HOUSEKEEPING_STAFF"
  | "GUEST_PORTAL";

export type ReservationStatus =
  | "HELD"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentStatus =
  | "REQUIRES_ACTION"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export interface RoomTypeAvailability {
  roomTypeId: string;
  name: string;
  currency: string;
  totalPriceCents: number;
  availableRooms: number;
  nights: number;
}

export interface ReservationSummary {
  id: string;
  hotelId: string;
  guestId: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  totalCents: number;
}

export function formatCents(cents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
