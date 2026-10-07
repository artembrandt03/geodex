import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page itself is a client component, which can't export metadata, so its
// tab title lives on this pass-through layout.
export const metadata: Metadata = {
  title: "Leaderboard | Geodex",
  description: "See who tops the Geodex leaderboards, by game mode, difficulty and round length.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
