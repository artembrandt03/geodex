"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { MapBackdrop } from "@/components/layout/MapBackdrop";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created. Please log in.");
        router.push("/login");
        return;
      }

      router.push("/setup");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapBackdrop />
      <div className="relative z-10 flex h-full items-center justify-center overflow-y-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-md"
        >
          <div>
            <h1 className="font-display text-2xl font-bold">Create an account</h1>
            <p className="mt-2 text-sm text-muted">
              Register to save your scores on the leaderboard. You can also{" "}
              <Link href="/setup" className="text-primary underline underline-offset-4">
                play as a guest
              </Link>{" "}
              without an account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Display name
              <input
                required
                minLength={2}
                maxLength={30}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 outline-none focus:border-primary"
              />
            </label>

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

            <label className="flex flex-col gap-1 text-sm">
              Password
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {submitting ? "Creating account..." : "Sign up"}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline underline-offset-4">
              Log in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
