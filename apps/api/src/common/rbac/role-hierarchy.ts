import { UserRole } from "@prisma/client";

// Lower number = more privileged. Used only for convenience checks like
// "is this actor at least a hotel manager" — explicit @Roles() allow-lists
// on each route remain the source of truth for access control.
export const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  ORG_ADMIN: 1,
  HOTEL_MANAGER: 2,
  FRONT_DESK_AGENT: 3,
  HOUSEKEEPING_STAFF: 3,
  GUEST_PORTAL: 4,
};

export function isAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] <= ROLE_RANK[minimum];
}
