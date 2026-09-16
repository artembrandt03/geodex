"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ROUND_LENGTHS } from "@/lib/game/types";
import { WorldMap } from "@/components/game/WorldMap";
import { CloudLayer } from "./CloudLayer";
import { CompassRose } from "./CompassRose";

const MODES = [
  {
    value: "NAME",
    label: "Guess by name",
    description: "We name a country. Click it on the map.",
  },
  {
    value: "SHAPE",
    label: "Guess by shape",
    description: "A country is highlighted. Type its name.",
  },
] as const;

const DIFFICULTIES = [
  { value: "EASY", label: "Easy", description: "Widely known countries" },
  { value: "MEDIUM", label: "Medium", description: "A mixed bag" },
  { value: "HARD", label: "Hard", description: "Lesser known countries" },
] as const;

const cardBase = "rounded-xl border p-4 text-left transition-colors duration-150";
const cardActive = "border-primary bg-primary/15";
const cardInactive = "border-border-strong bg-surface-2/60 hover:bg-surface-2";

function OptionButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${cardBase} ${active ? cardActive : cardInactive}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted">{subtitle}</div>
    </motion.button>
  );
}

/** The mode/difficulty/round-length picker, staged over the map with drifting clouds. */
export function SetupScene() {
  const router = useRouter();
  const { data: session } = useSession();

  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("NAME");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]["value"]>("EASY");
  const [roundLength, setRoundLength] = useState<number>(10);
  const [transitioning, setTransitioning] = useState(false);

  function startGame() {
    setTransitioning(true);
    const params = new URLSearchParams({
      mode,
      difficulty,
      roundLength: String(roundLength),
    });
    // Give the zoom-in a moment to play before the route actually changes.
    setTimeout(() => {
      router.push(`/play?${params.toString()}`);
    }, 700);
  }

  return (
    <motion.div
      animate={transitioning ? { scale: 5, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.7, 0, 0.9, 0.4] }}
      className="relative h-full w-full overflow-hidden"
    >
      <div className="absolute inset-0">
        <WorldMap interactive={false} defaultZoom={1.9} />
      </div>
      <CloudLayer fadeOut={transitioning} />

      <div className="relative z-10 flex h-full items-center justify-center overflow-y-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex w-full max-w-2xl flex-col gap-8 overflow-hidden rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-md"
        >
          <CompassRose className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-muted/10" />

          <div className="text-center">
            <h1 className="flex items-center justify-center gap-2 font-display text-4xl font-bold tracking-tight">
              <Image src="/images/earth.png" alt="" width={40} height={40} />
              Geodex
            </h1>
            <p className="mt-3 text-muted">
              Pick a mode, a difficulty, and a round length to get started.
            </p>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
              Mode
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODES.map((m) => (
                <OptionButton
                  key={m.value}
                  active={mode === m.value}
                  onClick={() => setMode(m.value)}
                  title={m.label}
                  subtitle={m.description}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
              Difficulty
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DIFFICULTIES.map((d) => (
                <OptionButton
                  key={d.value}
                  active={difficulty === d.value}
                  onClick={() => setDifficulty(d.value)}
                  title={d.label}
                  subtitle={d.description}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
              Round length
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {ROUND_LENGTHS.map((n) => (
                <motion.button
                  key={n}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setRoundLength(n)}
                  className={`rounded-xl border py-3 text-center font-medium transition-colors duration-150 ${
                    roundLength === n ? cardActive : cardInactive
                  }`}
                >
                  {n}
                </motion.button>
              ))}
            </div>
          </section>

          <motion.button
            whileHover={{ scale: transitioning ? 1 : 1.02 }}
            whileTap={{ scale: transitioning ? 1 : 0.98 }}
            onClick={startGame}
            disabled={transitioning}
            className="rounded-xl bg-primary px-6 py-3.5 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-70"
          >
            {session?.user ? "Start game" : "Play as guest"}
          </motion.button>

          {!session?.user && (
            <p className="-mt-6 text-center text-sm text-muted">
              Playing as a guest. Your score won&apos;t be saved to the
              leaderboard.
            </p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
