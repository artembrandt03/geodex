"use client";

import { motion } from "framer-motion";

export interface CloudLayerProps {
  /** True while the setup screen is zooming into the map to start a round. */
  fadeOut: boolean;
}

/** Soft drifting mist over the setup screen's map background. */
export function CloudLayer({ fadeOut }: CloudLayerProps) {
  return (
    <motion.div
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="animate-drift absolute -left-1/4 top-[6%] h-44 w-[75%] rounded-full blur-2xl"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}
      />
      <div
        className="animate-drift-slow absolute -right-1/4 top-[38%] h-56 w-[85%] rounded-full blur-2xl"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
      />
      <div
        className="animate-drift absolute left-[5%] top-[68%] h-28 w-[55%] rounded-full blur-xl"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.65)" }}
      />
    </motion.div>
  );
}
