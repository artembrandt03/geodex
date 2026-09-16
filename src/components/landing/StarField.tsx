// Deterministic "random-looking" star positions (no Math.random — keeps the
// component pure to render, same reasoning as the round-summary confetti).
const STAR_COUNT = 90;

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 1 + (i % 3),
  delay: ((i * 17) % 30) / 10,
  duration: 2.5 + ((i * 7) % 20) / 10,
}));

/** A field of small twinkling stars for the space hero scene. */
export function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s) => (
        <span
          key={s.id}
          className="animate-twinkle absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            backgroundColor: "var(--space-star)",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
