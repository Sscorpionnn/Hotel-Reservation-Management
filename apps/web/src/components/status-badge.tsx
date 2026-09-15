const COLORS: Record<string, string> = {
  HELD: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  CHECKED_IN: "bg-blue-100 text-blue-800",
  CHECKED_OUT: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-200 text-slate-600",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OUT_OF_SERVICE: "bg-red-100 text-red-700",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  DIRTY: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  CLEAN: "bg-emerald-100 text-emerald-800",
  INSPECTED: "bg-brand-100 text-brand-800",
  PENDING: "bg-amber-100 text-amber-800",
  CAPTURED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  SUSPENDED: "bg-red-100 text-red-700",
  INVITED: "bg-amber-100 text-amber-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
