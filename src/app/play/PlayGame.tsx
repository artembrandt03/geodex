"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { WorldMap } from "@/components/game/WorldMap";
import { useRound } from "@/lib/game/useRound";
import { normalizeAnswer } from "@/lib/game/normalizeAnswer";
import { ROUND_LENGTHS } from "@/lib/game/types";
import type { RoundConfig } from "@/lib/game/types";

const VALID_MODES = new Set(["NAME", "SHAPE"]);
const VALID_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);

function parseConfig(searchParams: URLSearchParams): RoundConfig | null {
  const mode = searchParams.get("mode");
  const difficulty = searchParams.get("difficulty");
  const roundLength = Number(searchParams.get("roundLength"));

  if (
    !mode ||
    !VALID_MODES.has(mode) ||
    !difficulty ||
    !VALID_DIFFICULTIES.has(difficulty) ||
    !(ROUND_LENGTHS as readonly number[]).includes(roundLength)
  ) {
    return null;
  }

  return {
    mode: mode as RoundConfig["mode"],
    difficulty: difficulty as RoundConfig["difficulty"],
    roundLength: roundLength as RoundConfig["roundLength"],
  };
}

export function PlayGame() {
  const searchParams = useSearchParams();
  const config = useMemo(() => parseConfig(searchParams), [searchParams]);
  // Bumped to force a remount (fresh round) on "Play again" with identical params.
  const [replayToken, setReplayToken] = useState(0);

  if (!config) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center animate-fade-up">
        <p className="mb-4 text-muted">That game setup isn&apos;t valid.</p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Back to setup
        </Link>
      </div>
    );
  }

  // Keying on the config too (not just replayToken) guarantees a fresh mount
  // whenever the game setup changes.
  const roundKey = `${config.mode}-${config.difficulty}-${config.roundLength}-${replayToken}`;

  return (
    <ActiveRound
      key={roundKey}
      config={config}
      onPlayAgain={() => setReplayToken((t) => t + 1)}
    />
  );
}

function ActiveRound({
  config,
  onPlayAgain,
}: {
  config: RoundConfig;
  onPlayAgain: () => void;
}) {
  const { state, submitGuess } = useRound(config);
  const [guessInput, setGuessInput] = useState("");
  const [countryNames, setCountryNames] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    if (config.mode !== "SHAPE") return;
    fetch("/api/countries")
      .then((res) => res.json())
      .then((data: { countries: { code: string; name: string }[] }) =>
        setCountryNames(data.countries),
      );
  }, [config.mode]);

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="animate-pulse text-muted">Loading round...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center animate-fade-up">
        <p className="mb-4 text-danger">{state.errorMessage}</p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Back to setup
        </Link>
      </div>
    );
  }

  const current = state.questions[state.currentIndex];
  const isRevealing = state.status === "revealing";

  function handleShapeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRevealing || !guessInput.trim()) return;
    const normalizedGuess = normalizeAnswer(guessInput);
    const match = countryNames.find((c) => normalizeAnswer(c.name) === normalizedGuess);
    submitGuess(match?.code ?? null);
    setGuessInput("");
  }

  const progress = state.status === "finished" ? 1 : state.currentIndex / config.roundLength;

  return (
    <div className="relative h-full w-full">
      <WorldMap
        interactive={config.mode === "NAME" && !isRevealing && state.status !== "finished"}
        highlightedCode={config.mode === "SHAPE" ? current?.code : null}
        feedbackCode={state.lastOutcome?.code ?? null}
        feedbackCorrect={state.lastOutcome?.correct}
        resetSignal={state.currentIndex}
        onCountryClick={(code) => {
          if (config.mode === "NAME") submitGuess(code);
        }}
      />

      {/* Top overlay: progress + score */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-border bg-surface/85 px-4 py-2 shadow-lg backdrop-blur-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {state.status === "finished"
              ? "Complete"
              : `Question ${state.currentIndex + 1} / ${config.roundLength}`}
          </span>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="pointer-events-auto rounded-xl border border-border bg-surface/85 px-4 py-2 text-right shadow-lg backdrop-blur-md">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            Score
          </span>
          <AnimatedScore value={state.totalScore} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {state.status === "finished" ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <RoundSummary
              totalScore={state.totalScore}
              correctCount={state.correctCount}
              roundLength={config.roundLength}
              saved={state.saved}
              onPlayAgain={onPlayAgain}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`prompt-${state.currentIndex}`}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4"
          >
            <div className="pointer-events-auto rounded-2xl border border-border bg-surface/85 px-6 py-3 text-center shadow-xl backdrop-blur-md">
              {config.mode === "NAME" ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Find this country
                  </p>
                  <p className="font-display text-2xl font-semibold">{current.name}</p>
                </>
              ) : (
                <p className="font-display text-xl font-semibold">
                  Which country is highlighted?
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom overlay: shape-mode input, or feedback */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
        <AnimatePresence>
          {isRevealing && state.lastOutcome && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`pointer-events-auto rounded-xl border px-5 py-2.5 text-center font-medium shadow-xl backdrop-blur-md ${
                state.lastOutcome.correct
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-danger/40 bg-danger/15 text-danger"
              }`}
            >
              {state.lastOutcome.correct
                ? `Correct! +${state.lastOutcome.score} points`
                : `Not quite, it was ${current.name}`}
            </motion.div>
          )}
        </AnimatePresence>

        {config.mode === "SHAPE" && state.status !== "finished" && (
          <form
            onSubmit={handleShapeSubmit}
            className="pointer-events-auto flex gap-2 rounded-xl border border-border bg-surface/85 p-2 shadow-xl backdrop-blur-md"
          >
            <input
              list="country-names"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              disabled={isRevealing}
              placeholder="Type a country name..."
              autoFocus
              className="w-64 rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary sm:w-80"
            />
            <datalist id="country-names">
              {countryNames.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>
            <motion.button
              type="submit"
              disabled={isRevealing}
              whileHover={{ scale: isRevealing ? 1 : 1.03 }}
              whileTap={{ scale: isRevealing ? 1 : 0.97 }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Guess
            </motion.button>
          </form>
        )}
      </div>
    </div>
  );
}

function AnimatedScore({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.5, ease: "easeOut" });
    return () => controls.stop();
  }, [value, motionValue]);

  useEffect(() => motionValue.on("change", (v) => setDisplay(Math.round(v))), [motionValue]);

  // Keying on `value` remounts just this span, retriggering the bump
  // animation each time the score changes.
  return (
    <span key={value} className="block font-display text-xl font-bold text-primary animate-score-bump">
      {display}
    </span>
  );
}

function RoundSummary({
  totalScore,
  correctCount,
  roundLength,
  saved,
  onPlayAgain,
}: {
  totalScore: number;
  correctCount: number;
  roundLength: number;
  saved: boolean;
  onPlayAgain: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="mx-4 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-8 py-10 text-center shadow-2xl"
    >
      <h1 className="font-display text-3xl font-bold">Round complete</h1>
      <motion.p
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}
        className="font-display text-6xl font-extrabold text-primary"
      >
        {totalScore}
      </motion.p>
      <p className="text-muted">
        {correctCount} / {roundLength} correct
      </p>
      {saved && <p className="text-sm text-success">Saved to the leaderboard ✓</p>}

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <motion.button
          onClick={onPlayAgain}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Play again
        </motion.button>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-border-strong px-4 py-2 font-medium transition-colors hover:bg-surface-2"
        >
          Leaderboard
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-border-strong px-4 py-2 font-medium transition-colors hover:bg-surface-2"
        >
          Home
        </Link>
      </div>
    </motion.div>
  );
}
