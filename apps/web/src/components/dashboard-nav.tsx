"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@hrms/shared";

interface NavItem {
  href: string;
  label: string;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/hotels", label: "Hotels", roles: ["ORG_ADMIN", "HOTEL_MANAGER"] },
  { href: "/booking", label: "New booking" },
  { href: "/reservations", label: "Reservations" },
  { href: "/housekeeping", label: "Housekeeping", roles: ["ORG_ADMIN", "HOTEL_MANAGER", "HOUSEKEEPING_STAFF"] },
  { href: "/guests", label: "Guests", roles: ["ORG_ADMIN", "HOTEL_MANAGER", "FRONT_DESK_AGENT"] },
  { href: "/promotions", label: "Promotions", roles: ["ORG_ADMIN", "HOTEL_MANAGER"] },
  { href: "/staff", label: "Staff", roles: ["ORG_ADMIN"] },
];

export function DashboardNav({
  role,
  userLabel,
  onLogout,
}: {
  role: UserRole;
  userLabel: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-lg font-semibold tracking-tight text-slate-900">Aurora HRMS</p>
        <p className="mt-0.5 text-xs text-slate-400">{role.replaceAll("_", " ")}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-medium text-slate-700">{userLabel}</p>
        <button onClick={onLogout} className="mt-2 text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </div>
    </aside>
  );
}
