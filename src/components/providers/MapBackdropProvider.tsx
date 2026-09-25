"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MapBackdrop } from "@/components/layout/MapBackdrop";

const VISIBLE_ROUTES = ["/setup", "/leaderboard", "/login", "/register"];

interface MapBackdropContextValue {
  setFadeOut: (fadeOut: boolean) => void;
}

const MapBackdropContext = createContext<MapBackdropContextValue | null>(null);

/**
 * Mounts the decorative map + drifting-clouds backdrop exactly once for the
 * whole app, instead of each page (setup/leaderboard/login/register)
 * mounting its own copy. A fresh WorldMap instance refetches and reparses
 * the country data and re-renders ~200 SVG paths from scratch, which is
 * what caused the reported ~1s reload every time you navigated between
 * those pages. Visibility is now just a CSS opacity toggle driven by the
 * route — the underlying WorldMap never unmounts, so it never redoes that
 * work after the first page load.
 */
export function MapBackdropProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [fadeOut, setFadeOut] = useState(false);
  const visible = VISIBLE_ROUTES.includes(pathname);

  return (
    <MapBackdropContext.Provider value={{ setFadeOut }}>
      <div
        className="fixed inset-0 z-0 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
        aria-hidden={!visible}
      >
        <MapBackdrop fadeOut={fadeOut} />
      </div>
      {children}
    </MapBackdropContext.Provider>
  );
}

/** Lets the setup screen fade the shared backdrop's clouds during its zoom-into-game transition. */
export function useMapBackdropFade() {
  const ctx = useContext(MapBackdropContext);
  if (!ctx) {
    throw new Error("useMapBackdropFade must be used within a MapBackdropProvider");
  }
  return ctx.setFadeOut;
}
