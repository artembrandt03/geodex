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
const NARROW_VIEWPORT_ZOOM = 1.7; // a portrait phone letterboxes badly at zoom 1
const NARROW_BREAKPOINT_PX = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

function getDefaultZoomForViewport(baseZoom: number) {
  if (typeof window === "undefined") return baseZoom;
  return window.innerWidth < NARROW_BREAKPOINT_PX
    ? Math.max(baseZoom, NARROW_VIEWPORT_ZOOM)
    : baseZoom;
}

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
  /** Overrides the resting zoom level (e.g. a closer view for a purely decorative map). */
  defaultZoom?: number;
  /** Overrides the resting center coordinates ([longitude, latitude]). */
  defaultCenter?: [number, number];
}

/** World map on an equirectangular (cylindrical) projection — pannable and zoomable. */
export function WorldMap({
  interactive,
  highlightedCode,
  feedbackCode,
  feedbackCorrect,
  onCountryClick,
  resetSignal,
  defaultZoom,
  defaultCenter,
}: WorldMapProps) {
  const restCenter = defaultCenter ?? DEFAULT_CENTER;
  const restZoom = defaultZoom ?? DEFAULT_ZOOM;

  const [codeByNumericId, setCodeByNumericId] = useState<Record<string, string> | null>(
    null,
  );
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(restCenter);
  const [zoom, setZoom] = useState(restZoom);
  const isFirstResetSignal = useRef(true);
  // Server-rendered default has no window to check; a mount-time effect
  // below adjusts this for narrow viewports so the map doesn't letterbox.
  const defaultZoomRef = useRef(restZoom);

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

  // Pick a closer default zoom on narrow (mostly mobile/portrait) viewports
  // so the equirectangular projection doesn't leave huge empty margins.
  useEffect(() => {
    defaultZoomRef.current = getDefaultZoomForViewport(restZoom);
    setZoom(defaultZoomRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smoothly recenter between questions rather than leaving the player
  // stranded wherever they last panned.
  useEffect(() => {
    if (isFirstResetSignal.current) {
      isFirstResetSignal.current = false;
      return;
    }
    setCenter(restCenter);
    setZoom(defaultZoomRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const resolveCode = useCallback(
    (geoId: string | number | undefined) =>
      geoId === undefined ? null : (codeByNumericId?.[String(geoId)] ?? null),
    [codeByNumericId],
  );

  const zoomIn = () => setZoom((z) => Math.min(z * 1.6, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.6, MIN_ZOOM));
  const resetView = () => {
    setCenter(restCenter);
    setZoom(defaultZoomRef.current);
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      style={{
        // A vertical gradient (rather than one anchored to a point) reads as
        // "more ocean" in the letterboxed margins on any aspect ratio,
        // instead of fading to near-black away from a fixed center.
        background: "linear-gradient(180deg, var(--map-ocean-2), var(--map-ocean-1))",
      }}
    >
      <ComposableMap
        projection="geoEquirectangular"
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
        // The map's internal viewBox is a fixed 4:3 (800x600); "slice" scales
        // it to fill the actual (usually much wider) container completely
        // instead of letterboxing empty margins on the sides.
        preserveAspectRatio="xMidYMid slice"
      >
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          translateExtent={[
            [-200, -150],
            [1000, 750],
          ]}
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
      whileHover={{ scale: 1.08, rotate: 3 }}
      whileTap={{ scale: 0.92 }}
      className={`flex items-center justify-center rounded-full border-2 border-accent-strong bg-surface/90 font-display font-bold text-primary-hover shadow-[inset_0_0_0_2px_var(--surface-2)] backdrop-blur-sm ${
        small ? "h-8 w-8 text-sm" : "h-11 w-11 text-xl"
      }`}
    >
      {children}
    </motion.button>
  );
}
