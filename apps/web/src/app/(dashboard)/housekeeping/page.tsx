"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/status-badge";
import type { Hotel, HousekeepingTask } from "@/lib/types";

const STATUSES: HousekeepingTask["status"][] = [
  "DIRTY",
  "IN_PROGRESS",
  "CLEAN",
  "INSPECTED",
  "OUT_OF_SERVICE",
];

export default function HousekeepingPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState("");
  const [tasks, setTasks] = useState<HousekeepingTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Hotel[]>("/hotels")
      .then((hs) => {
        setHotels(hs);
        setHotelId((current) => current || hs[0]?.id || "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"));
  }, []);

  async function load() {
    if (!hotelId) return;
    try {
      setTasks(await apiFetch<HousekeepingTask[]>(`/hotels/${hotelId}/housekeeping-tasks`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  async function updateStatus(taskId: string, status: HousekeepingTask["status"]) {
    setError(null);
    try {
      await apiFetch(`/hotels/${hotelId}/housekeeping-tasks/${taskId}`, { method: "PATCH", body: { status } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Housekeeping</h1>
      <p className="mt-1 text-sm text-slate-500">Room cleaning status by hotel.</p>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4">
        <label className="label" htmlFor="housekeeping-hotel">
          Hotel
        </label>
        <select
          id="housekeeping-hotel"
          className="input max-w-xs"
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

      <div className="mt-6 overflow-x-auto">
        {tasks === null && <p className="text-sm text-slate-500">Loading…</p>}
        {tasks?.length === 0 && <p className="text-sm text-slate-500">No housekeeping tasks yet.</p>}
        {tasks && tasks.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4">Update</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{task.roomId}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{task.notes ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <label className="sr-only" htmlFor={`housekeeping-status-${task.id}`}>
                      Status for room {task.roomId}
                    </label>
                    <select
                      id={`housekeeping-status-${task.id}`}
                      className="input max-w-[10rem]"
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value as HousekeepingTask["status"])}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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
