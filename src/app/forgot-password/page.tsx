"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthCard } from "@/components/auth/AuthCard";

function ForgotPassword() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard>
        <div>
          <h1 className="font-display text-2xl font-bold">Check your email</h1>
          {/* Worded to be true whether or not the address has an account, so it can't be used to find out. */}
          <p className="mt-2 text-sm text-muted">
            If <strong className="text-foreground">{sentTo}</strong> has a Geodex account, we sent it a link to
            reset the password. It works for 1 hour. It can take a minute, and check your spam folder.
          </p>
        </div>
        <Link href="/login" className="text-center text-sm text-primary underline underline-offset-4">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div>
        <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your account&apos;s email and we&apos;ll send you a link to choose a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 outline-none focus:border-primary"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <motion.button
          whileHover={{ scale: submitting ? 1 : 1.02 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send reset link"}
        </motion.button>
      </form>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-primary underline underline-offset-4">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}
