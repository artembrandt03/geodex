"use client";

import { useEffect, useState } from "react";
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
      <h1 className="text-3xl font-bold">Leaderboard</h1>

      <div className="flex flex-wrap gap-4">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black/20"
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
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black/20"
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
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black/20"
        >
          {ROUND_LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n} countries
            </option>
          ))}
        </select>
      </div>

      {entries === null ? (
        <p className="text-gray-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">
          No scores yet for this combination — be the first!
        </p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black/10 text-sm text-gray-500 dark:border-white/10">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2">Score</th>
              <th className="py-2">Correct</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={`${entry.rank}-${entry.displayName}`}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-2 pr-2 font-medium">{entry.rank}</td>
                <td className="py-2 pr-2">{entry.displayName}</td>
                <td className="py-2 pr-2 font-semibold text-emerald-600">
                  {entry.score}
                </td>
                <td className="py-2">{entry.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
