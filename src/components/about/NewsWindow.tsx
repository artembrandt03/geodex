import { AboutWindow } from "./AboutWindow";

/** No posts yet; just a status note until there are updates to list. */
export function NewsWindow() {
  return (
    <AboutWindow title="News & updates" delay={0.2}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 p-6 text-center">
        <span className="rounded-full border border-accent-strong px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-primary-hover">
          v-1.0
        </span>
        <p className="font-display text-lg font-semibold">
          We&apos;re working on version v-1.0!
        </p>
        <p className="text-sm text-muted">Updates will show up here as they land.</p>
      </div>
    </AboutWindow>
  );
}
