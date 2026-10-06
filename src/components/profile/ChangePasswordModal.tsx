"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/auth/PasswordField";
import { MIN_PASSWORD_LENGTH } from "@/lib/profile/password";

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Change password">
      {/* Mounted only while open, so every opening starts from a blank form. */}
      <ChangePasswordForm onClose={onClose} />
    </Modal>
  );
}

/**
 * Password reset for a signed-in player: current password, then the new one
 * twice. The repeat-it match is a client-side typo guard only (the API never
 * needs it), same as on signup; the server checks the current password and
 * the new one's rules.
 */
function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (next !== repeat) {
      setError("The new passwords don't match");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't change your password. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span
          aria-hidden
          style={{ borderColor: "var(--success)" }}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl text-success"
        >
          ✓
        </span>
        <p className="font-display text-xl font-semibold">Password changed</p>
        <p className="max-w-xs leading-relaxed text-muted">Use the new one next time you log in.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    );
  }

  return (
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

      {error && (
        <p
          role="alert"
          // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
          style={{ borderColor: "var(--danger)" }}
          className="rounded-xl border-2 px-4 py-2.5 text-sm font-semibold leading-snug text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-strong px-4 py-2.5 transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? "Changing..." : "Change password"}
        </button>
      </div>
    </form>
  );
}
