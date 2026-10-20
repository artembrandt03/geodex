"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * True when the visitor has asked their system for reduced motion. Decorative
 * motion that never stops (the drifting clouds, the particle field) is dropped
 * for them; the server renders as if they hadn't asked, and the browser switches
 * over right after hydrating, which is what useSyncExternalStore is for.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
