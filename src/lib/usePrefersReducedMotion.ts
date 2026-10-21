"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * What the visitor wants from decorative motion: "reduced" if they've asked their
 * system for less, "full" if not, and "pending" while that isn't known yet (on the
 * server, and for the one render while the page hydrates).
 *
 * Why three states and not a boolean: if "not yet known" counted as "full", the
 * endless decorations (48 cloud animations, a WebGL field) would mount, begin
 * downloading and drawing, and be torn down a moment later for anyone who asked for
 * reduced motion. Decorations that are costly to start should wait for "full".
 */
export type MotionPreference = "pending" | "full" | "reduced";

export function useMotionPreference(): MotionPreference {
  return useSyncExternalStore<MotionPreference>(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? "reduced" : "full"),
    () => "pending",
  );
}

/** True only once the visitor is known to have asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useMotionPreference() === "reduced";
}
