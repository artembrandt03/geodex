import { Suspense } from "react";
import { PlayGame } from "./PlayGame";

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayGame />
    </Suspense>
  );
}
