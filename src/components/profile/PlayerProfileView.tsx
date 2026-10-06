"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AboutWindow } from "@/components/about/AboutWindow";
import { MatchHistory } from "./MatchHistory";
import { StatsWindow } from "./StatsWindow";
import type { ProfileStats } from "@/lib/profile/stats";

interface PlayerData {
  user: { displayName: string; createdAt: string; profilePublic: boolean };
  isSelf: boolean;
  stats: ProfileStats;
}

type Loaded =
  | { id: string; status: "ready"; data: PlayerData }
  | { id: string; status: "private" | "missing" | "error" };

const memberSince = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

/** Another player's profile, reached from the leaderboard: their stats and match history, no private details. */
export function PlayerProfileView({ id }: { id: string }) {
  // Tagged with the id it was fetched for, so navigating between players
  // shows "loading" instead of the previous player's page.
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<Loaded> {
      try {
        const res = await fetch(`/api/players/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (res.status === 403) return { id, status: "private" };
        if (res.status === 404) return { id, status: "missing" };
        if (!res.ok) return { id, status: "error" };
        return { id, status: "ready", data: (await res.json()) as PlayerData };
      } catch {
        return { id, status: "error" };
      }
    }

    void load().then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = loaded?.id === id ? loaded : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        {current === null ? (
          <p className="mt-24 animate-pulse text-muted">Loading profile...</p>
        ) : current.status === "ready" ? (
          <div className="grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
            <PlayerCard data={current.data} />
            <div className="flex flex-col gap-6">
              <StatsWindow stats={current.data.stats} />
              <MatchHistory endpoint={`/api/players/${encodeURIComponent(id)}/history`} />
            </div>
          </div>
        ) : (
          <Notice>
            <p className={current.status === "error" ? "text-danger" : "text-muted"}>
              {current.status === "private"
                ? "This player has chosen to keep their profile private."
                : current.status === "missing"
                  ? "We couldn't find that player."
                  : "Couldn't load this profile. Try again in a moment."}
            </p>
            <BackToLeaderboard />
          </Notice>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ data }: { data: PlayerData }) {
  return (
    <AboutWindow title="Player profile">
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
        <div className="flex flex-col gap-1">
          <p className="break-words font-display text-2xl font-bold">{data.user.displayName}</p>
          <p className="text-sm text-muted">
            Playing since {memberSince.format(new Date(data.user.createdAt))}
          </p>
        </div>
      </div>

      {data.isSelf && !data.user.profilePublic && (
        <p className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm leading-snug text-muted">
          Your profile is private, so only you can see this page.
        </p>
      )}

      <div className="flex justify-center">
        <BackToLeaderboard />
      </div>
    </AboutWindow>
  );
}

function BackToLeaderboard() {
  return (
    <Link
      href="/leaderboard"
      className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
    >
      Back to the leaderboard
    </Link>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-16 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface/80 p-8 text-center shadow-2xl backdrop-blur-md">
      {children}
    </div>
  );
}
