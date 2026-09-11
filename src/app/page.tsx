"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROUND_LENGTHS } from "@/lib/game/types";

const MODES = [
  {
    value: "NAME",
    label: "Guess by name",
    description: "We name a country — click it on the map.",
  },
  {
    value: "SHAPE",
    label: "Guess by shape",
    description: "A country is highlighted — type its name.",
  },
] as const;

const DIFFICULTIES = [
  { value: "EASY", label: "Easy", description: "Widely-known countries" },
  { value: "MEDIUM", label: "Medium", description: "A mixed bag" },
  { value: "HARD", label: "Hard", description: "Lesser-known countries" },
] as const;

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
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">🌍 Geodex</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Guess countries on the map. Pick a mode, a difficulty, and a round
          length to get started.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Mode</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                mode === m.value
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {m.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Difficulty</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                difficulty === d.value
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              <div className="font-medium">{d.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {d.description}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Round length</h2>
        <div className="grid grid-cols-4 gap-3">
          {ROUND_LENGTHS.map((n) => (
            <button
              key={n}
              onClick={() => setRoundLength(n)}
              className={`rounded-lg border py-3 text-center font-medium transition-colors ${
                roundLength === n
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={startGame}
        className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-700"
      >
        {session?.user ? "Start game" : "Play as guest"}
      </button>

      {!session?.user && (
        <p className="-mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Playing as a guest — your score won&apos;t be saved to the
          leaderboard.
        </p>
      )}
    </div>
  );
}
