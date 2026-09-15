"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatCents } from "@hrms/shared";
import type { Amenity, Hotel, Room, RoomType } from "@/lib/types";

type Tab = "room-types" | "rooms" | "amenities";

export default function HotelDetailPage() {
  const params = useParams<{ hotelId: string }>();
  const hotelId = params.hotelId;
  const { user } = useAuth();
  const canManage = user?.role === "ORG_ADMIN" || user?.role === "HOTEL_MANAGER";

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [tab, setTab] = useState<Tab>("room-types");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Hotel>(`/hotels/${hotelId}`)
      .then(setHotel)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"));
  }, [hotelId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{hotel?.name ?? "Hotel"}</h1>
      {hotel && (
        <p className="mt-1 text-sm text-slate-500">
          {hotel.addressLine}, {hotel.city}, {hotel.country} · {hotel.currency}
        </p>
      )}

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {(["room-types", "rooms", "amenities"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "room-types" && <RoomTypesTab hotelId={hotelId} canManage={canManage} />}
        {tab === "rooms" && <RoomsTab hotelId={hotelId} canManage={canManage} />}
        {tab === "amenities" && <AmenitiesTab hotelId={hotelId} canManage={canManage} />}
      </div>
    </div>
  );
}

function RoomTypesTab({ hotelId, canManage }: { hotelId: string; canManage: boolean }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    capacityAdults: 2,
    capacityChildren: 0,
    basePriceCents: 10000,
    currency: "USD",
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setRoomTypes(await apiFetch<RoomType[]>(`/hotels/${hotelId}/room-types`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/hotels/${hotelId}/room-types`, { method: "POST", body: form });
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
      {canManage && (
        <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New room type"}
        </button>
      )}
      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="room-type-name">
              Name
            </label>
            <input
              id="room-type-name"
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="room-type-description">
              Description
            </label>
            <input
              id="room-type-description"
              className="input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-type-capacity-adults">
              Adult capacity
            </label>
            <input
              id="room-type-capacity-adults"
              type="number"
              min={1}
              className="input"
              value={form.capacityAdults}
              onChange={(e) => setForm((f) => ({ ...f, capacityAdults: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-type-capacity-children">
              Child capacity
            </label>
            <input
              id="room-type-capacity-children"
              type="number"
              min={0}
              className="input"
              value={form.capacityChildren}
              onChange={(e) => setForm((f) => ({ ...f, capacityChildren: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-type-base-price">
              Base price (cents)
            </label>
            <input
              id="room-type-base-price"
              type="number"
              min={0}
              className="input"
              value={form.basePriceCents}
              onChange={(e) => setForm((f) => ({ ...f, basePriceCents: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-type-currency">
              Currency
            </label>
            <input
              id="room-type-currency"
              className="input"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating…" : "Create room type"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {roomTypes === null && <p className="text-sm text-slate-500">Loading…</p>}
        {roomTypes?.length === 0 && <p className="text-sm text-slate-500">No room types yet.</p>}
        {roomTypes?.map((rt) => (
          <div key={rt.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900">{rt.name}</p>
              <p className="text-sm text-slate-500">
                {rt.capacityAdults} adults · {rt.capacityChildren} children ·{" "}
                {formatCents(rt.basePriceCents, rt.currency)} / night
              </p>
            </div>
            <Link
              href={`/hotels/${hotelId}/room-types/${rt.id}/rates`}
              className="btn-secondary"
            >
              Rate plans
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomsTab({ hotelId, canManage }: { hotelId: string; canManage: boolean }) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ roomTypeId: "", roomNumber: "", floor: 1 });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [roomsRes, roomTypesRes] = await Promise.all([
        apiFetch<Room[]>(`/hotels/${hotelId}/rooms`),
        apiFetch<RoomType[]>(`/hotels/${hotelId}/room-types`),
      ]);
      setRooms(roomsRes);
      setRoomTypes(roomTypesRes);
      setForm((f) => ({ ...f, roomTypeId: f.roomTypeId || roomTypesRes[0]?.id || "" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/hotels/${hotelId}/rooms`, { method: "POST", body: form });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(roomId: string, status: Room["status"]) {
    try {
      await apiFetch(`/hotels/${hotelId}/rooms/${roomId}`, { method: "PATCH", body: { status } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      {canManage && roomTypes.length > 0 && (
        <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New room"}
        </button>
      )}
      {canManage && roomTypes.length === 0 && (
        <p className="text-sm text-slate-500">Create a room type first before adding rooms.</p>
      )}
      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="room-type-select">
              Room type
            </label>
            <select
              id="room-type-select"
              className="input"
              value={form.roomTypeId}
              onChange={(e) => setForm((f) => ({ ...f, roomTypeId: e.target.value }))}
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="room-number">
              Room number
            </label>
            <input
              id="room-number"
              required
              className="input"
              value={form.roomNumber}
              onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="room-floor">
              Floor
            </label>
            <input
              id="room-floor"
              type="number"
              className="input"
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: Number(e.target.value) }))}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating…" : "Create room"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        {rooms === null && <p className="text-sm text-slate-500">Loading…</p>}
        {rooms?.length === 0 && <p className="text-sm text-slate-500">No rooms yet.</p>}
        {rooms && rooms.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Floor</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{room.roomNumber}</td>
                  <td className="py-2 pr-4 text-slate-600">{room.floor ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {canManage ? (
                      <>
                        <label className="sr-only" htmlFor={`room-status-${room.id}`}>
                          Status for room {room.roomNumber}
                        </label>
                        <select
                          id={`room-status-${room.id}`}
                          className="input max-w-[10rem]"
                          value={room.status}
                          onChange={(e) => updateStatus(room.id, e.target.value as Room["status"])}
                        >
                          <option value="AVAILABLE">AVAILABLE</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                          <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                        </select>
                      </>
                    ) : (
                      room.status
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

function AmenitiesTab({ hotelId, canManage }: { hotelId: string; canManage: boolean }) {
  const [amenities, setAmenities] = useState<Amenity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setAmenities(await apiFetch<Amenity[]>(`/hotels/${hotelId}/amenities`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/hotels/${hotelId}/amenities`, { method: "POST", body: form });
      setShowForm(false);
      setForm({ name: "", icon: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {canManage && (
        <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New amenity"}
        </button>
      )}
      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {showForm && (
        <form onSubmit={onSubmit} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="label" htmlFor="amenity-name">
              Name
            </label>
            <input
              id="amenity-name"
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="amenity-icon">
              Icon (optional)
            </label>
            <input
              id="amenity-icon"
              className="input"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Adding…" : "Add amenity"}
          </button>
        </form>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {amenities === null && <p className="text-sm text-slate-500">Loading…</p>}
        {amenities?.length === 0 && <p className="text-sm text-slate-500">No amenities yet.</p>}
        {amenities?.map((a) => (
          <span key={a.id} className="badge bg-slate-100 text-slate-700">
            {a.name}
          </span>
        ))}
      </div>
    </div>
  );
}
