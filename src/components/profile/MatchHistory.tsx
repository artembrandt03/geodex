"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AboutWindow } from "@/components/about/AboutWindow";
import { formatDuration } from "@/lib/game/time";

const PAGE_SIZE = 10;

interface HistoryRound {
  id: string;
  createdAt: string;
  mode: "NAME" | "SHAPE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  roundLength: number;
  score: number;
  correct: number;
  totalTimeMs: number;
  bestStreak: number;
  neighborCount: number;
}

interface HistoryPage {
  rounds: HistoryRound[];
  page: number;
  total: number;
  totalPages: number;
}

const MODE_LABELS = { NAME: "Name", SHAPE: "Shape" } as const;
const DIFFICULTY_LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;
const DIFFICULTY_COLORS = {
  EASY: "var(--success)",
  MEDIUM: "var(--warning)",
  HARD: "var(--danger)",
} as const;

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** The player's rounds, newest first, ten to a page (padded so the table keeps its height). */
export function MatchHistory() {
  const [page, setPage] = useState(1);
  // Tagged with the page it was fetched for, so a result that doesn't match
  // the requested page counts as "still loading" instead of flashing the
  // previous page's rows under the new page number.
  const [loaded, setLoaded] = useState<{ page: number; data: HistoryPage | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<HistoryPage | null> {
      try {
        const res = await fetch(`/api/profile/history?page=${page}`, { cache: "no-store" });
        return res.ok ? ((await res.json()) as HistoryPage) : null;
      } catch {
        return null;
      }
    }

    void load().then((data) => {
      if (!cancelled) setLoaded({ page, data });
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const current = loaded?.page === page ? loaded : null;
  const failed = current !== null && current.data === null;
  const data = current?.data ?? null;
  const rounds = data?.rounds ?? [];
  const empty = data !== null && data.total === 0;

  return (
    <AboutWindow title="Match history" delay={0.2}>
      {failed && (
        <p className="text-sm text-danger">Couldn&apos;t load your match history. Try again in a moment.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-2/50">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 font-medium">Played</th>
              <th className="px-3 py-2.5 font-medium">Mode</th>
              <th className="px-3 py-2.5 font-medium">Difficulty</th>
              <th className="px-3 py-2.5 text-right font-medium">Length</th>
              <th className="px-3 py-2.5 text-right font-medium">Score</th>
              <th className="px-3 py-2.5 text-right font-medium">Correct</th>
              <th className="px-3 py-2.5 text-right font-medium">Time</th>
              <th className="px-3 py-2.5 text-right font-medium">Streak</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <p className="mb-3 text-muted">No rounds yet. Your first one will show up here.</p>
                  <Link
                    href="/setup"
                    className="inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
                  >
                    Play a round
                  </Link>
                </td>
              </tr>
            ) : (
              Array.from({ length: PAGE_SIZE }, (_, i) => {
                const round = rounds[i];
                return (
                  <tr key={round?.id ?? `blank-${i}`} className="h-11 border-b border-border/60 last:border-0">
                    {round ? <RoundCells round={round} /> : <BlankCells loading={current === null} />}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <nav aria-label="Match history pages" className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border-strong px-3.5 py-1.5 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Newer
          </button>
          <span className="text-muted">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-lg border border-border-strong px-3.5 py-1.5 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Older
          </button>
        </nav>
      )}
    </AboutWindow>
  );
}

function RoundCells({ round }: { round: HistoryRound }) {
  return (
    <>
      <td className="whitespace-nowrap px-3 py-2 text-muted">{dateFormat.format(new Date(round.createdAt))}</td>
      <td className="px-3 py-2">{MODE_LABELS[round.mode]}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: DIFFICULTY_COLORS[round.difficulty] }}
          />
          {DIFFICULTY_LABELS[round.difficulty]}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{round.roundLength}</td>
      <td className="px-3 py-2 text-right font-display font-bold tabular-nums text-primary">{round.score}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {round.correct}/{round.roundLength}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {round.totalTimeMs > 0 ? formatDuration(round.totalTimeMs) : "-"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{round.bestStreak}</td>
    </>
  );
}

function BlankCells({ loading }: { loading: boolean }) {
  return (
    <td colSpan={8} className="px-3 py-2">
      {loading ? (
        <span aria-hidden className="block h-3 w-2/3 animate-pulse rounded-full bg-border-strong/40" />
      ) : (
        <span aria-hidden className="text-muted-2">
          -
        </span>
      )}
    </td>
  );
}
