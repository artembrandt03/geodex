"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  ZoomableGroup,
} from "react-simple-maps";
import { animate, motion } from "framer-motion";
import { geoBounds, geoEquirectangular } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

const GEOGRAPHY_URL = "/data/countries-50m.json";
const COUNTRY_CODES_URL = "/data/country-codes.json";

const DEFAULT_CENTER: [number, number] = [10, 15];
const DEFAULT_ZOOM = 1;
const NARROW_VIEWPORT_ZOOM = 1.7; // a portrait phone letterboxes badly at zoom 1
const NARROW_BREAKPOINT_PX = 640;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

// Matches ComposableMap's own defaults (it's never given a projectionConfig),
// so projecting through this local instance lands on the same pixel
// coordinates react-simple-maps uses internally.
const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;
const FOCUS_PADDING_PX = 70;

const BASE_PROJECTION = geoEquirectangular().translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2]);
// The world's own bounding box in the untransformed viewBox's own coordinate
// space (i.e. where the content sits before any pan/zoom is applied).
//
// This is what react-simple-maps' ZoomableGroup wants for translateExtent —
// a FIXED, zoom-independent rectangle in content space, not (as an earlier,
// wrong version of this code assumed) a zoom-scaled range of raw translate
// pixel values. d3-zoom's own constrain function inverts the current
// transform to compare the viewport against this content rectangle, so it
// already handles scaling correctly at any zoom: it clamps panning once the
// content's edge would go past the viewport's edge (content taller/wider
// than the viewport) and centers the content when the viewport is bigger
// than the content (e.g. the default zoomed-out view, where the map is
// naturally shorter than an ultra-wide viewport). Confirmed by trying to
// hand-roll a zoom-scaled version instead: it either clamped legitimate
// reveal-zoom fits (a Panama/Poland reveal got clipped) or, once loosened,
// let manual dragging reveal far more blank space than intended.
const WORLD_TRANSLATE_EXTENT: [[number, number], [number, number]] = (() => {
  const halfWidth = BASE_PROJECTION([180, 0])![0] - VIEWBOX_WIDTH / 2;
  const halfHeight = VIEWBOX_HEIGHT / 2 - BASE_PROJECTION([0, 90])![1];
  return [
    [VIEWBOX_WIDTH / 2 - halfWidth, VIEWBOX_HEIGHT / 2 - halfHeight],
    [VIEWBOX_WIDTH / 2 + halfWidth, VIEWBOX_HEIGHT / 2 + halfHeight],
  ];
})();

function getDefaultZoomForViewport(baseZoom: number) {
  if (typeof window === "undefined") return baseZoom;
  return window.innerWidth < NARROW_BREAKPOINT_PX
    ? Math.max(baseZoom, NARROW_VIEWPORT_ZOOM)
    : baseZoom;
}

/** Fits the given countries' combined bounds on screen, for the post-guess reveal zoom. */
function computeFocusView(
  features: Feature<Geometry>[],
  visibleViewBox: { width: number; height: number },
): { center: [number, number]; zoom: number } | null {
  if (features.length === 0) return null;

  const bounds = features.map((f) => geoBounds(f));

  // d3-geo signals an antimeridian-crossing feature (Russia, Fiji, ...) by
  // returning a minimum longitude numerically greater than the maximum
  // (the true extent wraps through 180°). Merging that with a plain min/max
  // against another country silently produces a bogus, wildly-off-target
  // box (confirmed live: a Canada/Russia reveal centered the zoom entirely
  // inside Canada, cutting Russia off screen). Rather than implement
  // general circular-arc merging for what's a handful of countries,
  // fall back to the default full-world framing — at zoom 1 both countries
  // are already visible, just not tightly fit.
  if (bounds.some(([[lon0], [lon1]]) => lon0 > lon1)) {
    return { center: DEFAULT_CENTER, zoom: MIN_ZOOM };
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [[lon0, lat0], [lon1, lat1]] of bounds) {
    minLon = Math.min(minLon, lon0);
    minLat = Math.min(minLat, lat0);
    maxLon = Math.max(maxLon, lon1);
    maxLat = Math.max(maxLat, lat1);
  }

  const projection = geoEquirectangular().translate([VIEWBOX_WIDTH / 2, VIEWBOX_HEIGHT / 2]);
  const topLeft = projection([minLon, maxLat]);
  const bottomRight = projection([maxLon, minLat]);
  if (!topLeft || !bottomRight) return null;

  const boxWidth = Math.max(bottomRight[0] - topLeft[0], 1);
  const boxHeight = Math.max(bottomRight[1] - topLeft[1], 1);
  // Fit against the actually-visible viewBox area, not the full 800x600 —
  // preserveAspectRatio="slice" crops the viewBox down to whatever the
  // container's real aspect ratio leaves visible, so fitting against the
  // full box could compute a zoom that's technically correct for 800x600
  // but still gets one of the two countries cropped off the real screen
  // (confirmed live: a Finland/Sudan reveal on a wide viewport cut Finland
  // off entirely because the fit assumed more vertical room than was
  // actually on screen).
  const zoom = Math.min(
    (Math.max(visibleViewBox.width, 1) - FOCUS_PADDING_PX * 2) / boxWidth,
    (Math.max(visibleViewBox.height, 1) - FOCUS_PADDING_PX * 2) / boxHeight,
    MAX_ZOOM,
  );

  return {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    zoom: Math.max(zoom, MIN_ZOOM),
  };
}

