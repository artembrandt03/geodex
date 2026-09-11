"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  ZoomableGroup,
} from "react-simple-maps";
import { motion } from "framer-motion";

const GEOGRAPHY_URL = "/data/countries-50m.json";
const COUNTRY_CODES_URL = "/data/country-codes.json";

const DEFAULT_CENTER: [number, number] = [10, 15];
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const COLORS = {
  land: "var(--map-land)",
  landHover: "var(--map-land-hover)",
  correct: "var(--success)",
  incorrect: "var(--danger)",
  border: "var(--map-border)",
};

export interface WorldMapProps {
  /** Clickable (guess-by-name mode) vs. static display (guess-by-shape mode). */
  interactive: boolean;
  /** Shape mode: the target country to highlight before the player answers. */
  highlightedCode?: string | null;
  /** Country to color as feedback after a guess is submitted. */
  feedbackCode?: string | null;
  feedbackCorrect?: boolean;
  /** Fires with the clicked country's ISO alpha-3 code (or null if unresolved). */
  onCountryClick?: (code: string | null) => void;
  /** Changing this value smoothly recenters the map to the default view (e.g. per question). */
  resetSignal?: string | number;
}

/** World map on an equirectangular (cylindrical) projection — pannable and zoomable. */
export function WorldMap({
  interactive,
  highlightedCode,
  feedbackCode,
  feedbackCorrect,
  onCountryClick,
  resetSignal,
}: WorldMapProps) {
  const [codeByNumericId, setCodeByNumericId] = useState<Record<string, string> | null>(
    null,
  );
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const isFirstResetSignal = useRef(true);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRY_CODES_URL)
      .then((res) => res.json())
      .then((data: Record<string, string>) => {
        if (!cancelled) setCodeByNumericId(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Smoothly recenter between questions rather than leaving the player
  // stranded wherever they last panned.
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
  }, [resetSignal]);

  const resolveCode = useCallback(
    (geoId: string | number | undefined) =>
      geoId === undefined ? null : (codeByNumericId?.[String(geoId)] ?? null),
    [codeByNumericId],
  );

  const zoomIn = () => setZoom((z) => Math.min(z * 1.6, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.6, MIN_ZOOM));
  const resetView = () => {
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      style={{
        background: "radial-gradient(120% 120% at 50% 20%, var(--map-ocean-2), var(--map-ocean-1))",
      }}
    >
      <ComposableMap
        projection="geoEquirectangular"
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={({ coordinates, zoom: z }) => {
            if (coordinates) setCenter(coordinates);
            if (z) setZoom(z);
          }}
        >
          <Graticule stroke="rgba(148, 163, 184, 0.08)" strokeWidth={0.5} />
          <Geographies geography={GEOGRAPHY_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = resolveCode(geo.id);
                const isHighlighted = Boolean(highlightedCode && code === highlightedCode);
                const isFeedback = Boolean(feedbackCode && code === feedbackCode);

                let fill = COLORS.land;
                if (isFeedback) {
                  fill = feedbackCorrect ? COLORS.correct : COLORS.incorrect;
                } else if (interactive && hoveredKey === geo.rsmKey) {
                  fill = COLORS.landHover;
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className={isHighlighted && !isFeedback ? "geo-highlighted" : undefined}
                    onClick={() => {
                      if (interactive) onCountryClick?.(code);
                    }}
                    onMouseEnter={() => interactive && setHoveredKey(geo.rsmKey)}
                    onMouseLeave={() => interactive && setHoveredKey(null)}
                    style={{
                      fill: isHighlighted && !isFeedback ? undefined : fill,
                      stroke: COLORS.border,
                      strokeWidth: 0.4 / zoom,
                      outline: "none",
                      cursor: interactive ? "pointer" : "default",
                      transition: "fill 200ms ease",
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <MapButton onClick={zoomIn} label="Zoom in">
          +
        </MapButton>
        <MapButton onClick={zoomOut} label="Zoom out">
          −
        </MapButton>
        <MapButton onClick={resetView} label="Reset view" small>
          ⟲
        </MapButton>
      </div>
    </div>
  );
}

function MapButton({
  onClick,
  label,
  small,
  children,
}: {
  onClick: () => void;
  label: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={`flex items-center justify-center rounded-full border border-border-strong bg-surface/80 font-semibold text-foreground shadow-lg backdrop-blur-sm ${
        small ? "h-8 w-8 text-sm" : "h-10 w-10 text-xl"
      }`}
    >
      {children}
    </motion.button>
  );
}
