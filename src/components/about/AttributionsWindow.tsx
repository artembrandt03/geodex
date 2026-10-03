import { AboutWindow } from "./AboutWindow";

/** Empty for now; credits (data, artwork, libraries) get listed here later. */
export function AttributionsWindow() {
  return (
    <AboutWindow title="Attributions" delay={0.3}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 p-6 text-center">
        <p className="font-display text-lg font-semibold">Nothing here yet</p>
        <p className="text-sm text-muted">Credits will be listed here.</p>
      </div>
    </AboutWindow>
  );
}
