"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatCents } from "@hrms/shared";
import type { RatePlan } from "@/lib/types";

export default function RatePlansPage() {
  const params = useParams<{ hotelId: string; roomTypeId: string }>();
  const { hotelId, roomTypeId } = params;
  const { user } = useAuth();
  const canManage = user?.role === "ORG_ADMIN" || user?.role === "HOTEL_MANAGER";

  const [rates, setRates] = useState<RatePlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    priceCents: 10000,
    currency: "USD",
    minStayNights: 1,
    isRefundable: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const basePath = `/hotels/${hotelId}/room-types/${roomTypeId}/rate-plans`;

  async function load() {
    try {
      setRates(await apiFetch<RatePlan[]>(basePath));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomTypeId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(basePath, { method: "POST", body: form });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Rate plans</h1>
      <p className="mt-1 text-sm text-slate-500">Date-range pricing overrides for this room type.</p>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {canManage && (
        <button className="btn-secondary mt-4" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New rate plan"}
        </button>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="rate-name">
              Name
            </label>
            <input
              id="rate-name"
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rate-start-date">
              Start date
            </label>
            <input
              id="rate-start-date"
              required
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rate-end-date">
              End date
            </label>
            <input
              id="rate-end-date"
              required
              type="date"
              className="input"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rate-price">
              Price (cents)
            </label>
            <input
              id="rate-price"
              type="number"
              min={0}
              className="input"
              value={form.priceCents}
              onChange={(e) => setForm((f) => ({ ...f, priceCents: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rate-currency">
              Currency
            </label>
            <input
              id="rate-currency"
              className="input"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rate-min-stay">
              Min stay (nights)
            </label>
            <input
              id="rate-min-stay"
              type="number"
              min={1}
              className="input"
              value={form.minStayNights}
              onChange={(e) => setForm((f) => ({ ...f, minStayNights: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="refundable"
              type="checkbox"
              checked={form.isRefundable}
              onChange={(e) => setForm((f) => ({ ...f, isRefundable: e.target.checked }))}
            />
            <label htmlFor="refundable" className="text-sm text-slate-700">
              Refundable
            </label>
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating…" : "Create rate plan"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {rates === null && <p className="text-sm text-slate-500">Loading…</p>}
        {rates?.length === 0 && <p className="text-sm text-slate-500">No rate plans yet — base room type price applies.</p>}
        {rates?.map((rate) => (
          <div key={rate.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900">{rate.name}</p>
              <p className="text-sm text-slate-500">
                {new Date(rate.startDate).toLocaleDateString()} – {new Date(rate.endDate).toLocaleDateString()} ·
                min {rate.minStayNights} night(s) · {rate.isRefundable ? "refundable" : "non-refundable"}
              </p>
            </div>
            <p className="font-medium text-slate-900">{formatCents(rate.priceCents, rate.currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
