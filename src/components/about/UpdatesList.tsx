import { UPDATES } from "@/lib/updates";

/** Every version update, newest first, as shown in the News popup. */
export function UpdatesList() {
  return (
    <ol className="flex flex-col gap-4">
      {UPDATES.map((update) => (
        <li
          key={update.version}
          className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/50 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent-strong px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-primary-hover">
              {update.version}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                update.status === "in-progress"
                  ? "bg-warning/20 text-warning"
                  : "bg-success/20 text-success"
              }`}
            >
              {update.status === "in-progress" ? "In progress" : "Released"}
            </span>
            {update.date && <span className="text-xs text-muted">{update.date}</span>}
          </div>

          <h3 className="font-display text-lg font-semibold">{update.title}</h3>

          {update.notes.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {update.notes.map((note) => (
                <li key={note} className="flex gap-2.5 text-sm leading-snug">
                  <span aria-hidden className="mt-0.5 text-accent-strong">
                    ◆
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {update.status === "in-progress"
                ? "Release notes will appear here once it ships."
                : "No notes for this release."}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
