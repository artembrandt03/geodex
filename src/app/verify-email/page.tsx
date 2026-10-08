"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";

type State = { status: "working" } | { status: "done"; loginToken: string | null } | { status: "failed"; message: string };

function VerifyEmail() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
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
        const data = await response.json().catch(() => ({}));
        if (response.ok) return setState({ status: "done", loginToken: data.loginToken ?? null });
        setState({ status: "failed", message: data.error ?? "Something went wrong." });
      })
      .catch(() => setState({ status: "failed", message: "Something went wrong. Please try again." }));
  }, [token]);

  // The ticket from the confirmation stands in for the password, once, for a few minutes.
  async function logIn(loginToken: string) {
    setLoggingIn(true);
    setLoginFailed(false);
    try {
      const result = await signIn("autologin", { token: loginToken, redirect: false });
      if (result?.error) {
        setLoginFailed(true);
        return;
      }
      router.push("/setup");
      router.refresh();
    } catch {
      setLoginFailed(true);
    } finally {
      setLoggingIn(false);
    }
  }

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
          {state.loginToken && !loginFailed ? (
            <button
              type="button"
              onClick={() => logIn(state.loginToken!)}
              disabled={loggingIn}
              className="rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loggingIn ? "Logging in..." : "Log in to my account"}
            </button>
          ) : (
            <>
              {loginFailed && (
                <p className="text-sm text-muted">
                  That quick login has expired. Log in with your password instead.
                </p>
              )}
              <Link
                href="/login?verified=1"
                className="rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground"
              >
                Log in
              </Link>
            </>
          )}
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
