"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { ROUND_LENGTHS } from "@/lib/game/types";

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

const cardBase =
  "rounded-xl border p-4 text-left transition-colors duration-150";
const cardActive = "border-primary bg-primary/10";
const cardInactive = "border-border hover:border-border-strong hover:bg-surface-2";

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

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();

  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("NAME");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]["value"]>("EASY");
  const [roundLength, setRoundLength] = useState<number>(10);

  function startGame() {
    const params = new URLSearchParams({
      mode,
      difficulty,
      roundLength: String(roundLength),
    });
    router.push(`/play?${params.toString()}`);
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(45,212,191,0.12), transparent), radial-gradient(50% 40% at 90% 90%, rgba(245,158,11,0.08), transparent)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex w-full max-w-2xl flex-col gap-10"
      >
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="font-display text-5xl font-bold tracking-tight"
          >
            🌍 Geodex
          </motion.h1>
          <p className="mt-3 text-muted">
            Guess countries on the map. Pick a mode, a difficulty, and a round
            length to get started.
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
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={startGame}
          className="rounded-xl bg-primary px-6 py-3.5 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20"
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
  );
}
