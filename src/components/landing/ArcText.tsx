"use client";

export interface ArcTextProps {
  text: string;
  /** Distance from the text baseline to the arc's center (roughly the earth's center). */
  radius: number;
  /** Half of the total angular sweep, in degrees — smaller reads as a gentler curve. */
  halfSpanDeg: number;
  /** "top" arches over the center like a dome; "bottom" curves under it like a smile. */
  position: "top" | "bottom";
  className?: string;
  charClassName?: string;
}

// The browser's CSS parser can reformat long floating-point transform values
// when it parses the server-rendered HTML, which then mismatches React's own
// full-precision client computation during hydration. Rounding avoids it.
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Lays text out along an arc of a circle, character by character — a subtler,
 * partial-sweep take on the classic "circular text" effect (react-bits'
 * CircularText wraps a full 360°; here we only need a gentle top/bottom arc
 * flanking the earth). Both directions stay upright and readable rather than
 * following the literal full-circle convention, which would render the
 * bottom text upside down.
 *
 * Must be placed inside a `position: relative` parent — it anchors itself to
 * that parent's exact center point (`left-1/2 top-1/2`) and every character
 * is positioned/rotated relative to that point.
 */
export function ArcText({
  text,
  radius,
  halfSpanDeg,
  position,
  className,
  charClassName,
}: ArcTextProps) {
  const chars = Array.from(text);
  const n = chars.length;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-1/2 ${className ?? ""}`}
      aria-hidden="true"
    >
      {chars.map((ch, i) => {
        const t = n === 1 ? 0 : -halfSpanDeg + (i * (2 * halfSpanDeg)) / (n - 1);
        const rad = (t * Math.PI) / 180;
        const x = round3(radius * Math.sin(rad));
        const y = round3(position === "top" ? -radius * Math.cos(rad) : radius * Math.cos(rad));
        const rotate = round3(position === "top" ? t : -t);

        return (
          <span
            key={i}
            className={`absolute inline-block ${charClassName ?? ""}`}
            style={{
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg)`,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
      {/* Screen readers get the plain string; the spans above are decorative. */}
      <span className="sr-only">{text}</span>
    </div>
  );
}
