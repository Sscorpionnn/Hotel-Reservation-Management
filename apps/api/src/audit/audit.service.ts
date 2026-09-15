import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    // System-triggered actions (e.g. a payment webhook auto-confirming a
    // reservation) pass a synthetic, non-UUID actor id for authorization
    // purposes. That id has no matching row in `users`, so writing it here
    // would violate the actorUserId foreign key — record it as an
    // unattributed (null actor) event with the synthetic id preserved in
    // metadata instead of silently losing the audit entry.
    const isRealUser = entry.actorUserId !== null && UUID_RE.test(entry.actorUserId);

    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          actorUserId: isRealUser ? entry.actorUserId : null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: isRealUser
            ? entry.metadata
            : { ...(entry.metadata as object), syntheticActorId: entry.actorUserId },
          ipAddress: entry.ipAddress ?? undefined,
          userAgent: entry.userAgent ?? undefined,
        },
      });
    } catch (error) {
      // Audit logging must never break the primary request flow.
      this.logger.error(`Failed to persist audit log: ${(error as Error).message}`);
    }
  }
}
