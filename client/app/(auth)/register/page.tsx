"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

type AuthValue = {
  user: Record<string, unknown> | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<unknown>;
};

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, register } = (useAuth() as unknown) as AuthValue;
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(displayName, email, password);
      router.replace("/dashboard");
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setError(m || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-gray-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-gray-600 mb-6">Start messaging in minutes</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : null}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating..." : "Create account"}
          </Button>
        </form>
        <div className="text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <a className="underline" href="/login">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
