import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AboutWindow } from "@/components/about/AboutWindow";
import { formatDuration } from "@/lib/game/time";
import type { AccuracyBucket, ProfileStats } from "@/lib/profile/stats";

const MODE_LABELS = { NAME: "Guess by name", SHAPE: "Guess by shape" } as const;
const DIFFICULTY_LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;
const DIFFICULTY_COLORS = {
  EASY: "var(--success)",
  MEDIUM: "var(--warning)",
  HARD: "var(--danger)",
} as const;

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Lifetime numbers across every round saved under the current scoring. */
export function StatsWindow({ stats }: { stats: ProfileStats }) {
  if (stats.roundsPlayed === 0) {
    return (
      <AboutWindow title="Stats" delay={0.1}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="max-w-sm leading-relaxed text-muted">
            Nothing here yet. Finish a round while signed in and your stats will start filling in.
          </p>
          <Link
            href="/setup"
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Play a round
          </Link>
        </div>
      </AboutWindow>
    );
  }

  const best = stats.bestScore;

  return (
    <AboutWindow title="Stats" delay={0.1}>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Rounds played" value={String(stats.roundsPlayed)} />
        <Tile label="Total score" value={stats.totalScore.toLocaleString()} />
        <Tile
          label="Best round"
          value={best ? String(best.score) : "-"}
          hint={
            best
              ? `${DIFFICULTY_LABELS[best.difficulty]} · ${MODE_LABELS[best.mode]} · ${best.roundLength}`
              : undefined
          }
        />
        <Tile
          label="Accuracy"
          value={stats.accuracy === null ? "-" : percent(stats.accuracy)}
          hint={`${stats.countriesGuessed} of ${stats.questionsAnswered} countries`}
        />
        <Tile
          label="Best streak"
          value={String(stats.bestStreak)}
          icon={
            <Image
              src="/images/streak-fire.png"
              alt=""
              width={16}
              height={23}
              unoptimized
              className={stats.bestStreak >= 3 ? "" : "opacity-60 grayscale-[40%]"}
            />
          }
        />
        <Tile label="Neighbor guesses" value={String(stats.neighborGuesses)} hint="close wrong guesses" />
        <Tile
          label="Time played"
          value={stats.totalTimeMs > 0 ? formatDuration(stats.totalTimeMs) : "-"}
          hint="spent answering"
        />
        <Tile
          label="Avg per country"
          value={
            stats.averageTimePerCountryMs === null
              ? "-"
              : `${(stats.averageTimePerCountryMs / 1000).toFixed(1)}s`
          }
        />
        <Tile label="Countries guessed" value={String(stats.countriesGuessed)} />
      </dl>

      {stats.fastestRounds.length > 0 && (
        <section aria-labelledby="fastest-rounds" className="flex flex-col gap-2">
          <h3 id="fastest-rounds" className="font-display text-lg font-semibold">
            Fastest rounds
          </h3>
          <ul className="flex flex-wrap gap-2">
            {stats.fastestRounds.map(({ roundLength, timeMs }) => (
              <li
                key={roundLength}
                className="flex items-center gap-2 rounded-full border border-border-strong bg-surface-2/70 px-3.5 py-1.5 text-sm"
              >
                <span className="text-muted">{roundLength} countries</span>
                <span className="font-display font-bold tabular-nums">{formatDuration(timeMs)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="accuracy-split" className="flex flex-col gap-3">
        <h3 id="accuracy-split" className="font-display text-lg font-semibold">
          Accuracy
        </h3>
        <div className="flex flex-col gap-2.5">
          {(Object.keys(DIFFICULTY_LABELS) as (keyof typeof DIFFICULTY_LABELS)[]).map((key) => (
            <AccuracyBar
              key={key}
              label={DIFFICULTY_LABELS[key]}
              bucket={stats.byDifficulty[key]}
              color={DIFFICULTY_COLORS[key]}
            />
          ))}
          <div className="my-1 border-t border-border/70" />
          {(Object.keys(MODE_LABELS) as (keyof typeof MODE_LABELS)[]).map((key) => (
            <AccuracyBar
              key={key}
              label={MODE_LABELS[key]}
              bucket={stats.byMode[key]}
              color="var(--accent-strong)"
            />
          ))}
        </div>
      </section>
    </AboutWindow>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-border bg-surface-2/60 px-3 py-3.5 text-center">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums">
        {icon}
        {value}
      </dd>
      {hint && <span className="max-w-full truncate text-[11px] text-muted-2">{hint}</span>}
    </div>
  );
}

function AccuracyBar({
  label,
  bucket,
  color,
}: {
  label: string;
  bucket: AccuracyBucket;
  color: string;
}) {
  const played = bucket.questions > 0;
  const fraction = played ? bucket.correct / bucket.questions : 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <div
        role="img"
        aria-label={played ? `${percent(fraction)} accuracy` : "No rounds yet"}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: percent(fraction), backgroundColor: color }}
        />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums">
        {played ? (
          <>
            <strong>{percent(fraction)}</strong>
            <span className="ml-1 text-xs text-muted-2">({bucket.rounds})</span>
          </>
        ) : (
          <span className="text-muted-2">no rounds</span>
        )}
      </span>
    </div>
  );
}
