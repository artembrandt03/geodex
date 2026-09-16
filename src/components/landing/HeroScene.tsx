"use client";

import { motion } from "framer-motion";
import { StarField } from "./StarField";

export interface HeroSceneProps {
  /** True while zooming into the earth toward the setup screen. */
  transitioning: boolean;
  onPlay: () => void;
}

/** Opening scene: out in space, the earth turning slowly. */
export function HeroScene({ transitioning, onPlay }: HeroSceneProps) {
  return (
    <motion.div
      animate={
        transitioning
          ? { scale: 7, opacity: 0 }
          : { scale: 1, opacity: 1 }
      }
      transition={{ duration: 0.9, ease: [0.7, 0, 0.9, 0.4] }}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 30%, var(--space-bg-2), var(--space-bg-1))",
      }}
    >
      <StarField />

      <motion.img
        src="/images/earth-rotating.webp"
        alt="A slowly rotating illustration of Earth"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-48 sm:w-64"
        style={{ filter: "drop-shadow(0 0 55px rgba(140, 180, 255, 0.35))" }}
      />

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-6 font-display text-5xl font-bold tracking-wide sm:text-6xl"
        style={{ color: "var(--space-star)" }}
      >
        GEODEX
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-3 max-w-md text-center text-white/70"
      >
        A geography guessing game. Chart the world, one country at a time.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPlay}
        className="mt-9 rounded-xl bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-lg shadow-black/30"
      >
        Play
      </motion.button>

      <motion.a
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        href="https://artembrandt.ca"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/85"
      >
        Developed by Artem Brandt
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5"
        >
          <path d="M7 3a1 1 0 000 2h4.586L4.293 12.293a1 1 0 101.414 1.414L13 6.414V11a1 1 0 102 0V4a1 1 0 00-1-1H7z" />
        </svg>
      </motion.a>
    </motion.div>
  );
}
