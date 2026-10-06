import { PointChips } from "./PointChips";
import type { QuestionOutcome } from "@/lib/game/types";

/**
 * The stamp shown after each guess: right or wrong, what was guessed, the
 * points it earned, and always the name of the right country (in shape mode
 * nothing else on screen says what the highlighted country was).
 */
export function AnswerBanner({
  outcome,
  guessedName,
  answerName,
}: {
  outcome: QuestionOutcome;
  guessedName: string | null;
  answerName: string;
}) {
  const color = outcome.correct ? "var(--success)" : "var(--danger)";

  return (
    <div
      // Inline colors: globals.css's unlayered `* { border-color }` beats border-<color> classes.
      style={{ borderColor: color, color }}
      className="flex flex-col items-center gap-2 rounded-xl border-2 bg-surface/90 px-5 py-3 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <span
          style={{ borderColor: color }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
        >
          {outcome.correct ? <CheckMark /> : <CrossMark />}
        </span>
        <span className="font-display text-lg font-semibold">
          {outcome.correct ? (
            <>
              Correct! It&apos;s <strong>{answerName}</strong>{" "}
              <span className="tabular-nums">+{outcome.score}</span>
            </>
          ) : guessedName ? (
            <>
              {outcome.neighbor ? "So close, " : "Not quite, "}that&apos;s{" "}
              <strong className="underline decoration-2 underline-offset-2">{guessedName}</strong>
            </>
          ) : (
            "Not quite!"
          )}
        </span>
      </div>
      {!outcome.correct && (
        <p className="font-display text-base font-semibold text-foreground">
          The answer was <strong className="text-success">{answerName}</strong>
        </p>
      )}
      <PointChips outcome={outcome} />
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2.5}>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
