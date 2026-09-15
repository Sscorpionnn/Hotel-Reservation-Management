import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Tracks authenticated requests by user id rather than IP. Multiple staff
 * members at one hotel commonly share a NAT'd office IP, and IP-based
 * limits would let them throttle each other; conversely a single abusive
 * account rotating source IPs shouldn't be able to dodge its own limit.
 * Unauthenticated routes (login, register — reached before JwtAuthGuard
 * populates `req.actor`) fall back to IP, which is what we want for
 * brute-force protection there.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const actor = req.actor as { userId?: string } | undefined;
    if (actor?.userId) return `user:${actor.userId}`;
    return super.getTracker(req);
  }
}
