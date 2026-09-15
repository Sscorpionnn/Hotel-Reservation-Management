"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatCents, type RoomTypeAvailability } from "@hrms/shared";
import type { Guest, Hotel, Reservation } from "@/lib/types";

export default function BookingPage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [results, setResults] = useState<RoomTypeAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [bookingRoomType, setBookingRoomType] = useState<RoomTypeAvailability | null>(null);

  useEffect(() => {
    apiFetch<Hotel[]>("/hotels")
      .then((hs) => {
        setHotels(hs);
        setHotelId((current) => current || hs[0]?.id || "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"));
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setSearching(true);
    try {
      const data = await apiFetch<RoomTypeAvailability[]>(
        `/hotels/${hotelId}/availability?checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`,
      );
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New booking</h1>
      <p className="mt-1 text-sm text-slate-500">Search availability, then hold a room for a guest.</p>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={onSearch} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
        <div>
          <label className="label" htmlFor="booking-hotel">
            Hotel
          </label>
          <select
            id="booking-hotel"
            className="input min-w-[12rem]"
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
          >
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="booking-check-in">
            Check-in
          </label>
          <input
            id="booking-check-in"
            required
            type="date"
            className="input"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="booking-check-out">
            Check-out
          </label>
          <input
            id="booking-check-out"
            required
            type="date"
            className="input"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
          />
        </div>
        <button type="submit" disabled={searching || !hotelId} className="btn-primary">
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results?.length === 0 && <p className="text-sm text-slate-500">No room types found for this hotel.</p>}
        {results?.map((r) => (
          <div key={r.roomTypeId} className="card p-5">
            <p className="font-medium text-slate-900">{r.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {r.nights} night(s) · {r.availableRooms} room(s) available
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{formatCents(r.totalPriceCents, r.currency)}</p>
            <button
              className="btn-primary mt-4 w-full"
              disabled={r.availableRooms === 0}
              onClick={() => setBookingRoomType(r)}
            >
              {r.availableRooms === 0 ? "Sold out" : "Book"}
            </button>
          </div>
        ))}
      </div>

      {bookingRoomType && (
        <BookingForm
          hotelId={hotelId}
          roomType={bookingRoomType}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          onClose={() => setBookingRoomType(null)}
          onBooked={(reservation) => router.push(`/reservations/${reservation.id}`)}
        />
      )}
    </div>
  );
}

function BookingForm({
  hotelId,
  roomType,
  checkInDate,
  checkOutDate,
  onClose,
  onBooked,
}: {
  hotelId: string;
  roomType: RoomTypeAvailability;
  checkInDate: string;
  checkOutDate: string;
  onClose: () => void;
  onBooked: (reservation: Reservation) => void;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [guestSearch, setGuestSearch] = useState("");
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [newGuest, setNewGuest] = useState({ email: "", firstName: "", lastName: "", phone: "", country: "" });
  const [showNewGuestForm, setShowNewGuestForm] = useState(false);
  const [details, setDetails] = useState({ adults: 1, children: 0, roomsRequested: 1, promotionCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (guestSearch.trim().length < 2) {
      setGuestResults([]);
      return;
    }
    const handle = setTimeout(() => {
      apiFetch<Guest[]>(`/guests?search=${encodeURIComponent(guestSearch)}`)
        .then(setGuestResults)
        .catch(() => setGuestResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [guestSearch]);

  async function createGuestThenBook(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const guest = await apiFetch<Guest>("/guests", { method: "POST", body: newGuest });
      await submitBooking(guest.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  async function submitBooking(guestId: string) {
    setError(null);
    setSubmitting(true);
    try {
      const reservation = await apiFetch<Reservation>("/reservations", {
        method: "POST",
        body: {
          hotelId,
          roomTypeId: roomType.roomTypeId,
          guestId,
          checkInDate,
          checkOutDate,
          roomsRequested: details.roomsRequested,
          adults: details.adults,
          children: details.children,
          promotionCode: details.promotionCode || undefined,
          idempotencyKey,
        },
      });
      onBooked(reservation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Book {roomType.name}</h2>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {!showNewGuestForm ? (
          <div className="mt-4">
            <label className="label" htmlFor="booking-guest-search">
              Find guest
            </label>
            <input
              id="booking-guest-search"
              className="input"
              placeholder="Search by name or email…"
              value={guestSearch}
              onChange={(e) => {
                setGuestSearch(e.target.value);
                setSelectedGuestId(null);
              }}
            />
            {guestResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                {guestResults.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGuestId(g.id);
                      setGuestSearch(`${g.firstName} ${g.lastName} (${g.email})`);
                      setGuestResults([]);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      selectedGuestId === g.id ? "bg-brand-50" : ""
                    }`}
                  >
                    {g.firstName} {g.lastName} · {g.email}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand-700 hover:underline"
              onClick={() => setShowNewGuestForm(true)}
            >
              + New guest instead
            </button>
          </div>
        ) : (
          <form onSubmit={createGuestThenBook} className="mt-4 grid grid-cols-2 gap-3">
            <label className="sr-only" htmlFor="new-guest-first-name">
              First name
            </label>
            <input
              id="new-guest-first-name"
              required
              placeholder="First name"
              className="input"
              value={newGuest.firstName}
              onChange={(e) => setNewGuest((g) => ({ ...g, firstName: e.target.value }))}
            />
            <label className="sr-only" htmlFor="new-guest-last-name">
              Last name
            </label>
            <input
              id="new-guest-last-name"
              required
              placeholder="Last name"
              className="input"
              value={newGuest.lastName}
              onChange={(e) => setNewGuest((g) => ({ ...g, lastName: e.target.value }))}
            />
            <label className="sr-only" htmlFor="new-guest-email">
              Email
            </label>
            <input
              id="new-guest-email"
              required
              type="email"
              placeholder="Email"
              className="input col-span-2"
              value={newGuest.email}
              onChange={(e) => setNewGuest((g) => ({ ...g, email: e.target.value }))}
            />
            <label className="sr-only" htmlFor="new-guest-phone">
              Phone (optional)
            </label>
            <input
              id="new-guest-phone"
              placeholder="Phone (optional)"
              className="input"
              value={newGuest.phone}
              onChange={(e) => setNewGuest((g) => ({ ...g, phone: e.target.value }))}
            />
            <label className="sr-only" htmlFor="new-guest-country">
              Country (optional)
            </label>
            <input
              id="new-guest-country"
              placeholder="Country (optional)"
              className="input"
              value={newGuest.country}
              onChange={(e) => setNewGuest((g) => ({ ...g, country: e.target.value }))}
            />
            <div className="col-span-2 flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-800"
                onClick={() => setShowNewGuestForm(false)}
              >
                Back to search
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Booking…" : "Save guest & book"}
              </button>
            </div>
          </form>
        )}

        {!showNewGuestForm && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="booking-rooms-requested">
                Rooms
              </label>
              <input
                id="booking-rooms-requested"
                type="number"
                min={1}
                className="input"
                value={details.roomsRequested}
                onChange={(e) => setDetails((d) => ({ ...d, roomsRequested: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="booking-adults">
                Adults
              </label>
              <input
                id="booking-adults"
                type="number"
                min={1}
                className="input"
                value={details.adults}
                onChange={(e) => setDetails((d) => ({ ...d, adults: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="booking-children">
                Children
              </label>
              <input
                id="booking-children"
                type="number"
                min={0}
                className="input"
                value={details.children}
                onChange={(e) => setDetails((d) => ({ ...d, children: Number(e.target.value) }))}
              />
            </div>
            <div className="col-span-3">
              <label className="label" htmlFor="booking-promotion-code">
                Promotion code (optional)
              </label>
              <input
                id="booking-promotion-code"
                className="input"
                value={details.promotionCode}
                onChange={(e) => setDetails((d) => ({ ...d, promotionCode: e.target.value }))}
              />
            </div>
            <div className="col-span-3">
              <button
                disabled={!selectedGuestId || submitting}
                className="btn-primary w-full"
                onClick={() => selectedGuestId && submitBooking(selectedGuestId)}
              >
                {submitting ? "Booking…" : "Hold reservation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
