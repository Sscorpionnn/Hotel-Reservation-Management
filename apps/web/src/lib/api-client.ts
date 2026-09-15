"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function refreshAccessToken(): Promise<string | null> {
  const csrfToken = readCookie("csrf_token");
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
  });
  if (!res.ok) {
    accessToken = null;
    return null;
  }
  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  skipAuthRetry?: boolean;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> =>
    fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuthRetry) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let payload: { code?: string; message?: string } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, payload.code ?? "UNKNOWN", payload.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { API_URL };
