"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { LEADERBOARD_SIZE, ROUND_LENGTHS } from "@/lib/game/types";

const MODES = [
  { value: "NAME", label: "Guess by name" },
  { value: "SHAPE", label: "Guess by shape" },
] as const;

const DIFFICULTIES = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
] as const;

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  correct: number;
  createdAt: string;
}

// Top three ranks get a trophy and a medal-colored row (see .lb-* in globals.css).
const PODIUM = [
  { rankClass: "lb-gold", trophy: "/images/trophy-gold.png", label: "Gold" },
  { rankClass: "lb-silver", trophy: "/images/trophy-silver.png", label: "Silver" },
  { rankClass: "lb-bronze", trophy: "/images/trophy-bronze.png", label: "Bronze" },
] as const;

const selectClass =
  "rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary";

const RANKS = Array.from({ length: LEADERBOARD_SIZE }, (_, i) => i + 1);

export default function LeaderboardPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("NAME");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]["value"]>("EASY");
  const [roundLength, setRoundLength] = useState<number>(10);

  // Tagged with the filters it was fetched for, so a result that doesn't
  // match the current selection is treated as "still loading" (skeleton rows)
  // instead of briefly showing the previous combination's players.
  const filterKey = `${mode}|${difficulty}|${roundLength}`;
  const [loaded, setLoaded] = useState<{
    filterKey: string;
    entries: LeaderboardEntry[] | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      mode,
      difficulty,
      roundLength: String(roundLength),
    });
    fetch(`/api/leaderboard?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then((data: { entries: LeaderboardEntry[] }) => {
        if (!cancelled) setLoaded({ filterKey, entries: data.entries });
      })
      .catch(() => {
        // null entries = failed, distinct from "loaded and empty".
        if (!cancelled) setLoaded({ filterKey, entries: null });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, difficulty, roundLength, filterKey]);

  const current = loaded?.filterKey === filterKey ? loaded : null;
  const failed = current !== null && current.entries === null;
  const entriesByRank = new Map(current?.entries?.map((e) => [e.rank, e]) ?? []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-md"
        >
          <h1 className="font-display text-3xl font-bold">Leaderboard</h1>

          <div className="flex flex-wrap gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className={selectClass}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className={selectClass}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={roundLength}
              onChange={(e) => setRoundLength(Number(e.target.value))}
              className={selectClass}
            >
              {ROUND_LENGTHS.map((n) => (
                <option key={n} value={n}>
                  {n} countries
                </option>
              ))}
            </select>
          </div>

          {failed && (
            <p className="text-sm text-danger">
              Couldn&apos;t load the leaderboard. Try again in a moment.
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/60">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="w-20 px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Correct</th>
                </tr>
              </thead>
              <tbody>
                {RANKS.map((rank, i) => {
                  const podium = PODIUM[rank - 1];
                  const entry = entriesByRank.get(rank);
                  const rowClass = `border-b border-border/60 last:border-0 ${
                    podium && entry ? `lb-medal ${podium.rankClass}` : ""
                  }`;

                  return (
                    <motion.tr
                      key={`${filterKey}-${rank}-${current ? "ready" : "loading"}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={rowClass}
                    >
                      <td className="px-4 py-3">
                        <RankCell rank={rank} podium={podium} filled={Boolean(entry)} />
                      </td>
                      {entry ? (
                        <>
                          <td
                            className={`px-4 py-3 ${podium ? "font-semibold" : ""}`}
                          >
                            {entry.displayName}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold text-primary ${
                              podium ? "text-lg" : ""
                            }`}
                          >
                            {entry.score}
                          </td>
                          <td className="px-4 py-3 text-muted">{entry.correct}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-4 py-3">
                          {current ? (
                            <span className="italic text-muted-2">
                              Waiting for someone to claim this spot!
                            </span>
                          ) : (
                            <span
                              aria-hidden
                              className="block h-3.5 w-2/3 animate-pulse rounded-full bg-border-strong/40"
                            />
                          )}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The "#" cell: a trophy for the podium (idle bob for gold, a playful tilt on
 * hover for all three), a plain number otherwise. An unclaimed podium spot
 * keeps a faded grayscale trophy as a nudge to go claim it.
 */
function RankCell({
  rank,
  podium,
  filled,
}: {
  rank: number;
  podium: (typeof PODIUM)[number] | undefined;
  filled: boolean;
}) {
  if (!podium) {
    return <span className="font-medium text-muted">{rank}</span>;
  }

  return (
    <motion.span
      className="inline-flex items-center gap-1.5"
      whileHover={filled ? { rotate: [0, -8, 8, 0], scale: 1.12 } : undefined}
      transition={{ duration: 0.45 }}
    >
      <motion.span
        className="inline-flex"
        animate={filled && rank === 1 ? { y: [0, -3, 0] } : undefined}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src={podium.trophy}
          alt={`${podium.label} trophy`}
          width={44}
          height={40}
          unoptimized
          className={filled ? "drop-shadow" : "opacity-35 grayscale"}
        />
      </motion.span>
      <span className="sr-only">{`#${rank}`}</span>
    </motion.span>
  );
}
