"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { LegalLinks } from "@/components/legal/LegalLinks";
import {
  EMAIL_NOT_VERIFIED_CODE,
  parseRateLimitedCode,
  rateLimitedMessage,
} from "@/lib/authLimits";

/** What the login page says when it's reached from another step, via ?exists / ?verified / ?reset. */
function noticeFor(params: URLSearchParams): string | null {
  if (params.get("exists")) return "You already have an account with that email. Log in below, or reset your password if you've forgotten it.";
  if (params.get("verified")) return "Your email is confirmed. You can log in now.";
  if (params.get("reset")) return "Your password was changed. Log in with the new one.";
  return null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The address whose password was right but whose email isn't confirmed yet.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notice = noticeFor(params);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.code === EMAIL_NOT_VERIFIED_CODE) {
          setUnconfirmedEmail(email.trim());
          return;
        }
        // A refused-for-too-many-failures attempt carries the wait in its code.
        const waitMinutes = parseRateLimitedCode(result.code);
        setError(waitMinutes ? rateLimitedMessage(waitMinutes) : "Invalid email or password");
        return;
      }

      router.push("/setup");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="font-display text-2xl font-bold">Log in</h1>

      {notice && !unconfirmedEmail && <p className="text-sm text-muted">{notice}</p>}

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

        <div className="flex flex-col gap-1.5">
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <Link
            href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
            className="self-end text-sm text-primary underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {unconfirmedEmail && (
          <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-3 text-sm">
            <p>
              Please confirm your email first. We sent a link to <strong>{unconfirmedEmail}</strong> when you
              signed up.
            </p>
            <ResendVerification email={unconfirmedEmail} />
          </div>
        )}

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
      <LegalLinks />
    </AuthCard>
  );
}

// useSearchParams needs a Suspense boundary so the page can still be prerendered.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
