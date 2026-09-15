import type { ReservationStatus, UserRole } from "@hrms/shared";

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  addressLine: string;
  city: string;
  country: string;
  isActive: boolean;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  capacityAdults: number;
  capacityChildren: number;
  basePriceCents: number;
  currency: string;
  isActive: boolean;
}

export interface Room {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: "AVAILABLE" | "OUT_OF_SERVICE" | "MAINTENANCE";
  roomTypeId: string;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string | null;
}

export interface RatePlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  priceCents: number;
  currency: string;
  minStayNights: number;
  isRefundable: boolean;
}

export interface Guest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  country: string | null;
}

export interface Promotion {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  hotelId: string | null;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  status: "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED" | "OUT_OF_SERVICE";
  notes: string | null;
  assignedToId: string | null;
}

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  hotelId: string | null;
}

export interface ReservationNight {
  roomId: string;
  stayDate: string;
  rateCents: number;
}

export interface Reservation {
  id: string;
  hotelId: string;
  guestId: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  nights: ReservationNight[];
}

export interface PaymentIntent {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string | null;
}
