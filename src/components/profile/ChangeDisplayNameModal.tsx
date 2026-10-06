"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/profile/displayName";

export function ChangeDisplayNameModal({
  open,
  onClose,
  currentName,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  /** Called after the name is saved, so the page and the nav bar can show it. */
  onChanged: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Change display name">
      {/* Mounted only while open, so every opening starts fresh. */}
      <DisplayNameForm onClose={onClose} currentName={currentName} onChanged={onChanged} />
    </Modal>
  );
}

function DisplayNameForm({
  onClose,
  currentName,
  onChanged,
}: {
  onClose: () => void;
  currentName: string;
  onChanged: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unchanged = name.trim() === currentName;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || unchanged) return;

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't change your display name. Try again.");
        return;
      }
      onChanged();
      onClose();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted">
        This is the name shown on the leaderboards. It can be {DISPLAY_NAME_MIN} to{" "}
        {DISPLAY_NAME_MAX} characters.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={DISPLAY_NAME_MIN}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 outline-none focus:border-primary"
        />
        <span className="self-end text-xs text-muted-2">
          {name.trim().length}/{DISPLAY_NAME_MAX}
        </span>
      </label>

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
          disabled={submitting || unchanged}
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
