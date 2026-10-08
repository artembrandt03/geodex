"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

/** "Send the confirmation email again" for an unconfirmed address. The server answers the same way whatever the address, and rate limits it. */
export function ResendVerification({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setStatus("sending");
    setMessage(null);
    try {
      const response = await fetch("/api/account/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setStatus("sent");
        return;
      }
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <button
        type="button"
        onClick={resend}
        disabled={status === "sending"}
        className="self-start text-primary underline underline-offset-4 disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : status === "sent" ? "Send it again" : "Resend the confirmation email"}
      </button>
      {status === "sent" && <p className="text-muted">Sent. It can take a minute, and check your spam folder.</p>}
      {status === "error" && message && <p className="text-danger">{message}</p>}
    </div>
  );
}
