"use client";

import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface CloudLayerProps {
  /** True while the setup screen is zooming into the map to start a round. */
  fadeOut: boolean;
}

interface CloudSpec {
  id: number;
  top: string;
  width: number;
  duration: number;
  delay: number;
  opacity: number;
}

// Deterministic placement/timing (no Math.random — see StarField for why).
const CLOUDS: CloudSpec[] = [
  { id: 0, top: "8%", width: 260, duration: 32, delay: 0, opacity: 0.85 },
  { id: 1, top: "28%", width: 340, duration: 46, delay: -18, opacity: 0.7 },
  { id: 2, top: "58%", width: 220, duration: 38, delay: -9, opacity: 0.75 },
  { id: 3, top: "76%", width: 300, duration: 52, delay: -30, opacity: 0.6 },
];

/** Real cloud animations drifting left to right over the setup screen's map. */
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
          className="animate-drift-across absolute left-0"
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
