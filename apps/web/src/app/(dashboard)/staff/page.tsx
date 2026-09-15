"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";
import type { UserRole } from "@hrms/shared";
import type { Hotel, StaffUser } from "@/lib/types";

const ROLES: UserRole[] = ["ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF", "GUEST_PORTAL"];
const HOTEL_SCOPED_ROLES: UserRole[] = ["HOTEL_MANAGER", "FRONT_DESK_AGENT", "HOUSEKEEPING_STAFF"];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "FRONT_DESK_AGENT" as UserRole,
    hotelId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [roleEdits, setRoleEdits] = useState<Record<string, { role: UserRole; hotelId: string }>>({});

  async function load() {
    try {
      const [staffRes, hotelsRes] = await Promise.all([
        apiFetch<StaffUser[]>("/users"),
        apiFetch<Hotel[]>("/hotels"),
      ]);
      setStaff(staffRes);
      setHotels(hotelsRes);
      setForm((f) => ({ ...f, hotelId: f.hotelId || hotelsRes[0]?.id || "" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const requiresHotel = HOTEL_SCOPED_ROLES.includes(form.role);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/users", {
        method: "POST",
        body: { ...form, hotelId: requiresHotel ? form.hotelId : undefined },
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function suspend(id: string) {
    setError(null);
    try {
      await apiFetch(`/users/${id}/suspend`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function saveRole(id: string) {
    const edit = roleEdits[id];
    if (!edit) return;
    setError(null);
    try {
      await apiFetch(`/users/${id}/role`, {
        method: "PATCH",
        body: {
          role: edit.role,
          hotelId: HOTEL_SCOPED_ROLES.includes(edit.role) ? edit.hotelId : undefined,
        },
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function editFor(user: StaffUser) {
    return roleEdits[user.id] ?? { role: user.role, hotelId: user.hotelId ?? hotels[0]?.id ?? "" };
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ New staff member"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={onCreate} className="card mt-4 grid grid-cols-2 gap-3 p-5">
          <div>
            <label className="label" htmlFor="staff-first-name">
              First name
            </label>
            <input
              id="staff-first-name"
              required
              placeholder="First name"
              className="input"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="staff-last-name">
              Last name
            </label>
            <input
              id="staff-last-name"
              required
              placeholder="Last name"
              className="input"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="staff-email">
              Email
            </label>
            <input
              id="staff-email"
              required
              type="email"
              placeholder="Email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="staff-password">
              Temporary password
            </label>
            <input
              id="staff-password"
              required
              type="password"
              minLength={12}
              placeholder="Temporary password"
              className="input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="staff-role">
              Role
            </label>
            <select
              id="staff-role"
              className="input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {requiresHotel && (
            <div>
              <label className="label" htmlFor="staff-hotel">
                Hotel
              </label>
              <select
                id="staff-hotel"
                className="input"
                value={form.hotelId}
                onChange={(e) => setForm((f) => ({ ...f, hotelId: e.target.value }))}
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creating…" : "Create staff member"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        {staff === null && <p className="text-sm text-slate-500">Loading…</p>}
        {staff?.length === 0 && <p className="text-sm text-slate-500">No staff yet.</p>}
        {staff && staff.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const edit = editFor(u);
                return (
                  <tr key={u.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-col gap-1">
                        <label className="sr-only" htmlFor={`staff-role-edit-${u.id}`}>
                          Role for {u.firstName} {u.lastName}
                        </label>
                        <select
                          id={`staff-role-edit-${u.id}`}
                          className="input max-w-[11rem]"
                          value={edit.role}
                          onChange={(e) =>
                            setRoleEdits((edits) => ({
                              ...edits,
                              [u.id]: { role: e.target.value as UserRole, hotelId: edit.hotelId },
                            }))
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {HOTEL_SCOPED_ROLES.includes(edit.role) && (
                          <>
                            <label className="sr-only" htmlFor={`staff-hotel-edit-${u.id}`}>
                              Hotel for {u.firstName} {u.lastName}
                            </label>
                            <select
                              id={`staff-hotel-edit-${u.id}`}
                              className="input max-w-[11rem]"
                              value={edit.hotelId}
                              onChange={(e) =>
                                setRoleEdits((edits) => ({
                                  ...edits,
                                  [u.id]: { role: edit.role, hotelId: e.target.value },
                                }))
                              }
                            >
                              {hotels.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        <button className="text-left text-xs font-medium text-brand-700 hover:underline" onClick={() => saveRole(u.id)}>
                          Save role
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {u.status === "ACTIVE" && (
                        <button className="text-sm text-red-600 hover:underline" onClick={() => suspend(u.id)}>
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
