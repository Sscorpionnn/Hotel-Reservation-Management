"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@hrms/shared";
import { apiFetch, setAccessToken, ApiError } from "./api-client";

export interface CurrentUser {
  userId: string;
  organizationId: string;
  hotelId: string | null;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    // On first load we have no in-memory access token, but a valid
    // refresh cookie may still exist — /auth/me will 401, apiFetch will
    // transparently try /auth/refresh once, then retry.
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAccessToken(result.accessToken);
      await refreshUser();
      router.push("/dashboard");
    },
    [refreshUser, router],
  );

  const logout = useCallback(async () => {
    const csrfToken = readCookie("csrf_token");
    await apiFetch("/auth/logout", {
      method: "POST",
      skipAuthRetry: true,
      headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
    }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
