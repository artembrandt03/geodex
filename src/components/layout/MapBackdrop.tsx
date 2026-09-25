"use client";

import { WorldMap } from "@/components/game/WorldMap";
import { CloudLayer } from "@/components/landing/CloudLayer";

/** The same map-plus-drifting-clouds backdrop used behind the setup screen, reused on any page that wants that atlas-in-the-sky feel behind a glass panel. */
export function MapBackdrop() {
  return (
    <>
      <div className="absolute inset-0">
        <WorldMap interactive={false} showZoomControls={false} />
      </div>
      <CloudLayer fadeOut={false} />
    </>
  );
}
