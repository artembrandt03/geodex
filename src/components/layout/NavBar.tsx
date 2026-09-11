"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function NavBar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🌍 Geodex
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/leaderboard" className="hover:underline">
            Leaderboard
          </Link>

          {status === "loading" ? null : session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-600 dark:text-gray-300">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-black/10 px-3 py-1 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
