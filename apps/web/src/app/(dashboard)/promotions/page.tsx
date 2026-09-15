"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Promotion } from "@/lib/types";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: 10,
    startsAt: "",
    endsAt: "",
    maxRedemptions: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setPromotions(await apiFetch<Promotion[]>("/promotions"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/promotions", {
        method: "POST",
        body: {
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        },
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await apiFetch(`/promotions/${id}/deactivate`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Promotions</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New promotion"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={onCreate} className="card mt-4 grid grid-cols-2 gap-3 p-5">
          <div>
            <label className="label" htmlFor="promotion-code">
              Code
            </label>
            <input
              id="promotion-code"
              required
              placeholder="Code"
              className="input"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="promotion-discount-type">
              Discount type
            </label>
            <select
              id="promotion-discount-type"
              className="input"
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as typeof f.discountType }))}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount (cents)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="promotion-discount-value">
              Discount value
            </label>
            <input
              id="promotion-discount-value"
              type="number"
              min={1}
              placeholder="Discount value"
              className="input"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="promotion-max-redemptions">
              Max redemptions (optional)
            </label>
            <input
              id="promotion-max-redemptions"
              type="number"
              min={1}
              placeholder="Max redemptions (optional)"
              className="input"
              value={form.maxRedemptions}
              onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="promotion-starts-at">
              Starts
            </label>
            <input
              id="promotion-starts-at"
              required
              type="date"
              className="input"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="promotion-ends-at">
              Ends
            </label>
            <input
              id="promotion-ends-at"
              required
              type="date"
              className="input"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating…" : "Create promotion"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        {promotions === null && <p className="text-sm text-slate-500">Loading…</p>}
        {promotions?.length === 0 && <p className="text-sm text-slate-500">No promotions yet.</p>}
        {promotions && promotions.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Discount</th>
                <th className="py-2 pr-4">Window</th>
                <th className="py-2 pr-4">Redemptions</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{p.code}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : `${p.discountValue}c`}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {new Date(p.startsAt).toLocaleDateString()} – {new Date(p.endsAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {p.redemptionCount}
                    {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{p.isActive ? "Active" : "Inactive"}</td>
                  <td className="py-2 pr-4">
                    {p.isActive && (
                      <button className="text-sm text-red-600 hover:underline" onClick={() => deactivate(p.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
