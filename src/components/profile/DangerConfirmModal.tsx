"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { PasswordField } from "@/components/auth/PasswordField";

export type DangerResult = { ok: true } | { ok: false; error: string };

export interface DangerConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Bold first line of the red warning box, e.g. "This can't be undone." */
  warningHeadline: string;
  /** What exactly will be lost. */
  warningBody: ReactNode;
  /** Label of the hold button, e.g. "Hold to delete". */
  confirmLabel: string;
  holdingLabel: string;
  cancelLabel: string;
  /** Performs the action with the typed password; reports success or a message to show. */
  run: (password: string) => Promise<DangerResult>;
  /** Shown once it worked. */
  doneTitle: string;
  doneBody: string;
  /** Runs right after success (refresh data, schedule a sign-out, ...). */
  onSuccess: () => void;
  /** If set, the done screen has this button (which closes the popup); otherwise it just stays up. */
  doneButtonLabel?: string;
}

export function DangerConfirmModal(props: DangerConfirmProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      {/* Mounted only while open, so it always starts from a blank, unarmed form. */}
      <DangerConfirmForm {...props} />
    </Modal>
  );
}

/**
 * Two deliberate steps before anything destructive happens: type the
 * password, then hold the button down for two seconds. The password is
 * checked again on the server, so the hold is a guard against slips, not
 * the only line of defense.
 */
function DangerConfirmForm({
  onClose,
  warningHeadline,
  warningBody,
  confirmLabel,
  holdingLabel,
  cancelLabel,
  run,
  doneTitle,
  doneBody,
  onSuccess,
  doneButtonLabel,
}: DangerConfirmProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    if (working) return;
    setError(null);
    setWorking(true);
    try {
      const result = await run(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      onSuccess();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setWorking(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="font-display text-xl font-semibold">{doneTitle}</p>
        <p className="text-muted">{doneBody}</p>
        {doneButtonLabel && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            {doneButtonLabel}
          </button>
        )}
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
        <p className="font-semibold text-danger">{warningHeadline}</p>
        <div className="mt-1">{warningBody}</div>
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
            {cancelLabel}
          </button>
          <HoldToConfirmButton
            onConfirm={() => void confirm()}
            disabled={password.length === 0 || working}
            holdingLabel={holdingLabel}
          >
            {confirmLabel}
          </HoldToConfirmButton>
        </div>
        <p className="text-xs text-muted-2">
          {password.length === 0
            ? "Enter your password to unlock the button."
            : "Press and hold the button for two seconds."}
        </p>
      </div>
    </div>
  );
}
