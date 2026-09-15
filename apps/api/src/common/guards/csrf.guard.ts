import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

/**
 * Double-submit-cookie CSRF check for the handful of endpoints that rely on
 * an httpOnly cookie for authentication (refresh/logout). Every other
 * mutating endpoint requires an Authorization: Bearer header instead of a
 * cookie, which browsers never attach cross-site, so it is not CSRF-able.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerToken = request.headers["x-csrf-token"];
    const cookieToken = request.cookies?.["csrf_token"];

    if (
      typeof headerToken !== "string" ||
      typeof cookieToken !== "string" ||
      headerToken.length === 0 ||
      headerToken.length !== cookieToken.length ||
      !timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))
    ) {
      throw new ForbiddenException("CSRF token missing or invalid");
    }
    return true;
  }
}
