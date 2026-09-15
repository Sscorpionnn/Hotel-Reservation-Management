"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Welcome back{user ? `, ${user.firstName}` : ""}</h1>
      <p className="mt-1 text-sm text-slate-500">Here&apos;s a quick jumping-off point for what you can do next.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/booking" title="Create a booking" description="Search availability and hold a room." />
        <QuickLink href="/reservations" title="Manage reservations" description="Confirm, check in/out, or cancel." />
        <QuickLink href="/hotels" title="Manage hotels" description="Room types, rooms, rates and amenities." />
        <QuickLink href="/guests" title="Guests" description="Look up or add guest profiles." />
        <QuickLink href="/housekeeping" title="Housekeeping" description="Track room cleaning status." />
        <QuickLink href="/promotions" title="Promotions" description="Manage discount codes." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="card block p-5 transition-shadow hover:shadow-md">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}
