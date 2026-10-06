"use client";

import { signOut } from "next-auth/react";
import { DangerConfirmModal, type DangerResult } from "./DangerConfirmModal";

export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  async function run(password: string): Promise<DangerResult> {
    const res = await fetch("/api/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? "Couldn't delete your account. Try again." };
  }

  return (
    <DangerConfirmModal
      open={open}
      onClose={onClose}
      title="Delete your account"
      warningHeadline="This can't be undone."
      warningBody={
        <p>
          Your account, your match history and your place on the leaderboards will be permanently
          deleted.
        </p>
      }
      confirmLabel="Hold to delete"
      holdingLabel="Deleting in a moment..."
      cancelLabel="Keep my account"
      run={run}
      doneTitle="Your account has been deleted"
      doneBody="Taking you back to the start..."
      // Their session is for an account that no longer exists; sign out and head home.
      onSuccess={() => setTimeout(() => void signOut({ callbackUrl: "/" }), 1200)}
    />
  );
}
