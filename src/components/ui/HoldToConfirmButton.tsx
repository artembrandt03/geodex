"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * A button for destructive actions that only fires after being held down
 * (mouse, touch, or Space/Enter) for `holdMs`: a fill sweeps across while
 * you hold, and letting go early cancels it. A stray click can't trigger it.
 */
export function HoldToConfirmButton({
  onConfirm,
  children,
  holdingLabel = "Keep holding...",
  holdMs = 2000,
  disabled = false,
}: {
  onConfirm: () => void;
  children: ReactNode;
  holdingLabel?: string;
  holdMs?: number;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const holding = progress > 0;

  const startedAt = useRef(0);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  });

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (frame.current !== null || fired.current) return;
    startedAt.current = performance.now();

    // The hold completes on a timer, so it takes exactly holdMs however slowly the browser
    // delivers animation frames (a busy phone, or headless WebKit under load, can stretch a
    // frame-counted hold well past two seconds). The frames below only draw the fill.
    timer.current = setTimeout(() => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      timer.current = null;
      fired.current = true;
      setProgress(0);
      onConfirmRef.current();
    }, holdMs);

    const tick = () => {
      // Never exactly 0 while holding (so `holding` is true from the first frame), and never
      // quite 1: the timer is what finishes it.
      const fraction = Math.min((performance.now() - startedAt.current) / holdMs, 0.999);
      setProgress(Math.max(fraction, 0.001));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [holdMs]);

  // Let go of a finished hold (so a failed action can be tried again), and
  // stop the animation if the button goes away mid-hold.
  useEffect(() => {
    if (!holding) fired.current = false;
  }, [holding]);
  useEffect(() => cancel, [cancel]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      start();
    }
  }
  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") cancel();
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button === 0) start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={cancel}
      onContextMenu={(event) => event.preventDefault()}
      // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
      style={{ borderColor: "var(--danger)" }}
      className="relative select-none overflow-hidden rounded-lg border-2 px-5 py-2.5 font-semibold text-danger transition-opacity [touch-action:none] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-danger/25"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{holding ? holdingLabel : children}</span>
    </button>
  );
}
