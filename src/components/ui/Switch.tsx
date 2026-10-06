"use client";

/** An on/off switch (role="switch"); the caller owns the state. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name; also describes it to screen readers. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // Inline: globals.css's unlayered `* { border-color }` beats border-<color> classes.
      style={{ borderColor: checked ? "var(--success)" : "var(--border-strong)" }}
      className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors disabled:cursor-wait disabled:opacity-60 ${
        checked ? "bg-success/30" : "bg-surface-2"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-all ${
          checked ? "left-[1.4rem] bg-success" : "left-0.5 bg-muted"
        }`}
      />
    </button>
  );
}
