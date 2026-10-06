"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { PasswordField } from "@/components/auth/PasswordField";

export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Delete your account">
      {/* Mounted only while open, so it always starts from a blank, unarmed form. */}
      <DeleteAccountForm onClose={onClose} />
    </Modal>
  );
}

/**
 * Two deliberate steps before anything is deleted: type the password, then
 * hold the button down for two seconds. The password is checked again on the
 * server, so the hold is a guard against slips, not the only line of defense.
 */
function DeleteAccountForm({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function deleteAccount() {
    if (deleting) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't delete your account. Try again.");
        return;
      }
      setDeleted(true);
      // Their session is for an account that no longer exists; sign out and head home.
      setTimeout(() => void signOut({ callbackUrl: "/" }), 1200);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="font-display text-xl font-semibold">Your account has been deleted</p>
        <p className="text-muted">Taking you back to the start...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
        style={{ borderColor: "var(--danger)" }}
        className="rounded-xl border-2 bg-danger/10 px-4 py-3 text-sm leading-relaxed"
      >
        <p className="font-semibold text-danger">This can&apos;t be undone.</p>
        <p className="mt-1">
          Your account, your match history and your place on the leaderboards will be permanently
          deleted.
        </p>
      </div>

      <PasswordField
        label="Enter your password to confirm"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {error && (
        <p
          role="alert"
          style={{ borderColor: "var(--danger)" }}
          className="rounded-xl border-2 px-4 py-2.5 text-sm font-semibold leading-snug text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col items-end gap-2">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-strong px-4 py-2.5 transition-colors hover:bg-surface-2"
          >
            Keep my account
          </button>
          <HoldToConfirmButton
            onConfirm={() => void deleteAccount()}
            disabled={password.length === 0 || deleting}
            holdingLabel="Deleting in a moment..."
          >
            Hold to delete
          </HoldToConfirmButton>
        </div>
        <p className="text-xs text-muted-2">
          {password.length === 0
            ? "Enter your password to unlock the delete button."
            : "Press and hold the button for two seconds."}
        </p>
      </div>
    </div>
  );
}
