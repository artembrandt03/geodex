"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MapBackdrop } from "@/components/layout/MapBackdrop";

const VISIBLE_ROUTES = ["/setup", "/leaderboard", "/login", "/register"];
const EXIT_DURATION = 0.45;

interface MapBackdropContextValue {
  setExiting: (exiting: boolean) => void;
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
 *
 * "Exiting" (set by the setup screen right before it starts a round) plays
 * a quick zoom-in on the whole backdrop while its clouds fly off to the
 * sides — see useBackdropExit.
 */
export function MapBackdropProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [exiting, setExiting] = useState(false);
  const visible = VISIBLE_ROUTES.includes(pathname);

  return (
    <MapBackdropContext.Provider value={{ setExiting }}>
      <motion.div
        className="fixed inset-0 z-0 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
        animate={{ scale: exiting ? 1.15 : 1 }}
        transition={{ duration: EXIT_DURATION, ease: [0.4, 0, 1, 1] }}
        aria-hidden={!visible}
      >
        <MapBackdrop escaping={exiting} />
      </motion.div>
      {children}
    </MapBackdropContext.Provider>
  );
}

/**
 * Lets the setup screen trigger the shared backdrop's exit animation (a
 * quick zoom-in plus the ambient clouds flying off to the sides) right
 * before it starts a round.
 */
export function useBackdropExit() {
  const ctx = useContext(MapBackdropContext);
  if (!ctx) {
    throw new Error("useBackdropExit must be used within a MapBackdropProvider");
  }
  return { setExiting: ctx.setExiting, exitDuration: EXIT_DURATION };
}
