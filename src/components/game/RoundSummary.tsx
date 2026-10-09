"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { animate, motion, useMotionValue } from "framer-motion";
import { PointChips } from "./PointChips";
import { formatDuration } from "@/lib/game/time";
import type { QuestionOutcome, RoundConfig, RoundQuestion } from "@/lib/game/types";

export interface RoundSummaryProps {
  config: RoundConfig;
  questions: RoundQuestion[];
  outcomes: QuestionOutcome[];
  totalScore: number;
  correctCount: number;
  bestStreak: number;
  neighborCount: number;
  totalTimeMs: number;
  /** Country names by code, to say what a wrong guess actually was. */
  countryNames: Map<string, string>;
  signedIn: boolean;
  saved: boolean;
  /** 1-based leaderboard place if this round made the top 5, once saved. */
  leaderboardRank: number | null;
  onPlayAgain: () => void;
}

const MODE_LABELS = { NAME: "Guess by name", SHAPE: "Guess by shape" } as const;
const DIFFICULTY_LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

function performanceMessage(accuracy: number): string {
  if (accuracy === 1) return "Perfect round!";
  if (accuracy >= 0.8) return "Excellent work";
  if (accuracy >= 0.5) return "Nice job";
  if (accuracy > 0) return "Keep practicing";
  return "Tough round, try again";
}

