"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ROUND_LENGTHS } from "@/lib/game/types";

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

const selectClass =
  "rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary";

export default function LeaderboardPage() {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("NAME");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]["value"]>("EASY");
  const [roundLength, setRoundLength] = useState<number>(10);

  // null = not yet loaded for the current filters; keeps the previous
  // table visible while a new filter combination is fetching.
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      mode,
      difficulty,
      roundLength: String(roundLength),
    });
    fetch(`/api/leaderboard?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { entries: LeaderboardEntry[] }) => {
        if (!cancelled) setEntries(data.entries);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, difficulty, roundLength]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-bold"
      >
        Leaderboard
      </motion.h1>

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

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {entries === null ? (
          <p className="p-6 text-muted">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-muted">
            No scores yet for this combination. Be the first!
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Correct</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                  <motion.tr
                    key={`${mode}-${difficulty}-${roundLength}-${entry.rank}-${entry.displayName}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-muted">{entry.rank}</td>
                    <td className="px-4 py-2.5">{entry.displayName}</td>
                    <td className="px-4 py-2.5 font-semibold text-primary">{entry.score}</td>
                    <td className="px-4 py-2.5 text-muted">{entry.correct}</td>
                  </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
