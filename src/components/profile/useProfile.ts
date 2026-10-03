"use client";

import { useEffect, useState } from "react";
import type { ProfileStats } from "@/lib/profile/stats";

export interface ProfileUser {
  displayName: string;
  email: string;
  createdAt: string;
}

export type ProfileData =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: ProfileUser; stats: ProfileStats };

/** Loads the signed-in player's account details and lifetime stats. */
export function useProfile(enabled: boolean): ProfileData {
  const [data, setData] = useState<ProfileData>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load(): Promise<ProfileData> {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) {
          return { status: "error", message: "Couldn't load your profile. Try again in a moment." };
        }
        const body = (await res.json()) as { user: ProfileUser; stats: ProfileStats };
        return { status: "ready", ...body };
      } catch {
        return { status: "error", message: "Couldn't reach the server. Check your connection." };
      }
    }

    void load().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
