"use client";

import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface CloudLayerProps {
  /** True while the setup screen is zooming into the map to start a round. */
  fadeOut: boolean;
}

type Direction = "left-to-right" | "right-to-left";

interface CloudSpec {
  id: number;
  top: string;
  width: number;
  duration: number;
  delay: number;
  opacity: number;
  direction: Direction;
}

// Deterministic placement/timing — no Math.random, so this stays pure to
// render (React's purity lint flags impure calls during render).
// A wide mix of heights/sizes/speeds/directions so it reads as "many clouds
// drifting through the sky" rather than a handful of repeating shapes.
const CLOUDS: CloudSpec[] = [
  { id: 0, top: "4%", width: 220, duration: 34, delay: 0, opacity: 0.85, direction: "left-to-right" },
  { id: 1, top: "12%", width: 150, duration: 24, delay: -6, opacity: 0.55, direction: "right-to-left" },
  { id: 2, top: "20%", width: 300, duration: 46, delay: -18, opacity: 0.7, direction: "left-to-right" },
  { id: 3, top: "28%", width: 180, duration: 29, delay: -3, opacity: 0.6, direction: "right-to-left" },
  { id: 4, top: "36%", width: 260, duration: 40, delay: -22, opacity: 0.8, direction: "left-to-right" },
  { id: 5, top: "44%", width: 130, duration: 20, delay: -11, opacity: 0.5, direction: "right-to-left" },
  { id: 6, top: "52%", width: 340, duration: 55, delay: -8, opacity: 0.65, direction: "left-to-right" },
  { id: 7, top: "58%", width: 200, duration: 27, delay: -33, opacity: 0.7, direction: "right-to-left" },
  { id: 8, top: "66%", width: 160, duration: 23, delay: -14, opacity: 0.55, direction: "left-to-right" },
  { id: 9, top: "72%", width: 280, duration: 48, delay: -40, opacity: 0.75, direction: "right-to-left" },
  { id: 10, top: "80%", width: 190, duration: 31, delay: -5, opacity: 0.6, direction: "left-to-right" },
  { id: 11, top: "88%", width: 240, duration: 37, delay: -25, opacity: 0.65, direction: "right-to-left" },
];

/** A busy sky of real cloud animations, drifting both ways at different speeds. */
export function CloudLayer({ fadeOut }: CloudLayerProps) {
  return (
    <motion.div
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {CLOUDS.map((cloud) => (
        <div
          key={cloud.id}
          className={
            cloud.direction === "left-to-right"
              ? "animate-drift-across absolute left-0"
              : "animate-drift-across-reverse absolute right-0"
          }
          style={{
            top: cloud.top,
            width: cloud.width,
            height: cloud.width * 0.6,
            opacity: cloud.opacity,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        >
          <DotLottieReact src="/images/cloud.lottie" loop autoplay />
        </div>
      ))}
    </motion.div>
  );
}
