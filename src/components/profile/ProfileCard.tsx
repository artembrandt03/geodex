"use client";

import { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { AboutWindow } from "@/components/about/AboutWindow";
import { Switch } from "@/components/ui/Switch";
import { ChangeDisplayNameModal } from "./ChangeDisplayNameModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { DeleteAccountModal } from "./DeleteAccountModal";
import type { ProfileUser } from "./useProfile";

const memberSince = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

/** Who you are: the avatar (fixed for now), display name, email and join date, plus the account actions. */
export function ProfileCard({ user, onChanged }: { user: ProfileUser; onChanged: () => void }) {
  const { update } = useSession();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Saved the moment it's flipped; rolled back (with a message) if the save fails.
  const [isPublic, setIsPublic] = useState(user.profilePublic);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  async function changeVisibility(next: boolean) {
    setVisibilityError(null);
    setIsPublic(next);
    setSavingVisibility(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePublic: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setIsPublic(!next);
      setVisibilityError("Couldn't save that. Try again.");
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <AboutWindow title="Your profile">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* `unoptimized`: transparent PNG, see CLAUDE.md's WebP-alpha caution. */}
        <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-accent-strong bg-gradient-to-br from-surface to-surface-2 shadow-[inset_0_0_0_3px_var(--surface-2)]">
          <Image
            src="/images/user-avatar.png"
            alt="An illustrated explorer studying a treasure map through a magnifying glass"
            fill
            unoptimized
            className="object-contain p-4"
          />
        </div>

        <p className="break-words font-display text-2xl font-bold">{user.displayName}</p>
      </div>

      <dl className="flex flex-col divide-y divide-border/70 rounded-xl border border-border bg-surface-2/50 text-sm">
        <Detail
          label="Display name"
          value={user.displayName}
          action={{ label: "Change", onClick: () => setNameOpen(true) }}
        />
        <Detail label="Email" value={user.email} />
        <Detail
          label="Password"
          value="••••••••"
          action={{ label: "Change", onClick: () => setPasswordOpen(true) }}
        />
        <Detail label="Member since" value={memberSince.format(new Date(user.createdAt))} />
      </dl>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">Public profile</p>
            <p className="text-xs leading-snug text-muted">
              {isPublic
                ? "Other players can open your profile from the leaderboard."
                : "Your profile is hidden. Your name still shows on the leaderboard, but no one can open it."}
            </p>
          </div>
          <Switch
            checked={isPublic}
            onChange={(next) => void changeVisibility(next)}
            disabled={savingVisibility}
            label="Public profile"
          />
        </div>
        {visibilityError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {visibilityError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="text-muted">Done with Geodex?</span>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
          style={{ borderColor: "var(--danger)" }}
          className="rounded-md border px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          Delete account
        </button>
      </div>

      <ChangeDisplayNameModal
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        currentName={user.displayName}
        onChanged={() => {
          // update({}) (not update()) is what makes the server re-read the name into the
          // session for the nav bar; with no argument it only refetches the old session.
          void update({}).then(onChanged);
        }}
      />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </AboutWindow>
  );
}

function Detail({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 break-all text-right font-medium">{value}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-xs font-semibold text-primary-hover transition-colors hover:bg-surface"
          >
            {action.label}
          </button>
        )}
      </dd>
    </div>
  );
}