export function RoundSummary(props: RoundSummaryProps) {
  const {
    config,
    questions,
    outcomes,
    totalScore,
    correctCount,
    bestStreak,
    neighborCount,
    totalTimeMs,
    countryNames,
    signedIn,
    saved,
    leaderboardRank,
    onPlayAgain,
  } = props;
  const accuracy = correctCount / config.roundLength;
  const boardLabel = `${MODE_LABELS[config.mode]} · ${DIFFICULTY_LABELS[config.difficulty]} · ${config.roundLength} countries`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="relative mx-3 flex max-h-[calc(100dvh-6rem)] w-[min(56rem,calc(100vw-1.5rem))] flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-surface px-4 py-4 shadow-2xl sm:mx-4 sm:px-10 sm:py-5"
    >
      {(leaderboardRank !== null || accuracy >= 0.8) && (
        <Confetti pieces={leaderboardRank !== null && leaderboardRank <= 3 ? 44 : 22} />
      )}

      <header className="flex shrink-0 flex-col items-center gap-0.5 text-center">
        <h1 className="font-display text-3xl font-bold">Round complete</h1>
        <p className="text-sm text-muted">{boardLabel}</p>
        {leaderboardRank === null && (
          <p className="mt-1 font-medium text-accent">{performanceMessage(accuracy)}</p>
        )}
      </header>

      {leaderboardRank !== null && <LeaderboardHype rank={leaderboardRank} boardLabel={boardLabel} />}

      {/* Score and stats beside the points history on wider screens, stacked on phones. */}
      {/* On phones the whole card scrolls and these sections take their natural height;
          from md up, the points list scrolls on its own beside the stats. */}
      <div className="flex shrink-0 flex-col gap-4 md:min-h-0 md:flex-1 md:shrink md:flex-row">
      <div className="flex shrink-0 flex-col gap-4 md:w-64 md:justify-center">
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-xs font-medium uppercase tracking-widest text-muted">Total score</span>
        <CountUp
          value={totalScore}
          className="font-display text-5xl font-extrabold text-primary sm:text-6xl"
        />
      </div>

      <dl className="grid shrink-0 grid-cols-2 gap-3">
        <StatTile label="Correct" value={`${correctCount} / ${config.roundLength}`} />
        <StatTile label="Total time" value={formatDuration(totalTimeMs)} />
        <StatTile label="Neighbors" value={String(neighborCount)} hint="close wrong guesses" />
        <StatTile
          label="Best streak"
          value={String(bestStreak)}
          icon={
            <Image
              src="/images/streak-fire.png"
              alt=""
              width={14}
              height={20}
              unoptimized
              className={bestStreak >= 3 ? "" : "opacity-60 grayscale-[40%]"}
            />
          }
        />
      </dl>
      </div>

      <section aria-labelledby="points-history" className="flex min-w-0 shrink-0 flex-col gap-2 md:min-h-[12rem] md:flex-1 md:shrink">
        <h2 id="points-history" className="font-display text-lg font-semibold">
          Points history
        </h2>
        <ol className="flex flex-col divide-y divide-border/70 rounded-xl border border-border bg-surface-2/50 md:min-h-0 md:flex-1 md:overflow-y-auto">
          {outcomes.map((outcome, i) => {
            const guessed = outcome.guessedCode ? (countryNames.get(outcome.guessedCode) ?? null) : null;
            return (
              <li
                key={i}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    style={{ borderColor: outcome.correct ? "var(--success)" : "var(--danger)" }}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      outcome.correct ? "text-success" : "text-danger"
                    }`}
                  >
                    {outcome.correct ? "✓" : "✕"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span className="mr-2 text-sm text-muted tabular-nums">{i + 1}.</span>
                      {questions[i]?.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {outcome.correct
                        ? `${(outcome.elapsedMs / 1000).toFixed(1)}s`
                        : `${guessed ? `You said ${guessed}` : "No match"} · ${(outcome.elapsedMs / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <PointChips outcome={outcome} />
                  <span
                    className={`w-12 text-right font-display text-lg font-bold tabular-nums ${
                      outcome.score > 0 ? "text-primary" : "text-muted"
                    }`}
                  >
                    +{outcome.score}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3">
        {signedIn ? (
          saved && <p className="text-sm text-success">Round saved to your profile ✓</p>
        ) : (
          <p className="text-center text-sm text-muted">
            Playing as a guest, so this round wasn&apos;t saved.{" "}
            <Link href="/register" className="font-medium text-primary underline underline-offset-4">
              Sign up
            </Link>{" "}
            to land on the leaderboard.
          </p>
        )}

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center sm:gap-3">
          <motion.button
            onClick={onPlayAgain}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="col-span-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            Play again
          </motion.button>
          <Link
            href={`/leaderboard?mode=${config.mode}&difficulty=${config.difficulty}&roundLength=${config.roundLength}`}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-center font-medium transition-colors hover:bg-surface-2"
          >
            Leaderboard
          </Link>
          <Link
            href="/setup"
            className="rounded-lg border border-border-strong px-5 py-2.5 text-center font-medium transition-colors hover:bg-surface-2"
          >
            Home
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-center">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 font-display text-xl font-bold tabular-nums">
        {icon}
        {value}
      </dd>
      {hint && <span className="text-[11px] text-muted-2">{hint}</span>}
    </div>
  );
}

const PODIUM = {
  1: { trophy: "/images/trophy-gold.png", headline: "You're #1!", color: "#c9a227" },
  2: { trophy: "/images/trophy-silver.png", headline: "Silver spot!", color: "#9aa3ad" },
  3: { trophy: "/images/trophy-bronze.png", headline: "Bronze spot!", color: "#b0733a" },
} as const;

/**
 * Shown instead of the plain performance line when the round put the player
 * in the leaderboard's top 5: trophy for the podium, a glow, and a bigger
 * headline the higher they placed.
 */
function LeaderboardHype({ rank, boardLabel }: { rank: number; boardLabel: string }) {
  const podium = rank <= 3 ? PODIUM[rank as 1 | 2 | 3] : null;
  const color = podium?.color ?? "var(--accent-strong)";
  const headline = podium?.headline ?? "You made the leaderboard!";
  const sub =
    rank === 1
      ? "A brand new champion. Everyone else has some catching up to do."
      : rank <= 3
        ? `Rank #${rank} on the leaderboard. A spot on the podium is yours.`
        : `Rank #${rank} on the leaderboard. You're in the top 5!`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
      // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
      style={{ borderColor: color, boxShadow: `0 0 28px ${color}55, inset 0 0 20px ${color}22` }}
      className="relative flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 bg-surface-2/70 px-6 py-3 text-center"
    >
      <div className="flex items-center gap-4">
        {podium ? (
          <motion.span
            animate={{ y: [0, -5, 0], rotate: [0, -4, 4, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex"
          >
            <Image src={podium.trophy} alt="" width={52} height={47} unoptimized className="drop-shadow-lg" />
          </motion.span>
        ) : (
          <span
            aria-hidden
            style={{ borderColor: color }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-xl font-bold text-primary-hover"
          >
            #{rank}
          </span>
        )}
        <div className="text-left">
          <p className="font-display text-2xl font-extrabold uppercase tracking-wide">{headline}</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{boardLabel}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted">{sub}</p>
    </motion.div>
  );
}

/** Counts up to its value once, like the in-game score. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 1.1, ease: "easeOut", delay: 0.2 });
    return () => controls.stop();
  }, [value, motionValue]);

  useEffect(() => motionValue.on("change", (v) => setDisplay(Math.round(v))), [motionValue]);

  return <span className={className}>{display}</span>;
}

const CONFETTI_COLORS = ["var(--primary)", "var(--accent)", "var(--success)", "var(--warning)"];

/**
 * A celebratory burst. Deterministic "looks random" jitter (no Math.random)
 * so the component stays pure to render: a decorative burst doesn't need
 * true randomness, just visual variety.
 */
function Confetti({ pieces }: { pieces: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2;
        const distance = 140 + ((i * 37) % 160);
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance - 30,
              scale: 0.4,
              rotate: (i % 2 ? 1 : -1) * 240,
            }}
            transition={{ duration: 1.4, delay: ((i * 13) % 20) / 100, ease: "easeOut" }}
            className="absolute left-1/2 top-24 h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
          />
        );
      })}
    </div>
  );
}
