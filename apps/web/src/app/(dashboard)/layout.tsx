"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <DashboardNav role={user.role} onLogout={logout} userLabel={`${user.firstName} ${user.lastName}`} />
      <main className="flex-1 bg-slate-50 p-6 lg:p-10">{children}</main>
    </div>
  );
}
