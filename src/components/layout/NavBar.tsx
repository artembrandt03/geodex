"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useNavVisibility } from "@/components/providers/NavVisibilityProvider";

export function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { hidden } = useNavVisibility();

  if (hidden) return null;

  return (
    <header className="relative z-20 border-b border-border bg-surface/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <motion.span
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image's
                optimizer can strip animation frames from an animated webp */}
            <img src="/images/earth-rotating.webp" alt="" width={24} height={24} className="rounded-full" />
          </motion.span>
          Geodex
        </Link>

        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/leaderboard"
            className={`transition-opacity hover:opacity-80 ${
              pathname === "/leaderboard" ? "opacity-100" : "opacity-90"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/leaderboard.png" alt="Leaderboard" className="h-7 w-auto" />
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
