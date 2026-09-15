"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Guest } from "@/lib/types";

export default function GuestsPage() {
  const [search, setSearch] = useState("");
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", country: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      setGuests(await apiFetch<Guest[]>(`/guests${qs}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    load();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/guests", { method: "POST", body: form });
      setShowForm(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", country: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Guests</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New guest"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={onCreate} className="card mt-4 grid grid-cols-2 gap-3 p-5">
          <div>
            <label className="label" htmlFor="guest-first-name">
              First name
            </label>
            <input
              id="guest-first-name"
              required
              placeholder="First name"
              className="input"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="guest-last-name">
              Last name
            </label>
            <input
              id="guest-last-name"
              required
              placeholder="Last name"
              className="input"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="guest-email">
              Email
            </label>
            <input
              id="guest-email"
              required
              type="email"
              placeholder="Email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="guest-phone">
              Phone (optional)
            </label>
            <input
              id="guest-phone"
              placeholder="Phone (optional)"
              className="input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="guest-country">
              Country (optional)
            </label>
            <input
              id="guest-country"
              placeholder="Country (optional)"
              className="input"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Saving…" : "Save guest"}
            </button>
          </div>
        </form>
      )}

      <form onSubmit={onSearch} className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="guest-search">
          Search guests
        </label>
        <input
          id="guest-search"
          className="input max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="mt-4 overflow-x-auto">
        {guests === null && <p className="text-sm text-slate-500">Loading…</p>}
        {guests?.length === 0 && <p className="text-sm text-slate-500">No guests found.</p>}
        {guests && guests.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Country</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">
                    {g.firstName} {g.lastName}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{g.email}</td>
                  <td className="py-2 pr-4 text-slate-600">{g.phone ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{g.country ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
