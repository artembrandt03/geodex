"use client";

import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface CloudCurtainProps {
  /** "closing": sweeps in from both sides to fully cover the screen.
   *  "opening": starts fully covering the screen and sweeps back out. */
  phase: "closing" | "opening";
  /** Seconds for the sweep. */
  duration?: number;
  onAnimationComplete?: () => void;
}

const PANEL_CLOUD_COUNT = 10;

// Deterministic, densely overlapping placement (no Math.random, keeps this
// pure to render) so each panel reads as one solid mass of cloud rather
// than individual puffs. A solid bg-surface fill behind them (see below)
// guarantees full coverage regardless of any gaps between the shapes.
const PANEL_CLOUDS = Array.from({ length: PANEL_CLOUD_COUNT }, (_, i) => ({
  id: i,
  top: `${(i * 23) % 85}%`,
  offset: -10 + ((i * 19) % 100),
  size: 340 + ((i * 29) % 220),
}));

function CloudPanel({ side }: { side: "left" | "right" }) {
  return (
    <div className="relative h-full w-full bg-surface">
      {PANEL_CLOUDS.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            top: c.top,
            left: side === "left" ? `${c.offset}%` : undefined,
            right: side === "right" ? `${c.offset}%` : undefined,
            width: c.size,
            height: c.size * 0.62,
          }}
        >
          <DotLottieReact src="/images/cloud.lottie" loop autoplay />
        </div>
      ))}
    </div>
  );
}

/**
 * A full-screen "theater curtain" of clouds: two dense masses sweeping in
 * from the left and right to fully hide the screen, or sweeping back out to
 * reveal it. Used as a page-transition cover — SetupScene plays the
 * "closing" half before navigating to /play, and PlayGame plays the
 * "opening" half on mount, so the moment of navigation itself happens while
 * the screen is fully covered and the two halves read as one continuous
 * sweep even though they're two separate page mounts.
 */
export function CloudCurtain({ phase, duration = 0.6, onAnimationComplete }: CloudCurtainProps) {
  const closed = { x: "0%" };
  const openLeft = { x: "-100%" };
  const openRight = { x: "100%" };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2"
        initial={phase === "closing" ? openLeft : closed}
        animate={phase === "closing" ? closed : openLeft}
        transition={{ duration, ease: [0.76, 0, 0.24, 1] }}
        onAnimationComplete={onAnimationComplete}
      >
        <CloudPanel side="left" />
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2"
        initial={phase === "closing" ? openRight : closed}
        animate={phase === "closing" ? closed : openRight}
        transition={{ duration, ease: [0.76, 0, 0.24, 1] }}
      >
        <CloudPanel side="right" />
      </motion.div>
    </div>
  );
}
