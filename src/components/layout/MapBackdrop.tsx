"use client";

import { WorldMap } from "@/components/game/WorldMap";
import { CloudLayer } from "@/components/landing/CloudLayer";

/** The map-plus-drifting-clouds backdrop shown behind the setup, leaderboard, login, and register pages. Rendered once by MapBackdropProvider — see there for why. */
export function MapBackdrop({ fadeOut = false }: { fadeOut?: boolean }) {
  return (
    <>
      <div className="absolute inset-0">
        <WorldMap interactive={false} showZoomControls={false} />
      </div>
      <CloudLayer fadeOut={fadeOut} />
    </>
  );
}
