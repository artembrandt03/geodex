"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { LATEST_UPDATE } from "@/lib/updates";
import { AboutWindow } from "./AboutWindow";
import { UpdatesList } from "./UpdatesList";

/**
 * Shows the latest update; clicking anywhere on the window opens a popup
 * listing every version's updates. `initialOpen` lets the title screen's
 * News teaser deep-link straight to that popup (/about?updates=open).
 */
export function NewsWindow({ initialOpen = false }: { initialOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);

  function close() {
    setOpen(false);
    // If we got here via the deep link, drop the query so a refresh (or
    // back/forward) doesn't pop the dialog open again.
    if (initialOpen) router.replace("/about", { scroll: false });
  }

  return (
    <>
      <AboutWindow title="News & updates" delay={0.2} interactive>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 p-6 text-center">
          <span className="rounded-full border border-accent-strong px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-primary-hover">
            {LATEST_UPDATE.version}
          </span>
          <p className="font-display text-lg font-semibold">{LATEST_UPDATE.title}</p>
          <p className="text-sm text-muted">Updates will show up here as they land.</p>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary-hover">
          See all updates
          <span aria-hidden>↗</span>
        </p>

        {/* Stretched over the whole window so all of it is clickable, while the
            heading above stays a plain heading. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="Open all updates"
          className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </AboutWindow>

      <Modal open={open} onClose={close} title="News & updates" size="lg">
        <UpdatesList />
      </Modal>
    </>
  );
}
