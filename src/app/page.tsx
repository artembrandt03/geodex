"use client";

import { useEffect, useState } from "react";
import { HeroScene } from "@/components/landing/HeroScene";
import { SetupScene } from "@/components/landing/SetupScene";
import { useNavVisibility } from "@/components/providers/NavVisibilityProvider";

type Stage = "hero" | "setup";

/**
 * Landing flow: space + spinning earth, "Play" zooms into the map/setup
 * screen, which in turn zooms into the game itself on start.
 *
 * Deliberately not using AnimatePresence here (see CLAUDE.md's
 * "framer-motion caution") — the hero stays mounted and animates via a
 * controlled `animate` prop until it's fully zoomed away, then we swap to
 * the setup scene with a plain conditional render.
 */
export default function Home() {
  const [stage, setStage] = useState<Stage>("hero");
  const [zoomingIn, setZoomingIn] = useState(false);
  const { setHidden } = useNavVisibility();

  // Nav bar is hidden for the immersive space intro, restored once we're on
  // the setup screen (and on unmount, so leaving "/" never leaves it hidden).
  useEffect(() => {
    setHidden(stage === "hero");
    return () => setHidden(false);
  }, [stage, setHidden]);

  function handlePlay() {
    setZoomingIn(true);
    setTimeout(() => {
      setStage("setup");
      setZoomingIn(false);
    }, 900);
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {stage === "hero" ? (
        <HeroScene transitioning={zoomingIn} onPlay={handlePlay} />
      ) : (
        <SetupScene />
      )}
    </div>
  );
}
