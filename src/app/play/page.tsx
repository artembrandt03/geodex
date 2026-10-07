import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayGame } from "./PlayGame";

export const metadata: Metadata = {
  title: "Playing | Geodex",
};

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayGame />
    </Suspense>
  );
}
