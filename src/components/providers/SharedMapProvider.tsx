"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { WorldMap, type WorldMapProps } from "@/components/game/WorldMap";
import { CloudLayer } from "@/components/landing/CloudLayer";

// Only the cosmos hero fully hides the shared map — every other route
// either shows it as a decorative backdrop or (on /play) takes it over for
// interactive gameplay.
const HIDDEN_ROUTES = ["/"];
const EXIT_DURATION = 0.45;

const DECORATIVE_MAP_PROPS: WorldMapProps = { interactive: false, showZoomControls: false };

interface SharedMapContextValue {
  setGameMapProps: (props: WorldMapProps | null) => void;
  setExiting: (exiting: boolean) => void;
  exitDuration: number;
}

const SharedMapContext = createContext<SharedMapContextValue | null>(null);

/**
 * Mounts exactly ONE WorldMap instance for the whole app lifetime, instead
 * of every page that wants a map mounting its own. A fresh WorldMap
 * instance refetches and reparses the country data and re-renders ~200 SVG
 * paths from scratch, which used to cause a visible reload both when
 * navigating between setup/leaderboard/login/register (fixed earlier) and,
 * worse, every time a round started — /play was mounting a second,
 * completely separate WorldMap of its own for actual gameplay. Now
 * PlayGame calls useSharedGameMap to take over this SAME instance instead
 * of rendering its own, so starting a round no longer re-fetches or
 * re-renders the map at all — it just hands the existing one new props.
 *
 * "Exiting" (set by the setup screen right before it starts a round) plays
 * a quick zoom-in on the whole map while its ambient clouds fly off to the
 * sides — see useBackdropExit.
 */
export function SharedMapProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [gameMapProps, setGameMapProps] = useState<WorldMapProps | null>(null);
  const [exiting, setExiting] = useState(false);
  const visible = !HIDDEN_ROUTES.includes(pathname);
  const isDecorative = gameMapProps === null;

  // setGameMapProps/setExiting are stable (useState setters) and
  // exitDuration is a constant, but a plain object literal here would still
  // get a new identity every render, and React re-renders every context
  // consumer whenever the provider's value reference changes regardless of
  // whether its contents did. Memoizing keeps that from cascading into
  // consumers (like useSharedGameMap) for no reason.
  const contextValue = useMemo<SharedMapContextValue>(
    () => ({ setGameMapProps, setExiting, exitDuration: EXIT_DURATION }),
    [setGameMapProps, setExiting],
  );

  return (
    <SharedMapContext.Provider value={contextValue}>
      <motion.div
        className="fixed inset-0 z-0 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
        animate={{ scale: exiting ? 1.15 : 1 }}
        transition={{ duration: EXIT_DURATION, ease: [0.4, 0, 1, 1] }}
        aria-hidden={!visible}
      >
        <div className="absolute inset-0">
          <WorldMap {...(gameMapProps ?? DECORATIVE_MAP_PROPS)} />
        </div>
        {isDecorative && <CloudLayer escaping={exiting} />}
      </motion.div>
      {children}
    </SharedMapContext.Provider>
  );
}

/**
 * Lets the setup screen trigger the shared map's exit animation (a quick
 * zoom-in plus the ambient clouds flying off to the sides) right before it
 * starts a round, and gives back the animation's own duration so the
 * navigation delay can't drift out of sync with it.
 */
export function useBackdropExit() {
  const ctx = useContext(SharedMapContext);
  if (!ctx) {
    throw new Error("useBackdropExit must be used within a SharedMapProvider");
  }
  return { setExiting: ctx.setExiting, exitDuration: ctx.exitDuration };
}

/**
 * Takes over the shared WorldMap instance with the given props for as long
 * as the calling component is mounted — e.g. PlayGame driving it as the
 * interactive gameplay map. Releases it back to the decorative default
 * (ambient clouds return) on unmount. `props` must be referentially stable
 * across renders that don't actually change anything (e.g. memoized with
 * useMemo) — this effect intentionally depends on it, and a fresh object
 * literal every render previously caused an infinite loop: setGameMapProps
 * changes this provider's state, which re-renders every context consumer
 * (including the caller of this hook), which built a new object, which
 * re-ran this effect, forever.
 */
export function useSharedGameMap(props: WorldMapProps) {
  const ctx = useContext(SharedMapContext);
  if (!ctx) {
    throw new Error("useSharedGameMap must be used within a SharedMapProvider");
  }
  const { setGameMapProps } = ctx;

  useEffect(() => {
    setGameMapProps(props);
  }, [props, setGameMapProps]);

  useEffect(() => {
    return () => setGameMapProps(null);
  }, [setGameMapProps]);
}
