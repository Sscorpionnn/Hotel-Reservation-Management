"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReservationsLookupPage() {
  const router = useRouter();
  const [id, setId] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (id.trim()) router.push(`/reservations/${id.trim()}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reservations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Look up a reservation by id, or start a new one from the booking flow.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 max-w-lg p-5">
        <label className="label" htmlFor="reservation-lookup-id">
          Reservation id
        </label>
        <div className="flex gap-2">
          <input
            id="reservation-lookup-id"
            className="input"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Reservation UUID"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={!id.trim()}>
            Open
          </button>
        </div>
      </form>
    </div>
  );
}
