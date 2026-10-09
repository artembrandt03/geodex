"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface MobileNavMenuProps {
  pathname: string;
  /** The signed-in player's display name, or null for a guest; undefined while the session loads. */
  userName: string | null | undefined;
  /** Navigates the way every other nav link does (guarded against abandoning a round). */
  go: (href: string) => void;
  signOut: () => void;
}

/**
 * The phone version of the nav's right-hand side: one hamburger button that
 * opens a panel under the header with every link. The header on a phone keeps
 * only the back arrow and the globe, because About, the Leaderboard sign and
 * the account buttons side by side didn't fit.
 */
export function MobileNavMenu({ pathname, userName, go, signOut }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Close when the route changes (a link was followed). Adjusting state during
  // render, not in an effect, is this codebase's pattern for that (see CLAUDE.md).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function item(href: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      setOpen(false);
      go(href);
    };
  }

  const linkClass = (href: string) =>
    `flex items-center rounded-lg px-3 py-3 font-display text-base font-semibold tracking-tight transition-colors hover:bg-surface-2 ${
      pathname === href ? "bg-surface-2 text-foreground" : "text-muted"
    }`;

  return (
    <div className="justify-self-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-surface text-foreground transition-colors hover:bg-surface-2"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
          className="h-5 w-5"
        >
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5.5h14M3 10h14M3 14.5h14" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Tap anywhere outside the panel to close it. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-black/20"
          />
          <div
            id={panelId}
            className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 border-b border-border bg-surface px-4 py-3 shadow-xl"
          >
            <Link href="/about" onClick={item("/about")} className={linkClass("/about")}>
              About
            </Link>
            <Link href="/leaderboard" onClick={item("/leaderboard")} className={linkClass("/leaderboard")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/leaderboard.png" alt="Leaderboard" className="h-7 w-auto" />
            </Link>

            <div className="my-1 border-t border-border" />

            {userName === undefined ? null : userName !== null ? (
              <>
                <Link href="/profile" onClick={item("/profile")} className={linkClass("/profile")}>
                  {/* `unoptimized`: transparent PNG, see CLAUDE.md's WebP-alpha caution. */}
                  <span className="relative mr-3 h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-accent-strong bg-gradient-to-br from-surface to-surface-2">
                    <Image
                      src="/images/user-avatar.png"
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-0.5"
                    />
                  </span>
                  <span className="truncate">{userName}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="rounded-lg px-3 py-3 text-left font-display text-base font-semibold tracking-tight text-muted transition-colors hover:bg-surface-2"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={item("/login")} className={linkClass("/login")}>
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={item("/register")}
                  className="rounded-lg bg-primary px-3 py-3 text-center font-semibold text-primary-foreground"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
