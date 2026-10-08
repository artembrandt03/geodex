"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";

type State = { status: "working" } | { status: "done" } | { status: "failed"; message: string };

function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>(
    token ? { status: "working" } : { status: "failed", message: "This confirmation link isn't valid." },
  );
  // A link works once, so the request must go out exactly once (StrictMode runs effects twice in dev).
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    fetch("/api/account/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (response.ok) return setState({ status: "done" });
        const data = await response.json().catch(() => ({}));
        setState({ status: "failed", message: data.error ?? "Something went wrong." });
      })
      .catch(() => setState({ status: "failed", message: "Something went wrong. Please try again." }));
  }, [token]);

  return (
    <AuthCard>
      {state.status === "working" && (
        <div>
          <h1 className="font-display text-2xl font-bold">Confirming...</h1>
          <p className="mt-2 text-sm text-muted">One moment while we confirm your email.</p>
        </div>
      )}

      {state.status === "done" && (
        <>
          <div>
            <h1 className="font-display text-2xl font-bold">Email confirmed</h1>
            <p className="mt-2 text-sm text-muted">Your account is active. Log in to start playing.</p>
          </div>
          <Link
            href="/login?verified=1"
            className="rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground"
          >
            Log in
          </Link>
        </>
      )}

      {state.status === "failed" && (
        <>
          <div>
            <h1 className="font-display text-2xl font-bold">Link not working</h1>
            <p className="mt-2 text-sm text-danger">{state.message}</p>
          </div>
          <p className="text-sm text-muted">
            Log in and we&apos;ll offer to send you a new one. If you&apos;ve already confirmed, you can just log
            in.
          </p>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground"
          >
            Go to log in
          </Link>
        </>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
