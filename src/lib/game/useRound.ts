"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { scoreGuess } from "./scoring";
import type { QuestionOutcome, RoundConfig, RoundQuestion } from "./types";

export type RoundStatus = "loading" | "playing" | "revealing" | "finished" | "error";

export interface RoundState {
  status: RoundStatus;
  questions: RoundQuestion[];
  currentIndex: number;
  outcomes: QuestionOutcome[];
  totalScore: number;
  correctCount: number;
  /** Set briefly after a guess, before advancing to the next question. */
  lastOutcome: QuestionOutcome | null;
  errorMessage: string | null;
  /** Persisted to the leaderboard? Only true once /api/rounds/complete succeeds. */
  saved: boolean;
}

const REVEAL_DELAY_MS = 1200;

/** Drives a full round: fetches questions, scores guesses, and (if signed in) saves the result. */
export function useRound(config: RoundConfig | null) {
  const { data: session } = useSession();
  const [state, setState] = useState<RoundState>({
    status: "loading",
    questions: [],
    currentIndex: 0,
    outcomes: [],
    totalScore: 0,
    correctCount: 0,
    lastOutcome: null,
    errorMessage: null,
    saved: false,
  });

  const questionStartedAt = useRef<number>(0);
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    fetch("/api/rounds/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not start round");
        }
        return res.json();
      })
      .then((data: { questions: RoundQuestion[] }) => {
        if (cancelled) return;
        questionStartedAt.current = Date.now();
        setState((s) => ({
          ...s,
          status: "playing",
          questions: data.questions,
          currentIndex: 0,
          outcomes: [],
          totalScore: 0,
          correctCount: 0,
          lastOutcome: null,
          saved: false,
        }));
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "error", errorMessage: error.message }));
      });

    return () => {
      cancelled = true;
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.mode, config?.difficulty, config?.roundLength]);

  const submitGuess = useCallback(
    (guessedCode: string | null) => {
      setState((s) => {
        if (s.status !== "playing") return s;
        const target = s.questions[s.currentIndex];
        const elapsedMs = Date.now() - questionStartedAt.current;
        const correct = guessedCode !== null && guessedCode === target.code;
        const score = scoreGuess(correct, elapsedMs);
        const outcome: QuestionOutcome = {
          code: target.code,
          guessedCode,
          correct,
          score,
          elapsedMs,
        };

        return {
          ...s,
          status: "revealing",
          outcomes: [...s.outcomes, outcome],
          totalScore: s.totalScore + score,
          correctCount: s.correctCount + (correct ? 1 : 0),
          lastOutcome: outcome,
        };
      });
    },
    [],
  );

  // Advance to the next question (or finish) after a brief reveal.
  useEffect(() => {
    if (state.status !== "revealing") return;

    advanceTimeout.current = setTimeout(() => {
      setState((s) => {
        const nextIndex = s.currentIndex + 1;
        if (nextIndex >= s.questions.length) {
          return { ...s, status: "finished", lastOutcome: null };
        }
        questionStartedAt.current = Date.now();
        return { ...s, status: "playing", currentIndex: nextIndex, lastOutcome: null };
      });
    }, REVEAL_DELAY_MS);

    return () => {
      if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    };
  }, [state.status]);

  // Persist the finished round for signed-in users.
  useEffect(() => {
    if (state.status !== "finished" || state.saved || !config || !session?.user) return;

    fetch("/api/rounds/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: config.mode,
        difficulty: config.difficulty,
        roundLength: config.roundLength,
        score: state.totalScore,
        correct: state.correctCount,
      }),
    })
      .then((res) => {
        if (res.ok) setState((s) => ({ ...s, saved: true }));
      })
      .catch(() => {
        // Non-fatal — the player still sees their result, it just won't be on the leaderboard.
      });
  }, [state.status, state.saved, state.totalScore, state.correctCount, config, session?.user]);

  return { state, submitGuess };
}
