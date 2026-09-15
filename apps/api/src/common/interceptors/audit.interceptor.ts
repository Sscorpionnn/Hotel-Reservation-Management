import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, tap } from "rxjs";
import { AUDIT_KEY, AuditMeta } from "../decorators/audit.decorator";
import { AuditService } from "../../audit/audit.service";
import type { RequestActor } from "../tenant/tenant-context";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const actor: RequestActor | undefined = request.actor;

    return next.handle().pipe(
      tap((result) => {
        if (!actor) return;
        const entityId =
          resolvePath(result, meta.entityIdPath ?? "id") ?? request.params?.id ?? "unknown";

        void this.auditService.record({
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: meta.action,
          entityType: meta.entityType,
          entityId: String(entityId),
          metadata: { method: request.method, path: request.originalUrl },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });
      }),
    );
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}
