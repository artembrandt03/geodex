"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavBar } from "@/components/layout/NavBar";

/**
 * Wraps the nav bar + page content. On every route except /play, this can
 * keep its default pointer-events (its own content has nothing to click
 * "through" to — the shared map behind it, see SharedMapProvider, is
 * purely decorative there). /play is different: the actual, interactive
 * map lives in that same shared fixed layer, behind this whole shell, and
 * gameplay needs clicks on the empty parts of the screen to reach it —
 * `pointer-events: none` on a descendant doesn't make its ancestors
 * click-through, so both this wrapper and <main> need it explicitly on
 * that route (confirmed live: without it, clicking a country did nothing,
 * since <main> itself was still absorbing the click). NavBar and PlayGame's
 * own overlay pieces (score, prompts, buttons, forms) already opt back in
 * with pointer-events-auto, same pattern already used everywhere else.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const passThroughToMap = pathname === "/play";

  return (
    <div
      className={`relative z-10 flex flex-1 flex-col overflow-hidden ${
        passThroughToMap ? "pointer-events-none" : ""
      }`}
    >
      <NavBar />
      <main className={`flex-1 overflow-y-auto ${passThroughToMap ? "pointer-events-none" : ""}`}>
        {children}
      </main>
    </div>
  );
}
