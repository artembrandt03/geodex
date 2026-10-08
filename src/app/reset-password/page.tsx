"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";

function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Only a typo guard -- the API never needs the confirmation value.
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <div>
          <h1 className="font-display text-2xl font-bold">Link not working</h1>
          <p className="mt-2 text-sm text-danger">This reset link isn&apos;t valid.</p>
        </div>
        <Link
          href="/forgot-password"
          className="rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div>
        <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted">At least 8 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-danger">
            {error}{" "}
            {/* An expired or used link can only be fixed by asking for another. */}
            {error.includes("link") && (
              <Link href="/forgot-password" className="underline underline-offset-4">
                Request a new link
              </Link>
            )}
          </p>
        )}

        <motion.button
          whileHover={{ scale: submitting ? 1 : 1.02 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Change password"}
        </motion.button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
