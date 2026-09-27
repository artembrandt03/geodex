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

// A grid of clouds, not a background fill — but each DotLottieReact
// instance is a real animated canvas/WebGL context, and a too-high count
// (176 total across both panels, in an earlier pass) overwhelmed the
// browser's context budget and left the transition stuck mid-render. This
// is deliberately a much smaller grid that accepts some gaps between puffs
// in exchange for actually rendering: many clouds forming a visible mass,
// not a mathematically gapless one.
const GRID_ROWS = 5;
const GRID_COLS = 4;

const PANEL_CLOUDS = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
  const row = Math.floor(i / GRID_COLS);
  const col = i % GRID_COLS;
  return {
    id: i,
    // Grid centers spread slightly past both edges (-10% to 110%) so clouds
    // bleed past the panel's outer edge and across the center seam where
    // the two panels meet, instead of leaving a sliver gap at either.
    topPct: ((row + 0.5) / GRID_ROWS) * 120 - 10 + (((i * 11) % 10) - 5),
    leftPct: ((col + 0.5) / GRID_COLS) * 120 - 10 + (((i * 17) % 10) - 5),
    widthPct: 60 + ((i * 13) % 30),
  };
});

function CloudPanel() {
  return (
    <div className="relative h-full w-full">
      {PANEL_CLOUDS.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            top: `${c.topPct}%`,
            left: `${c.leftPct}%`,
            width: `${c.widthPct}%`,
            aspectRatio: "1.6",
            transform: "translate(-50%, -50%)",
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
        <CloudPanel />
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2"
        initial={phase === "closing" ? openRight : closed}
        animate={phase === "closing" ? closed : openRight}
        transition={{ duration, ease: [0.76, 0, 0.24, 1] }}
      >
        <CloudPanel />
      </motion.div>
    </div>
  );
}
