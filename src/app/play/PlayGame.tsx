"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4">That game setup isn&apos;t valid.</p>
        <Link href="/" className="text-emerald-600 underline">
          Back to setup
        </Link>
      </div>
    );
  }

  // Keying on the config too (not just replayToken) guarantees a fresh mount
  // — and therefore fresh "loading" state — whenever the game setup changes.
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
    return <p className="px-4 py-16 text-center text-gray-500">Loading round...</p>;
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-red-600">{state.errorMessage}</p>
        <Link href="/" className="text-emerald-600 underline">
          Back to setup
        </Link>
      </div>
    );
  }

  if (state.status === "finished") {
    return (
      <RoundSummary
        totalScore={state.totalScore}
        correctCount={state.correctCount}
        roundLength={config.roundLength}
        saved={state.saved}
        onPlayAgain={onPlayAgain}
      />
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Question {state.currentIndex + 1} / {config.roundLength}
        </span>
        <span>
          Score: <span className="font-semibold text-gray-900 dark:text-gray-100">{state.totalScore}</span>
        </span>
      </div>

      {config.mode === "NAME" ? (
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Find this country:</p>
          <p className="text-2xl font-bold">{current.name}</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-bold">Which country is highlighted?</p>
        </div>
      )}

      <WorldMap
        interactive={config.mode === "NAME" && !isRevealing}
        highlightedCode={config.mode === "SHAPE" ? current.code : null}
        feedbackCode={state.lastOutcome?.code ?? null}
        feedbackCorrect={state.lastOutcome?.correct}
        onCountryClick={(code) => {
          if (config.mode === "NAME") submitGuess(code);
        }}
      />

      {config.mode === "SHAPE" && (
        <form onSubmit={handleShapeSubmit} className="flex justify-center gap-2">
          <input
            list="country-names"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
            disabled={isRevealing}
            placeholder="Type a country name..."
            autoFocus
            className="w-72 rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black/20"
          />
          <datalist id="country-names">
            {countryNames.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={isRevealing}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Guess
          </button>
        </form>
      )}

      {isRevealing && state.lastOutcome && (
        <p
          className={`text-center font-medium ${
            state.lastOutcome.correct ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {state.lastOutcome.correct
            ? `Correct! +${state.lastOutcome.score} points`
            : `Not quite — it was ${current.name}`}
        </p>
      )}
    </div>
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
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Round complete!</h1>
      <p className="text-5xl font-extrabold text-emerald-600">{totalScore}</p>
      <p className="text-gray-600 dark:text-gray-400">
        {correctCount} / {roundLength} correct
      </p>
      {saved && <p className="text-sm text-emerald-600">Saved to the leaderboard ✓</p>}

      <div className="mt-4 flex gap-3">
        <button
          onClick={onPlayAgain}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Play again
        </button>
        <Link
          href="/leaderboard"
          className="rounded-md border border-black/10 px-4 py-2 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Leaderboard
        </Link>
        <Link
          href="/"
          className="rounded-md border border-black/10 px-4 py-2 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
