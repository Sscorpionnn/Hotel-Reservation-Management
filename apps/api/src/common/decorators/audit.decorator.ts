import { SetMetadata } from "@nestjs/common";

export const AUDIT_KEY = "audit";

export interface AuditMeta {
  action: string;
  entityType: string;
  /** Dot path (relative to the response body) used to resolve entityId, e.g. "id". */
  entityIdPath?: string;
}

/** Marks a mutating route for automatic audit-log capture on success. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
