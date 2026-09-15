import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

export interface RequestActor {
  userId: string;
  organizationId: string;
  hotelId: string | null;
  role: string;
}

const ACTOR_KEY = "actor";

/**
 * Thin wrapper around AsyncLocalStorage (via nestjs-cls) so every layer of
 * the request — services, the Prisma tenant guard, audit logging — reads
 * the authenticated actor's tenant scope from one place instead of having
 * it threaded through every method signature (and forgotten somewhere).
 */
@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  set(actor: RequestActor) {
    this.cls.set(ACTOR_KEY, actor);
  }

  get(): RequestActor | undefined {
    return this.cls.get(ACTOR_KEY);
  }

  requireActor(): RequestActor {
    const actor = this.get();
    if (!actor) {
      throw new Error("TenantContext accessed outside of an authenticated request");
    }
    return actor;
  }

  requireOrganizationId(): string {
    return this.requireActor().organizationId;
  }
}
