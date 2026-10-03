"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useNavVisibility } from "@/components/providers/NavVisibilityProvider";
import { useRoundGuard } from "@/components/providers/RoundGuardProvider";

export function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { hidden } = useNavVisibility();
  const { guardedAction } = useRoundGuard();

  if (hidden) return null;

  // Routes through guardedAction so leaving mid-round (see RoundGuardProvider)
  // asks for confirmation instead of silently abandoning it; harmless when no
  // round is active, since guardedAction just runs the navigation right away.
  function goTo(href: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      guardedAction(() => router.push(href));
    };
  }

  return (
    <header className="pointer-events-auto relative z-20 border-b border-border bg-surface/70 backdrop-blur-md">
      {/* Three equal-weight columns so the middle link is truly centered, not
          merely between two sides of different widths. */}
      <nav className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
        <div className="flex items-center gap-5 justify-self-start">
          {/* Back to the cosmos title screen ("/"). The tooltip is plain CSS
              (hover or keyboard focus) so it needs no state; it drops below
              the arrow because the nav sits at the very top of the page. */}
          <Link
            href="/"
            onClick={goTo("/")}
            aria-label="Back to title screen"
            className="group relative -mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            >
              <path d="M12 4l-6 6 6 6" />
            </svg>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-30 mt-2 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              Back to title screen
            </span>
          </Link>

          <Link
            href="/setup"
            onClick={goTo("/setup")}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          >
            <motion.span
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12 }}
              className="inline-block"
            >
              <Image src="/images/earth.png" alt="" width={24} height={24} />
            </motion.span>
            Geodex
          </Link>

          <Link
            href="/about"
            onClick={goTo("/about")}
            className={`font-display text-base font-semibold tracking-tight transition-colors hover:text-foreground ${
              pathname === "/about" ? "text-foreground" : "text-muted"
            }`}
          >
            About
          </Link>
        </div>

        <div className="justify-self-center">
          <Link
            href="/leaderboard"
            onClick={goTo("/leaderboard")}
            className={`transition-opacity hover:opacity-80 ${
              pathname === "/leaderboard" ? "opacity-100" : "opacity-90"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/leaderboard.png" alt="Leaderboard" className="h-7 w-auto" />
          </Link>
        </div>

        <div className="flex items-center gap-5 justify-self-end text-sm">
          {status === "loading" ? null : session?.user ? (
            <div className="flex items-center gap-3">
              {/* The name is the way to the profile page, so it's styled as a
                  button (avatar, border, hover lift, tooltip) rather than as
                  plain text that nobody would think to click. */}
              <Link
                href="/profile"
                onClick={goTo("/profile")}
                aria-label={`${session.user.name}, view your profile`}
                className={`group relative flex items-center gap-2 rounded-full border border-border-strong py-1 pl-1 pr-3 transition-all hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-md ${
                  pathname === "/profile" ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {/* `unoptimized`: transparent PNG, see CLAUDE.md's WebP-alpha caution. */}
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-accent-strong bg-gradient-to-br from-surface to-surface-2">
                  <Image
                    src="/images/user-avatar.png"
                    alt=""
                    fill
                    unoptimized
                    className="object-contain p-0.5"
                  />
                </span>
                <span className="max-w-32 truncate font-medium">{session.user.name}</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M7 4l6 6-6 6" />
                </svg>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  View your profile
                </span>
              </Link>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => guardedAction(() => signOut({ callbackUrl: "/" }))}
                className="rounded-lg border border-border-strong px-3 py-1.5 transition-colors hover:bg-surface-2"
              >
                Sign out
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                onClick={goTo("/login")}
                className="text-muted transition-colors hover:text-foreground"
              >
                Log in
              </Link>
              <Link href="/register" onClick={goTo("/register")}>
                <motion.span
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-block rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground"
                >
                  Sign up
                </motion.span>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
