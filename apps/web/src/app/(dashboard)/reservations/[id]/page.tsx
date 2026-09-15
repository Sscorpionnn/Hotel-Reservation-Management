"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";
import { formatCents } from "@hrms/shared";
import type { PaymentIntent, Reservation } from "@/lib/types";

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  async function load() {
    try {
      setReservation(await apiFetch<Reservation>(`/reservations/${params.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function runAction(path: string, body?: unknown) {
    setError(null);
    setActionPending(true);
    try {
      await apiFetch(`/reservations/${params.id}${path}`, { method: "PATCH", body });
      await load();
      setShowCancelForm(false);
      setCancelReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setActionPending(false);
    }
  }

  async function createPaymentIntent() {
    setError(null);
    setActionPending(true);
    try {
      const intent = await apiFetch<PaymentIntent>("/payments/intents", {
        method: "POST",
        body: { reservationId: params.id, idempotencyKey: crypto.randomUUID() },
      });
      setPaymentIntent(intent);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setActionPending(false);
    }
  }

  if (error && !reservation) {
    return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  }
  if (!reservation) return <p className="text-sm text-slate-500">Loading…</p>;

  const roomIds = [...new Set(reservation.nights.map((n) => n.roomId))];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Reservation</h1>
        <StatusBadge status={reservation.status} />
      </div>
      <p className="mt-1 font-mono text-xs text-slate-400">{reservation.id}</p>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card mt-4 space-y-2 p-5 text-sm">
        <Row label="Stay">
          {new Date(reservation.checkInDate).toLocaleDateString()} –{" "}
          {new Date(reservation.checkOutDate).toLocaleDateString()}
        </Row>
        <Row label="Rooms">{roomIds.length}</Row>
        <Row label="Subtotal">{formatCents(reservation.subtotalCents, reservation.currency)}</Row>
        <Row label="Discount">-{formatCents(reservation.discountCents, reservation.currency)}</Row>
        <Row label="Total">
          <span className="font-semibold">{formatCents(reservation.totalCents, reservation.currency)}</span>
        </Row>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {reservation.status === "HELD" && (
          <>
            <button disabled={actionPending} className="btn-primary" onClick={() => runAction("/confirm")}>
              Confirm
            </button>
            <button disabled={actionPending} className="btn-secondary" onClick={createPaymentIntent}>
              Create payment intent
            </button>
            <button disabled={actionPending} className="btn-danger" onClick={() => setShowCancelForm(true)}>
              Cancel
            </button>
          </>
        )}
        {reservation.status === "CONFIRMED" && (
          <>
            <button disabled={actionPending} className="btn-primary" onClick={() => runAction("/check-in")}>
              Check in
            </button>
            <button disabled={actionPending} className="btn-danger" onClick={() => setShowCancelForm(true)}>
              Cancel
            </button>
          </>
        )}
        {reservation.status === "CHECKED_IN" && (
          <button disabled={actionPending} className="btn-primary" onClick={() => runAction("/check-out")}>
            Check out
          </button>
        )}
        {["CHECKED_OUT", "CANCELLED", "EXPIRED"].includes(reservation.status) && (
          <p className="text-sm text-slate-500">No further actions — this reservation is in a final state.</p>
        )}
      </div>

      {showCancelForm && (
        <div className="card mt-4 p-4">
          <label className="label" htmlFor="cancellation-reason">
            Cancellation reason (optional)
          </label>
          <input
            id="cancellation-reason"
            className="input"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button
              disabled={actionPending}
              className="btn-danger"
              onClick={() => runAction("/cancel", { reason: cancelReason || undefined })}
            >
              Confirm cancellation
            </button>
            <button className="btn-secondary" onClick={() => setShowCancelForm(false)}>
              Back
            </button>
          </div>
        </div>
      )}

      {paymentIntent && (
        <div className="card mt-6 p-4 text-sm">
          <p className="font-medium text-slate-900">Payment intent created</p>
          <p className="mt-1 text-slate-500">
            {paymentIntent.provider} · {formatCents(paymentIntent.amountCents, paymentIntent.currency)} ·{" "}
            <StatusBadge status={paymentIntent.status} />
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Payment intent created (mock provider) — awaiting provider confirmation webhook.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{children}</span>
    </div>
  );
}
