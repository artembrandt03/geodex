"use client";

import { motion } from "framer-motion";
import { Particles } from "./Particles";
import { ArcText } from "./ArcText";

export interface HeroSceneProps {
  /** True while zooming into the earth toward the setup screen. */
  transitioning: boolean;
  onPlay: () => void;
}

const PARTICLE_COLORS = ["#ffffff", "#f3ead2", "#9db4ff"];

/** Opening scene: out in space, the earth turning slowly. */
export function HeroScene({ transitioning, onPlay }: HeroSceneProps) {
  return (
    <motion.div
      animate={transitioning ? { scale: 7, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.7, 0, 0.9, 0.4] }}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black px-4"
    >
      <div className="absolute inset-0">
        <Particles
          particleColors={PARTICLE_COLORS}
          particleCount={220}
          particleSpread={12}
          speed={0.08}
          particleBaseSize={80}
          alphaParticles
          disableRotation={false}
        />
      </div>

      {/* The earth with "GEODEX" arching above it and the tagline curving
          below — all three centered on the same point. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative"
        style={{ width: 420, height: 340 }}
      >
        <ArcText
          text="GEODEX"
          radius={115}
          halfSpanDeg={24}
          position="top"
          charClassName="font-display text-3xl font-bold"
          className="text-[var(--space-star)]"
        />

        {/* eslint-disable-next-line @next/next/no-img-element -- keep the animation */}
        <img
          src="/images/earth-rotating.webp"
          alt="A slowly rotating illustration of Earth"
          width={170}
          height={170}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ filter: "drop-shadow(0 0 55px rgba(140, 180, 255, 0.35))" }}
        />

        <ArcText
          text="A GEOGRAPHY GUESSING GAME"
          radius={150}
          halfSpanDeg={52}
          position="bottom"
          charClassName="text-xs font-semibold tracking-wide"
          className="text-white/70"
        />
      </motion.div>

      <motion.a
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        href="https://artembrandt.ca"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 text-base font-medium text-white/85 transition-colors hover:text-white sm:text-lg"
      >
        Developed by Artem Brandt
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M7 3a1 1 0 000 2h4.586L4.293 12.293a1 1 0 101.414 1.414L13 6.414V11a1 1 0 102 0V4a1 1 0 00-1-1H7z" />
        </svg>
      </motion.a>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPlay}
        className="mt-6 rounded-xl bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-lg shadow-black/30"
      >
        Play
      </motion.button>
    </motion.div>
  );
}
