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
const CLOUD_COUNT = 48;

const CLOUDS: CloudSpec[] = Array.from({ length: CLOUD_COUNT }, (_, i) => ({
  id: i,
  top: `${(i * 97) % 92}%`,
  width: 120 + ((i * 53) % 240),
  duration: 18 + ((i * 13) % 40),
  delay: -((i * 7) % 40),
  opacity: 0.45 + ((i * 11) % 45) / 100,
  direction: i % 2 === 0 ? "left-to-right" : "right-to-left",
}));

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
