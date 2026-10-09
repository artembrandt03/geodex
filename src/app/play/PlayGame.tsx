"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { animate, motion, useMotionValue } from "framer-motion";
import { useBackdropExit, useSharedGameMap } from "@/components/providers/SharedMapProvider";
import { useRoundGuard } from "@/components/providers/RoundGuardProvider";
import type { WorldMapProps } from "@/components/game/WorldMap";
import { AnswerBanner } from "@/components/game/AnswerBanner";
import { EndedRound } from "@/components/game/EndedRound";
import { InactivityWarning } from "@/components/game/InactivityWarning";
import { RoundStopwatch } from "@/components/game/RoundStopwatch";
import { RoundSummary } from "@/components/game/RoundSummary";
import { StreakBadge } from "@/components/game/StreakBadge";
import { useRound } from "@/lib/game/useRound";
import { totalTimeMs } from "@/lib/game/time";
import { matchCountry } from "@/lib/game/matchCountry";
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
  const { setExiting } = useBackdropExit();

  // The setup screen sets this true right before navigating here, to play
  // the shared map's zoom-in transition (see SharedMapProvider). Nothing
  // else ever reset it back, so the map's wrapping layer stayed scaled up
  // 1.15x via CSS transform for the entire round -- purely cosmetic-looking,
  // but it also threw off WorldMap's own container-size measurements (the
  // ResizeObserver reads the post-transform, inflated rect), which feeds
  // the pan-clamping math. Reset it here, same pattern as SetupScene resets
  // it on its own mount.
  useEffect(() => {
    setExiting(false);
  }, [setExiting]);

  if (!config) {
    return (
      <div className="pointer-events-auto mx-auto max-w-md px-4 py-16 text-center animate-fade-up">
        <p className="mb-4 text-muted">That game setup isn&apos;t valid.</p>
        <Link href="/setup" className="text-primary underline underline-offset-4">
          Back to setup
        </Link>
      </div>
    );
  }

  // Keying on the config too (not just replayToken) guarantees a fresh mount
  // whenever the game setup changes.
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
  const { state, submitGuess, advance } = useRound(config);
  const { data: session } = useSession();
  const [guessInput, setGuessInput] = useState("");
  const [countryNames, setCountryNames] = useState<{ code: string; name: string }[]>([]);
  // A player-requested closer look at one specific country (the "zoom in"
  // loupe button), which overrides the map's usual framing until the next
  // question — see WorldMapProps.manualFocusCode. Reset it when the question
  // changes via the "adjust state during render" pattern (comparing against
  // a tracked previous value) rather than a useEffect, matching this
  // codebase's established fix for the react-hooks/set-state-in-effect rule
  // (see CLAUDE.md).
  const [manualFocusCode, setManualFocusCode] = useState<string | null>(null);
  // Bumped on every request (see requestManualFocus) so re-focusing the same
  // country twice in a row still re-triggers the zoom -- WorldMap's focus
  // effect keys on this alongside the code, since the code alone wouldn't
  // change and the effect wouldn't re-fire (confirmed live: the zoom button
  // only ever worked once).
  const [manualFocusNonce, setManualFocusNonce] = useState(0);
  // Keyed on the question's country (not the index) so the very first
  // question, which loads after mount, is covered too. In SHAPE mode each
  // question starts already zoomed in on the highlighted country; in NAME
  // mode the target's location is the puzzle, so it starts unfocused.
  const questionCode = state.questions[state.currentIndex]?.code ?? null;
  const [focusedQuestion, setFocusedQuestion] = useState<string | null>(null);
  if (questionCode !== focusedQuestion) {
    setFocusedQuestion(questionCode);
    setManualFocusCode(config.mode === "SHAPE" ? questionCode : null);
    setManualFocusNonce((n) => n + 1);
  }
  // At the reveal, drop that automatic focus so the map frames the guess and
  // the right answer together (a manual focus would override that fit).
  // Anything the player requests after this still applies.
  const [focusedStatus, setFocusedStatus] = useState(state.status);
  if (state.status !== focusedStatus) {
    setFocusedStatus(state.status);
    if (state.status === "revealing") setManualFocusCode(null);
  }

  const requestManualFocus = useCallback((code: string) => {
    setManualFocusCode(code);
    setManualFocusNonce((n) => n + 1);
  }, []);

  // Fetched for both modes: SHAPE needs it for the autocomplete list, NAME
  // needs it to name whatever country the player mis-clicked in feedback.
  useEffect(() => {
    fetch("/api/countries")
      .then((res) => res.json())
      .then((data: { countries: { code: string; name: string }[] }) =>
        setCountryNames(data.countries),
      );
  }, []);

  const countryNameByCode = useMemo(
    () => new Map(countryNames.map((c) => [c.code, c.name])),
    [countryNames],
  );

  const current = state.questions[state.currentIndex];
  const isRevealing = state.status === "revealing";
  const guessedName = state.lastOutcome?.guessedCode
    ? (countryNames.find((c) => c.code === state.lastOutcome!.guessedCode)?.name ?? null)
    : null;

  // Guards nav-bar navigation/sign-out with a confirmation for as long as
  // there's a round actually in progress to lose -- not during "loading"
  // (nothing has started yet) or "finished" (nothing left to lose).
  const { setGuardEnabled } = useRoundGuard();
  const roundInProgress = state.status === "playing" || isRevealing;
  useEffect(() => {
    setGuardEnabled(roundInProgress);
  }, [roundInProgress, setGuardEnabled]);
  // Also release the guard on unmount (e.g. the confirmed "End round" itself
  // navigates away, which unmounts this component before the effect above
  // would otherwise get a chance to see status change).
  useEffect(() => {
    return () => setGuardEnabled(false);
  }, [setGuardEnabled]);

  // Enter moves on from the reveal, same as the Next button. Auto-repeat is
  // ignored (holding Enter after submitting a typed guess must not skip the
  // result), and so is Enter while a dialog is open (e.g. the "End this
  // round?" confirmation, where Enter belongs to the dialog).
  useEffect(() => {
    if (!isRevealing) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      advance();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isRevealing, advance]);

  // While playing (NAME mode), a map click submits a guess. During the
  // reveal, the map stays clickable but repurposed: clicking any country
  // (e.g. the one you just guessed) zooms in on it instead, for a closer
  // look — reuses the same manualFocusCode the "zoom in" button sets.
  const handleCountryClick = useCallback(
    (code: string | null) => {
      if (state.status === "playing" && config.mode === "NAME") {
        submitGuess(code);
      } else if (state.status === "revealing" && code) {
        requestManualFocus(code);
      }
    },
    [config.mode, state.status, submitGuess, requestManualFocus],
  );

  // Takes over the ONE shared WorldMap instance (mounted once for the whole
  // app in SharedMapProvider) with these props instead of rendering a
  // second WorldMap here — that second instance is exactly what used to
  // refetch/reparse the country data and re-render ~200 SVG paths every
  // time a round started. Safe to call unconditionally with every status:
  // during "loading"/"error" current/lastOutcome are still undefined/null,
  // which just yields a plain, non-interactive map.
  //
  // Memoized (rather than a fresh object literal every render): useSharedGameMap
  // hands this straight to SharedMapProvider's setState, and a brand-new
  // object identity on every render fed an infinite loop (setState ->
  // context value changes -> every consumer, including this one,
  // re-renders -> new object -> setState again), which is what actually
  // caused the "Maximum update depth exceeded" errors, the unresponsive
  // nav bar, and the sluggish map drag (the loop was starving the main
  // thread) all at once. Only rebuild it when a value that should actually
  // reach the map changes.
  const gameMapProps = useMemo<WorldMapProps>(
    () => ({
      // Interactive both while actively guessing (NAME mode) and during the
      // reveal (either mode) -- see handleCountryClick for what a click does
      // in each case.
      interactive: (config.mode === "NAME" && state.status === "playing") || isRevealing,
      highlightedCode: config.mode === "SHAPE" ? (current?.code ?? null) : null,
      correctCode: state.lastOutcome?.code ?? null,
      guessedCode: state.lastOutcome?.guessedCode ?? null,
      resetSignal: state.currentIndex,
      manualFocusCode,
      manualFocusNonce,
      showZoomControls: true,
      onCountryClick: handleCountryClick,
    }),
    [
      config.mode,
      state.status,
      isRevealing,
      current?.code,
      state.lastOutcome?.code,
      state.lastOutcome?.guessedCode,
      state.currentIndex,
      manualFocusCode,
      manualFocusNonce,
      handleCountryClick,
    ],
  );

  useSharedGameMap(gameMapProps);

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="animate-pulse text-muted">Loading round...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="pointer-events-auto mx-auto max-w-md px-4 py-16 text-center animate-fade-up">
        <p className="mb-4 text-danger">{state.errorMessage}</p>
        <Link href="/setup" className="text-primary underline underline-offset-4">
          Back to setup
        </Link>
      </div>
    );
  }

  function handleShapeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRevealing || !guessInput.trim()) return;
    // Accepts the country's own name and common alternates ("USA", "Ivory Coast", ...).
    submitGuess(matchCountry(guessInput, countryNames));
    setGuessInput("");
  }

  // Over, one way or the other: no question is open any more.
  const roundOver = state.status === "finished" || state.status === "ended";
  const progress = state.status === "finished" ? 1 : state.currentIndex / config.roundLength;

  return (
    // pointer-events-none because the actual map now lives in a separate,
    // persistent layer behind this one (see SharedMapProvider) instead of
    // being a child of this div — without this, this div's own (invisible,
    // but still hit-testable) box would silently swallow every click meant
    // for the map underneath it. Each interactive piece below opts back in
    // with its own pointer-events-auto, same as it already did for the
    // overlay pieces that always floated above the map.
    <div className="pointer-events-none relative h-full w-full">
      {/* Top overlay: progress + score */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="flex flex-col items-start gap-3">
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-border bg-surface/85 px-4 py-2 shadow-lg backdrop-blur-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {state.status === "finished"
              ? "Complete"
              : state.status === "ended"
                ? "Round ended"
                : `Question ${state.currentIndex + 1} / ${config.roundLength}`}
          </span>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <RoundStopwatch
            outcomes={state.outcomes}
            startedAt={state.questionStartedAt}
            running={state.status === "playing"}
          />
        </div>
        {!roundOver && <StreakBadge streak={state.streak} />}
        </div>

        <div className="pointer-events-auto rounded-xl border border-border bg-surface/85 px-4 py-2 text-right shadow-lg backdrop-blur-md">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted">
            Score
          </span>
          <AnimatedScore value={state.totalScore} />
        </div>
      </div>

      {/*
        Deliberately not using AnimatePresence's exit tracking here: under
        this project's React/framer-motion versions, exit animations on this
        subtree could get stuck (the old content never unmounts), permanently
        freezing the prompt on a stale question. A plain key-based remount
        gives a reliable enter animation and drops the old element instantly
        instead, which is a small visual trade worth the reliability.
      */}
      {state.status === "finished" ? (
        <motion.div
          key="summary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"
        >
          <RoundSummary
            config={config}
            questions={state.questions}
            outcomes={state.outcomes}
            totalScore={state.totalScore}
            correctCount={state.correctCount}
            bestStreak={state.bestStreak}
            neighborCount={state.neighborCount}
            totalTimeMs={totalTimeMs(state.outcomes)}
            countryNames={countryNameByCode}
            signedIn={Boolean(session?.user)}
            saved={state.saved}
            leaderboardRank={state.leaderboardRank}
            onPlayAgain={onPlayAgain}
          />
        </motion.div>
      ) : state.status === "ended" && state.endReason ? (
        <motion.div
          key="ended"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"
        >
          <EndedRound
            reason={state.endReason}
            answered={state.outcomes.length}
            roundLength={config.roundLength}
            totalScore={state.totalScore}
            signedIn={Boolean(session?.user)}
            onPlayAgain={onPlayAgain}
          />
        </motion.div>
      ) : (
        <motion.div
          key={`prompt-${state.currentIndex}`}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface/85 px-6 py-3 text-center shadow-xl backdrop-blur-md">
            {config.mode === "NAME" ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Find this country
                </p>
                <p className="font-display text-2xl font-semibold">{current.name}</p>
              </>
            ) : (
              <p className="font-display text-xl font-semibold">
                Which country is highlighted?
              </p>
            )}
            <InactivityWarning startedAt={state.questionStartedAt} active={state.status === "playing"} />
            {/* In NAME mode only after guessing: zooming to the target beforehand
                would narrow down its location for free, since the map isn't
                otherwise showing where it is. In SHAPE mode the target is
                already highlighted, so a closer look is fine at any time. */}
            {(isRevealing || config.mode === "SHAPE") && (
              <ZoomButton
                label={isRevealing ? "Zoom in on this country" : "Zoom in on the highlighted country"}
                onClick={() => requestManualFocus(current.code)}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Bottom overlay: shape-mode input, or feedback */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
        {/* Plain conditional render (see note above) rather than
            AnimatePresence, for the same exit-reliability reason. */}
        {isRevealing && state.lastOutcome && (
          <motion.div
            key={state.currentIndex}
            initial={{ opacity: 0, y: 10, scale: 0.8, rotate: state.lastOutcome.correct ? -4 : 4 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="pointer-events-auto flex flex-col items-center gap-3"
          >
            <AnswerBanner
              outcome={state.lastOutcome}
              guessedName={guessedName}
              answerName={config.mode === "SHAPE" ? current.name : null}
            />

            <motion.button
              type="button"
              onClick={advance}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/20"
            >
              {state.currentIndex + 1 >= config.roundLength ? "See results" : "Next question"}
              <kbd className="ml-2 rounded bg-white/25 px-1.5 py-0.5 font-sans text-[10px] font-medium">
                Enter
              </kbd>
            </motion.button>
          </motion.div>
        )}

        {config.mode === "SHAPE" && !roundOver && !isRevealing && (
          <form
            onSubmit={handleShapeSubmit}
            className="pointer-events-auto flex gap-2 rounded-xl border border-border bg-surface/85 p-2 shadow-xl backdrop-blur-md"
          >
            <input
              list="country-names"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              disabled={isRevealing}
              placeholder="Type a country name..."
              autoFocus
              className="w-64 rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary sm:w-80"
            />
            <datalist id="country-names">
              {countryNames.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>
            <motion.button
              type="submit"
              disabled={isRevealing}
              whileHover={{ scale: isRevealing ? 1 : 1.03 }}
              whileTap={{ scale: isRevealing ? 1 : 0.97 }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              Guess
            </motion.button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * A "zoom in on this country" affordance for the prompt card — some
 * countries are too small to make out (or click precisely) at the map's
 * default framing. `unoptimized` sidesteps a real WebP-alpha decode bug
 * hit earlier with next/image's optimizer on transparent PNGs (see
 * CLAUDE.md's "next/image WebP-alpha caution").
 */
function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 rounded-full border-2 border-accent-strong bg-surface/90 px-3 py-1.5 shadow-[inset_0_0_0_2px_var(--surface-2)]"
    >
      <Image src="/images/loupe.png" alt="" width={16} height={16} unoptimized />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </motion.button>
  );
}

function AnimatedScore({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.5, ease: "easeOut" });
    return () => controls.stop();
  }, [value, motionValue]);

  useEffect(() => motionValue.on("change", (v) => setDisplay(Math.round(v))), [motionValue]);

  // Keying on `value` remounts just this span, retriggering the bump
  // animation each time the score changes.
  return (
    <span key={value} className="block font-display text-xl font-bold text-primary animate-score-bump">
      {display}
    </span>
  );
}
