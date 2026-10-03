"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChangePasswordWindow } from "./ChangePasswordWindow";
import { MatchHistory } from "./MatchHistory";
import { ProfileCard } from "./ProfileCard";
import { StatsWindow } from "./StatsWindow";
import { useProfile } from "./useProfile";

/** The profile page's content: needs a signed-in player, so it waits on the session first. */
export function ProfileView() {
  const { status } = useSession();
  const profile = useProfile(status === "authenticated");

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        {status === "unauthenticated" ? (
          <Notice>
            <p className="text-muted">Log in to see your profile, stats and match history.</p>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
            >
              Log in
            </Link>
          </Notice>
        ) : status === "loading" || profile.status === "loading" ? (
          <p className="mt-24 animate-pulse text-muted">Loading your profile...</p>
        ) : profile.status === "error" ? (
          <Notice>
            <p className="text-danger">{profile.message}</p>
          </Notice>
        ) : (
          <div className="grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
            <div className="flex flex-col gap-6">
              <ProfileCard user={profile.user} />
              <ChangePasswordWindow />
            </div>
            <div className="flex flex-col gap-6">
              <StatsWindow stats={profile.stats} />
              <MatchHistory />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-16 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface/80 p-8 text-center shadow-2xl backdrop-blur-md">
      {children}
    </div>
  );
}
