import type { ReactNode } from "react";

/**
 * The look shared by the 404 and error pages: a glass card over the map with
 * a big brass code, a title, a line of explanation and the way back.
 *
 * `pointer-events-auto` because on /play the app shell makes <main>
 * click-through (so the map underneath stays clickable), which would
 * otherwise leave an error card on that route impossible to click.
 */
export function StatusPage({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="pointer-events-auto flex h-full justify-center overflow-y-auto px-4 py-10">
      <div className="my-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface/85 p-10 text-center shadow-2xl backdrop-blur-md">
        <p
          aria-hidden
          className="font-display text-7xl font-bold leading-none tracking-wide text-accent-strong"
        >
          {code}
        </p>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <div className="leading-relaxed text-muted">{children}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}

const buttonBase = "rounded-lg px-5 py-2.5 font-semibold transition-transform active:scale-[0.98]";

/** Primary action style for StatusPage buttons and links. */
export const statusPrimaryClass = `${buttonBase} bg-primary text-primary-foreground hover:scale-[1.03]`;
/** Secondary action style. */
export const statusSecondaryClass = `${buttonBase} border border-border-strong font-medium transition-colors hover:bg-surface-2`;
