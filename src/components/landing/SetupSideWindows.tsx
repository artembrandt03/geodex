"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { LATEST_UPDATE } from "@/lib/updates";

/** Shared look for the small windows beside the setup panel. */
const windowClass =
  "group block rounded-2xl border border-border bg-surface/80 p-5 text-left shadow-2xl backdrop-blur-md";

/**
 * Small windows that sit beside the setup panel on wide screens (hanging off
 * its right edge, sized to the free space) and drop below it on narrower
 * ones. Must be rendered inside a `relative` wrapper that is exactly as wide
 * as the panel, since the wide-screen placement is `left-full`.
 */
export function SetupSideWindows() {
  return (
    <aside
      aria-label="News and feedback"
      className="mt-6 grid gap-4 md:grid-cols-2 2xl:absolute 2xl:left-full 2xl:top-0 2xl:ml-6 2xl:mt-0 2xl:w-[min(32rem,calc(50vw_-_27rem))] 2xl:grid-cols-1"
    >
      <NewsTeaser />
      <FeedbackTeaser />
    </aside>
  );
}

/** Latest update at a glance; links to the About page's full updates popup. */
function NewsTeaser() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
    >
      <Link href="/about?updates=open" className={windowClass}>
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          News &amp; updates
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-accent-strong px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-primary-hover">
            {LATEST_UPDATE.version}
          </span>
          <span className="font-display text-lg font-semibold leading-snug">
            {LATEST_UPDATE.title}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary-hover transition-transform group-hover:translate-x-0.5">
          See all updates
          <span aria-hidden>↗</span>
        </p>
      </Link>
    </motion.div>
  );
}

/** Opens the bug report / feedback form in a popup right over the title screen. */
function FeedbackTeaser() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={`${windowClass} w-full`}
        >
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
            Bug reports &amp; feedback
          </p>
          <p className="mt-3 font-display text-lg font-semibold leading-snug">
            Tell us what you think
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Found a bug, or have a thought about anything at all? Send it our way.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary-hover transition-transform group-hover:translate-x-0.5">
            Send a report
            <span aria-hidden>↗</span>
          </p>
        </button>
      </motion.div>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
