"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { MINIMUM_AGE } from "@/lib/legal";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once the account is created: the next step is the email, not the game.
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password, acceptTerms: acceptedTerms }),
      });

      const data = await response.json();

      // A confirmed account already has this address: send them to log in.
      if (response.status === 409 && data.code === "account_exists") {
        router.push(`/login?exists=1&email=${encodeURIComponent(email.trim())}`);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      // No auto sign-in: the account only works once the emailed link is clicked.
      setSentTo(email.trim().toLowerCase());
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard>
        <div>
          <h1 className="font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it to
            activate your account, then log in. The link works for 24 hours.
          </p>
        </div>
        <ResendVerification email={sentTo} />
        <p className="text-center text-sm text-muted">
          Wrong address?{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-primary underline underline-offset-4"
          >
            Go back
          </button>{" "}
          or{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            log in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
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

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        {/* Required, and checked again on the server: consent to collecting an
            account's personal information has to be clear and deliberate. The links
            open in a new tab so reading them doesn't lose the half-filled form. */}
        <label className="flex items-start gap-2.5 text-sm leading-snug">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            I am at least {MINIMUM_AGE} years old and I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="text-primary underline underline-offset-4"
            >
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="text-primary underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            .
          </span>
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
    </AuthCard>
  );
}
