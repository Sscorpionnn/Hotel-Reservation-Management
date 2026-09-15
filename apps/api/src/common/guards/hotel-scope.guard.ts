import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { RequestActor } from "../tenant/tenant-context";

const HOTEL_ASSIGNED_ROLES = ["HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF"];

/**
 * Blocks HOTEL_MANAGER / FRONT_DESK_AGENT / HOUSEKEEPING_STAFF actors from
 * reaching a route whose `:hotelId` param isn't the hotel they're assigned
 * to. ORG_ADMIN and SUPER_ADMIN operate across every hotel in (or beyond)
 * the organization, and GUEST_PORTAL actors aren't pinned to any single
 * hotel (they browse/book across the org's properties), so both bypass
 * this check — organization scoping is still enforced separately by every
 * query going through TenantContext.
 */
@Injectable()
export class HotelScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actor: RequestActor | undefined = request.actor;
    const hotelId: string | undefined = request.params?.hotelId;

    if (!actor) throw new ForbiddenException();
    if (!HOTEL_ASSIGNED_ROLES.includes(actor.role)) return true;
    if (!hotelId) return true;

    if (actor.hotelId !== hotelId) {
      throw new ForbiddenException("You are not assigned to this hotel");
    }
    return true;
  }
}
