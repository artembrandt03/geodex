export interface UpdateEntry {
  version: string;
  title: string;
  status: "in-progress" | "released";
  /** Human-readable release date; only meaningful once released. */
  date?: string;
  /** Bullet points; leave empty until there's something to say. */
  notes: string[];
}

/**
 * Every version update, newest first. The About page's News window and the
 * title screen's teaser both read this, so a new release is just a new
 * entry at the top. The first entry is treated as the "latest".
 */
export const UPDATES: UpdateEntry[] = [
  {
    version: "v-1.0",
    title: "We're working on version v-1.0!",
    status: "in-progress",
    notes: [],
  },
];

export const LATEST_UPDATE = UPDATES[0];
