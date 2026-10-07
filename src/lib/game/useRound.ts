"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { scoreAnswer } from "./scoring";
import { isNeighbor, type NeighborMap } from "./neighbors";
import { totalTimeMs } from "./time";
import type { QuestionOutcome, RoundConfig, RoundQuestion } from "./types";

export type RoundStatus = "loading" | "playing" | "revealing" | "finished" | "error";

export interface RoundState {
  status: RoundStatus;
  questions: RoundQuestion[];
  currentIndex: number;
  outcomes: QuestionOutcome[];
  totalScore: number;
  correctCount: number;
  /** Consecutive correct answers right now. */
  streak: number;
  bestStreak: number;
  /** Wrong guesses that bordered the right answer. */
  neighborCount: number;
  /** When the current question was shown (ms epoch); drives the live stopwatch. */
  questionStartedAt: number | null;
  /** Set briefly after a guess, before advancing to the next question. */
  lastOutcome: QuestionOutcome | null;
  errorMessage: string | null;
  /** Persisted to the leaderboard? Only true once /api/rounds/complete succeeds. */
  saved: boolean;
  /** 1-based place on the leaderboard if this round made the top 5, once saved. */
  leaderboardRank: number | null;
  /** The server's signed receipt that this round was started; sent back when saving. */
  roundToken: string | null;
}

const INITIAL_STATE: RoundState = {
  status: "loading",
  questions: [],
  currentIndex: 0,
  outcomes: [],
  totalScore: 0,
  correctCount: 0,
  streak: 0,
  bestStreak: 0,
  neighborCount: 0,
  questionStartedAt: null,
  lastOutcome: null,
  errorMessage: null,
  saved: false,
  leaderboardRank: null,
  roundToken: null,
};

async function loadNeighbors(): Promise<NeighborMap> {
  try {
    const res = await fetch("/data/country-neighbors.json");
    return res.ok ? ((await res.json()) as NeighborMap) : {};
  } catch {
    // Without it the only loss is the consolation point; the round still works.
    return {};
  }
}

/** Drives a full round: fetches questions, scores guesses, and (if signed in) saves the result. */
export function useRound(config: RoundConfig | null) {
  const { data: session } = useSession();
  const [state, setState] = useState<RoundState>(INITIAL_STATE);

  const neighbors = useRef<NeighborMap>({});

  useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const questions = fetch("/api/rounds/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start round");
      }
      return (await res.json()) as { questions: RoundQuestion[]; token: string };
    });

    Promise.all([questions, loadNeighbors()])
      .then(([data, neighborMap]) => {
        if (cancelled) return;
        neighbors.current = neighborMap;
        setState({
          ...INITIAL_STATE,
          status: "playing",
          questions: data.questions,
          roundToken: data.token,
          questionStartedAt: Date.now(),
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "error", errorMessage: error.message }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.mode, config?.difficulty, config?.roundLength]);

  const submitGuess = useCallback(
    (guessedCode: string | null) => {
      setState((s) => {
        if (s.status !== "playing" || !config) return s;
        const target = s.questions[s.currentIndex];
        const elapsedMs = Date.now() - (s.questionStartedAt ?? Date.now());
        const correct = guessedCode !== null && guessedCode === target.code;
        const neighbor = !correct && isNeighbor(neighbors.current, guessedCode, target.code);
        const streak = correct ? s.streak + 1 : 0;
        const breakdown = scoreAnswer({
          mode: config.mode,
          difficulty: config.difficulty,
          correct,
          neighbor,
          elapsedMs,
          streak,
        });
        const outcome: QuestionOutcome = {
          code: target.code,
          guessedCode,
          correct,
          neighbor,
          streak,
          score: breakdown.total,
          breakdown,
          elapsedMs,
        };

        return {
          ...s,
          status: "revealing",
          outcomes: [...s.outcomes, outcome],
          totalScore: s.totalScore + breakdown.total,
          correctCount: s.correctCount + (correct ? 1 : 0),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          neighborCount: s.neighborCount + (neighbor ? 1 : 0),
          lastOutcome: outcome,
        };
      });
    },
    [config],
  );

  // Advance to the next question (or finish) once the player is done
  // reviewing the reveal and clicks "Next question" — the round pauses
  // here for as long as they like rather than auto-advancing on a timer.
  const advance = useCallback(() => {
    setState((s) => {
      if (s.status !== "revealing") return s;
      const nextIndex = s.currentIndex + 1;
      if (nextIndex >= s.questions.length) {
        return { ...s, status: "finished", questionStartedAt: null, lastOutcome: null };
      }
      return {
        ...s,
        status: "playing",
        currentIndex: nextIndex,
        questionStartedAt: Date.now(),
        lastOutcome: null,
      };
    });
  }, []);

  // Persist the finished round for signed-in users.
  useEffect(() => {
    if (state.status !== "finished" || state.saved || !config || !session?.user || !state.roundToken) {
      return;
    }

    fetch("/api/rounds/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: config.mode,
        difficulty: config.difficulty,
        roundLength: config.roundLength,
        score: state.totalScore,
        correct: state.correctCount,
        totalTimeMs: totalTimeMs(state.outcomes),
        bestStreak: state.bestStreak,
        neighborCount: state.neighborCount,
        roundToken: state.roundToken,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { leaderboardRank?: number | null } | null;
        setState((s) => ({ ...s, saved: true, leaderboardRank: data?.leaderboardRank ?? null }));
      })
      .catch(() => {
        // Non-fatal — the player still sees their result, it just won't be on the leaderboard.
      });
  }, [
    state.status,
    state.saved,
    state.totalScore,
    state.correctCount,
    state.outcomes,
    state.bestStreak,
    state.neighborCount,
    state.roundToken,
    config,
    session?.user,
  ]);

  return { state, submitGuess, advance };
}
