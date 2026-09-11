"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";

export function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="relative z-20 border-b border-border bg-surface/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <motion.span
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="inline-block"
          >
            🌍
          </motion.span>
          Geodex
        </Link>

        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/leaderboard"
            className={`transition-colors hover:text-foreground ${
              pathname === "/leaderboard" ? "font-medium text-foreground" : "text-muted"
            }`}
          >
            Leaderboard
          </Link>

          {status === "loading" ? null : session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-muted">{session.user.name}</span>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-border-strong px-3 py-1.5 transition-colors hover:bg-surface-2"
              >
                Sign out
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-muted transition-colors hover:text-foreground">
                Log in
              </Link>
              <Link href="/register">
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
