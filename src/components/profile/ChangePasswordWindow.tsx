"use client";

import { useState, type FormEvent } from "react";
import { AboutWindow } from "@/components/about/AboutWindow";
import { PasswordField } from "@/components/auth/PasswordField";
import { MIN_PASSWORD_LENGTH } from "@/lib/profile/password";

/**
 * Password reset for a signed-in player: current password, then the new one
 * twice. The repeat-it match is a client-side typo guard only (the API never
 * needs it), same as on signup; the server checks the current password and
 * the new one's rules.
 */
export function ChangePasswordWindow() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (next !== repeat) {
      setMessage({ kind: "error", text: "The new passwords don't match" });
      return;
    }

    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage({ kind: "error", text: data?.error ?? "Couldn't change your password. Try again." });
        return;
      }
      setCurrent("");
      setNext("");
      setRepeat("");
      setMessage({ kind: "success", text: "Password changed. Use the new one next time you log in." });
    } catch {
      setMessage({ kind: "error", text: "Couldn't reach the server. Check your connection." });
    } finally {
      setSubmitting(false);
    }
  }

  const color = message?.kind === "success" ? "var(--success)" : "var(--danger)";

  return (
    <AboutWindow title="Change password" delay={0.1}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />
        <PasswordField
          label="Repeat new password"
          value={repeat}
          onChange={setRepeat}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
            style={{ borderColor: color, color }}
            className="rounded-xl border-2 px-4 py-2.5 text-sm font-semibold leading-snug"
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? "Changing..." : "Change password"}
        </button>
      </form>
    </AboutWindow>
  );
}
