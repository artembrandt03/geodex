"use client";

import { DangerConfirmModal, type DangerResult } from "./DangerConfirmModal";

export function ResetStatsModal({
  open,
  onClose,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once the stats are gone, so the page can reload its numbers. */
  onReset: () => void;
}) {
  async function run(password: string): Promise<DangerResult> {
    const res = await fetch("/api/profile/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? "Couldn't reset your statistics. Try again." };
  }

  return (
    <DangerConfirmModal
      open={open}
      onClose={onClose}
      title="Reset your statistics"
      warningHeadline="This can't be undone."
      warningBody={
        <>
          <p>
            Every round you&apos;ve played will be erased: your stats and your whole match history, as
            if you were starting from zero.
          </p>
          <p className="mt-2 font-semibold">
            You&apos;ll also be removed from all the leaderboards. Your account stays.
          </p>
        </>
      }
      confirmLabel="Hold to reset"
      holdingLabel="Resetting in a moment..."
      cancelLabel="Keep my stats"
      run={run}
      doneTitle="Statistics reset"
      doneBody="You're starting fresh. Good luck out there!"
      doneButtonLabel="Done"
      onSuccess={onReset}
    />
  );
}
