"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";

/** One of the About page's "windows": a titled glass panel over the map. */
export function AboutWindow({
  title,
  delay = 0,
  interactive = false,
  className = "",
  children,
}: {
  title: string;
  /** Seconds to hold off the entrance animation, to stagger windows in. */
  delay?: number;
  /** Lifts slightly on hover; the caller supplies the actual click target. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <motion.section
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ duration: 0.4, delay }}
      className={`relative flex flex-col gap-5 rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-md ${className}`}
    >
      <h2
        id={titleId}
        className="border-b border-border pb-3 font-display text-2xl font-bold"
      >
        {title}
      </h2>
      {children}
    </motion.section>
  );
}
