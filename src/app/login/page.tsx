"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { MapBackdrop } from "@/components/layout/MapBackdrop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
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
          <h1 className="font-display text-2xl font-bold">Log in</h1>

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

            <label className="flex flex-col gap-1 text-sm">
              Password
              <input
                required
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
              {submitting ? "Logging in..." : "Log in"}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
