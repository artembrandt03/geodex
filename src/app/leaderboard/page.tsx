"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  userId: string;
  displayName: string;
  /** False when the player has hidden their profile, so the name isn't a link. */
  profilePublic: boolean;
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

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function LeaderboardPage() {
  return (
    <Suspense>
      <Leaderboard />
    </Suspense>
  );
}

function Leaderboard() {
  // The results screen links here with the round's mode/difficulty/length so a
  // player lands on the board they just played; anything invalid or missing
  // falls back to the usual defaults.
  const params = useSearchParams();
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>(
    MODES.find((m) => m.value === params.get("mode"))?.value ?? "NAME",
  );
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]["value"]>(
    DIFFICULTIES.find((d) => d.value === params.get("difficulty"))?.value ?? "EASY",
  );
  const [roundLength, setRoundLength] = useState<number>(
    ROUND_LENGTHS.find((n) => n === Number(params.get("roundLength"))) ?? 10,
  );

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
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-3 py-6 sm:px-4 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface/80 p-4 shadow-2xl backdrop-blur-md sm:gap-6 sm:p-8"
        >
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Leaderboard</h1>

          {/* Mode on its own row on phones, difficulty and length sharing the next. */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className={`${selectClass} col-span-2 sm:col-auto`}
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

          {/* Scrolls sideways if a very narrow screen still can't fit every column. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-2/60">
            <table className="w-full min-w-[17rem] text-left text-sm sm:text-base">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="w-12 px-2 py-3 font-medium sm:w-20 sm:px-4">#</th>
                  <th className="px-2 py-3 font-medium sm:px-4">Player</th>
                  <th className="px-2 py-3 font-medium sm:px-4">Score</th>
                  <th className="px-2 py-3 font-medium sm:px-4">Correct</th>
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
                      <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                        <RankCell rank={rank} podium={podium} filled={Boolean(entry)} />
                      </td>
                      {entry ? (
                        <>
                          <td
                            className={`max-w-[8rem] truncate px-2 py-2.5 sm:max-w-none sm:px-4 sm:py-3 ${podium ? "font-semibold" : ""}`}
                          >
                            {entry.profilePublic ? (
                              <Link
                                href={`/players/${entry.userId}`}
                                title="View profile"
                                className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                              >
                                {entry.displayName}
                              </Link>
                            ) : (
                              <span title="This player's profile is private">{entry.displayName}</span>
                            )}
                          </td>
                          <td
                            className={`px-2 py-2.5 font-semibold text-primary sm:px-4 sm:py-3 ${
                              podium ? "text-base sm:text-lg" : ""
                            }`}
                          >
                            {entry.score}
                          </td>
                          <td className="px-2 py-2.5 text-muted sm:px-4 sm:py-3">{entry.correct}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-2 py-2.5 sm:px-4 sm:py-3">
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
          className={`h-8 w-auto sm:h-10 ${filled ? "drop-shadow" : "opacity-35 grayscale"}`}
        />
      </motion.span>
      <span className="sr-only">{`#${rank}`}</span>
    </motion.span>
  );
}
