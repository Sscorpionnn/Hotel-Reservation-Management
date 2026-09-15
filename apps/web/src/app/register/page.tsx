"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({
    organizationName: "",
    organizationSlug: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/register-organization", { method: "POST", body: form });
      await login(form.email, form.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create organization");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your organization</h1>
          <p className="mt-1 text-sm text-slate-500">You&apos;ll be the first organization admin</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="organization-name">
                Organization name
              </label>
              <input
                id="organization-name"
                required
                className="input"
                value={form.organizationName}
                onChange={(e) => update("organizationName", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="organization-slug">
                Slug
              </label>
              <input
                id="organization-slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="lowercase letters, digits and hyphens"
                className="input"
                value={form.organizationSlug}
                onChange={(e) => update("organizationSlug", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="register-first-name">
                First name
              </label>
              <input
                id="register-first-name"
                required
                className="input"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="register-last-name">
                Last name
              </label>
              <input
                id="register-last-name"
                required
                className="input"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              required
              minLength={12}
              className="input"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              At least 12 characters, with upper, lower, digit and symbol.
            </p>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating…" : "Create organization"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
