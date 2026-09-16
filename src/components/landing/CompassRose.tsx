/** A simple decorative compass rose — a nod to the cartography theme. */
export function CompassRose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor">
      <circle cx="100" cy="100" r="92" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="70" strokeWidth="1" />
      <path d="M100 8 L112 100 L100 192 L88 100 Z" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M8 100 L100 88 L192 100 L100 112 Z" fill="currentColor" stroke="none" opacity="0.9" />
      <g transform="rotate(45 100 100)">
        <path d="M100 30 L108 100 L100 170 L92 100 Z" fill="currentColor" stroke="none" opacity="0.55" />
        <path d="M30 100 L100 92 L170 100 L100 108 Z" fill="currentColor" stroke="none" opacity="0.55" />
      </g>
      <circle cx="100" cy="100" r="6" fill="currentColor" stroke="none" />
    </svg>
  );
}
