"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeroScene } from "@/components/landing/HeroScene";

/**
 * Landing flow: space + spinning earth, "Play" zooms into the earth then
 * navigates to /setup. A dedicated route for /setup (rather than internal
 * component state) means NavVisibilityProvider's own pathname check hides
 * the nav bar here and shows it there with no extra effect needed, and the
 * nav bar's "Geodex" link can jump straight to /setup, skipping this intro.
 */
export default function Home() {
  const router = useRouter();
  const [zoomingIn, setZoomingIn] = useState(false);

  function handlePlay() {
    setZoomingIn(true);
    // Give the zoom-in a moment to play before the route actually changes.
    setTimeout(() => {
      router.push("/setup");
    }, 900);
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <HeroScene transitioning={zoomingIn} onPlay={handlePlay} />
    </div>
  );
}