const COLORS = {
  land: "var(--map-land)",
  landHover: "var(--map-land-hover)",
  border: "var(--map-border)",
};

export interface WorldMapProps {
  /** Clickable (guess-by-name mode) vs. static display (guess-by-shape mode). */
  interactive: boolean;
  /** Shape mode: the target country to highlight before the player answers. */
  highlightedCode?: string | null;
  /** The correct answer, colored green once a guess has been submitted. */
  correctCode?: string | null;
  /** What the player actually guessed, colored red if it differs from correctCode. */
  guessedCode?: string | null;
  /** Fires with the clicked country's ISO alpha-3 code (or null if unresolved). */
  onCountryClick?: (code: string | null) => void;
  /** Changing this value smoothly recenters the map to the default view (e.g. per question). */
  resetSignal?: string | number;
  /** Overrides the resting zoom level (e.g. a closer view for a purely decorative map). */
  defaultZoom?: number;
  /** Overrides the resting center coordinates ([longitude, latitude]). */
  defaultCenter?: [number, number];
  /** Hides the zoom in/out/reset buttons (e.g. the purely decorative setup-screen map). */
  showZoomControls?: boolean;
}

/** World map on an equirectangular (cylindrical) projection — pannable and zoomable. */
export function WorldMap({
  interactive,
  highlightedCode,
  correctCode,
  guessedCode,
  onCountryClick,
  resetSignal,
  defaultZoom,
  defaultCenter,
  showZoomControls = true,
}: WorldMapProps) {
  const restCenter = defaultCenter ?? DEFAULT_CENTER;
  const restZoom = defaultZoom ?? DEFAULT_ZOOM;

  const [codeByNumericId, setCodeByNumericId] = useState<Record<string, string> | null>(
    null,
  );
  const [featuresByNumericId, setFeaturesByNumericId] = useState<Record<
    string,
    Feature<Geometry>
  > | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(restCenter);
  const [zoom, setZoom] = useState(restZoom);
  const isFirstResetSignal = useRef(true);
  // Server-rendered default has no window to check; a mount-time effect
  // below adjusts this for narrow viewports so the map doesn't letterbox.
  const defaultZoomRef = useRef(restZoom);

  const containerRef = useRef<HTMLDivElement>(null);
  // The part of the 800x600 viewBox actually visible on screen once
  // preserveAspectRatio="slice" crops it to the container's real aspect
  // ratio — needed so the reveal-zoom fits countries against what's really
  // visible rather than the full (partly cropped-off) viewBox.
  const [visibleViewBox, setVisibleViewBox] = useState({
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scale = Math.max(width / VIEWBOX_WIDTH, height / VIEWBOX_HEIGHT);
      setVisibleViewBox({ width: width / scale, height: height / scale });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Latest center/zoom without depending on them (which would retrigger
  // whatever effect reads these refs) — synced after every render rather
  // than during it, since refs can't be written during render.
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    centerRef.current = center;
    zoomRef.current = zoom;
  });

  const viewAnimationRef = useRef<ReturnType<typeof animate> | null>(null);

  const animateViewTo = useCallback((targetCenter: [number, number], targetZoom: number) => {
    viewAnimationRef.current?.stop();
    const fromCenter = centerRef.current;
    const fromZoom = zoomRef.current;
    viewAnimationRef.current = animate(0, 1, {
      duration: 0.7,
      ease: "easeInOut",
      onUpdate: (t) => {
        setCenter([
          fromCenter[0] + (targetCenter[0] - fromCenter[0]) * t,
          fromCenter[1] + (targetCenter[1] - fromCenter[1]) * t,
        ]);
        setZoom(fromZoom + (targetZoom - fromZoom) * t);
      },
    });
  }, []);

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

  // Parsed independently of <Geographies> (which fetches the same,
  // browser-cached URL for rendering) so the reveal-zoom effect below can
  // look up a country's geometry for bounds-fitting without threading state
  // out of that component's render-prop.
  useEffect(() => {
    let cancelled = false;
    fetch(GEOGRAPHY_URL)
      .then((res) => res.json())
      .then((topology: Topology) => {
        if (cancelled) return;
        const collection = feature(
          topology,
          topology.objects.countries as GeometryCollection,
        );
        const byId: Record<string, Feature<Geometry>> = {};
        for (const f of collection.features) {
          if (f.id !== undefined) byId[String(f.id)] = f;
        }
        setFeaturesByNumericId(byId);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featuresByCode = useMemo(() => {
    if (!codeByNumericId || !featuresByNumericId) return null;
    const byCode: Record<string, Feature<Geometry>> = {};
    for (const [numericId, code] of Object.entries(codeByNumericId)) {
      const f = featuresByNumericId[numericId];
      if (f) byCode[code] = f;
    }
    return byCode;
  }, [codeByNumericId, featuresByNumericId]);

  // Zoom to fit the reveal: just the correct country if the guess was
  // right, or both the guess and the correct answer if it was wrong.
  const focusCodes = useMemo(
    () => Array.from(new Set([correctCode, guessedCode].filter((c): c is string => Boolean(c)))),
    [correctCode, guessedCode],
  );

  // Smoothly zooms/pans onto the reveal once both the guess outcome and the
  // map's geometry are ready (an effect, not the render-time-adjustment
  // pattern used elsewhere in this file — starting an animation is a real
  // side effect, and setCenter/setZoom here happen asynchronously inside
  // animateViewTo's onUpdate, not synchronously in the effect body, so this
  // doesn't trip the react-hooks/set-state-in-effect lint rule).
  const focusReadyKey = `${focusCodes.join(",")}|${featuresByCode ? "ready" : "pending"}`;
  useEffect(() => {
    if (focusCodes.length === 0 || !featuresByCode) return;
    const features = focusCodes
      .map((code) => featuresByCode[code])
      .filter((f): f is Feature<Geometry> => Boolean(f));
    const view = computeFocusView(features, visibleViewBox);
    if (view) animateViewTo(view.center, view.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReadyKey]);

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
    animateViewTo(restCenter, defaultZoomRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const resolveCode = useCallback(
    (geoId: string | number | undefined) =>
      geoId === undefined ? null : (codeByNumericId?.[String(geoId)] ?? null),
    [codeByNumericId],
  );

  const zoomIn = () => setZoom((z) => Math.min(z * 1.6, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.6, MIN_ZOOM));
  const resetView = () => animateViewTo(restCenter, defaultZoomRef.current);

  return (
    <div
      ref={containerRef}
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
          translateExtent={WORLD_TRANSLATE_EXTENT}
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
                const isCorrect = Boolean(correctCode && code === correctCode);
                const isWrongGuess = Boolean(
                  guessedCode && code === guessedCode && guessedCode !== correctCode,
                );
                const isFeedback = isCorrect || isWrongGuess;

                // Feedback/highlight fills are driven by their CSS animation
                // instead (see geoClassName below) — this only covers the
                // plain land/hover cases.
                const fill = interactive && hoveredKey === geo.rsmKey ? COLORS.landHover : COLORS.land;

                const geoClassName = isCorrect
                  ? "geo-correct-pulse"
                  : isWrongGuess
                    ? "geo-incorrect-pulse"
                    : isHighlighted
                      ? "geo-highlighted"
                      : undefined;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className={geoClassName}
                    onClick={() => {
                      if (interactive) onCountryClick?.(code);
                    }}
                    onMouseEnter={() => interactive && setHoveredKey(geo.rsmKey)}
                    onMouseLeave={() => interactive && setHoveredKey(null)}
                    style={{
                      // Feedback/highlight fills are driven entirely by their
                      // CSS animation (geo-correct-pulse, geo-incorrect-pulse,
                      // geo-highlighted) so the pulse can actually animate —
                      // an inline fill here would just override it every frame.
                      fill: geoClassName ? undefined : fill,
                      stroke: COLORS.border,
                      strokeWidth: isFeedback ? 1.5 / zoom : 0.4 / zoom,
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

      {showZoomControls && (
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
      )}
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
