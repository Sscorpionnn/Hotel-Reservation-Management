"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Hotel } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

export default function HotelsPage() {
  const { user } = useAuth();
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      setHotels(await apiFetch<Hotel[]>("/hotels"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hotels</h1>
          <p className="mt-1 text-sm text-slate-500">Properties in your organization.</p>
        </div>
        {user?.role === "ORG_ADMIN" && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New hotel"}
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <CreateHotelForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hotels === null && <p className="text-sm text-slate-500">Loading…</p>}
        {hotels?.length === 0 && <p className="text-sm text-slate-500">No hotels yet.</p>}
        {hotels?.map((hotel) => (
          <Link key={hotel.id} href={`/hotels/${hotel.id}`} className="card block p-5 hover:shadow-md">
            <p className="font-medium text-slate-900">{hotel.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {hotel.city}, {hotel.country}
            </p>
            <p className="mt-2 text-xs text-slate-400">{hotel.currency}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CreateHotelForm({ onCreated, onError }: { onCreated: () => void; onError: (e: string | null) => void }) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    timezone: "UTC",
    currency: "USD",
    addressLine: "",
    city: "",
    country: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    setSubmitting(true);
    try {
      await apiFetch("/hotels", { method: "POST", body: form });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="hotel-name">
          Name
        </label>
        <input
          id="hotel-name"
          required
          className="input"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="hotel-slug">
          Slug
        </label>
        <input
          id="hotel-slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          className="input"
          value={form.slug}
          onChange={(e) => update("slug", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="hotel-timezone">
          Timezone
        </label>
        <input
          id="hotel-timezone"
          required
          className="input"
          value={form.timezone}
          onChange={(e) => update("timezone", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="hotel-currency">
          Currency
        </label>
        <select
          id="hotel-currency"
          className="input"
          value={form.currency}
          onChange={(e) => update("currency", e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="hotel-address">
          Address
        </label>
        <input
          id="hotel-address"
          required
          className="input"
          value={form.addressLine}
          onChange={(e) => update("addressLine", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="hotel-city">
          City
        </label>
        <input
          id="hotel-city"
          required
          className="input"
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="hotel-country">
          Country
        </label>
        <input
          id="hotel-country"
          required
          className="input"
          value={form.country}
          onChange={(e) => update("country", e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Creating…" : "Create hotel"}
        </button>
      </div>
    </form>
  );
}
