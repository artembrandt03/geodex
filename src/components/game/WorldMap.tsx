"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  ZoomableGroup,
} from "react-simple-maps";
import { animate, motion } from "framer-motion";
import { geoEquirectangular } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { focusBounds } from "@/lib/game/focusBounds";
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
//
// This is the world's TRUE bounds — see getTranslateExtent below for why
// what's actually passed to ZoomableGroup needs to be padded beyond this.
const WORLD_CONTENT_BOUNDS: [[number, number], [number, number]] = (() => {
  const halfWidth = BASE_PROJECTION([180, 0])![0] - VIEWBOX_WIDTH / 2;
  const halfHeight = VIEWBOX_HEIGHT / 2 - BASE_PROJECTION([0, 90])![1];
  return [
    [VIEWBOX_WIDTH / 2 - halfWidth, VIEWBOX_HEIGHT / 2 - halfHeight],
    [VIEWBOX_WIDTH / 2 + halfWidth, VIEWBOX_HEIGHT / 2 + halfHeight],
  ];
})();

// react-simple-maps always tells d3-zoom the viewport is the FULL nominal
// 800x600 viewBox (ComposableMap's own width/height, which we never
// override), even though preserveAspectRatio="slice" crops that down to
// whatever sub-region `visibleViewBox` actually shows on screen once the
// container's real aspect ratio differs from 4:3. d3-zoom's pan-clamping
// math reserves margin for the rest of that nominal box as if it were still
// visible, so at low zoom -- where the crop is a large fraction of the
// pannable range -- dragging stops well short of the true edge (confirmed
// live: couldn't reach the pole at the default zoom on a wide viewport, but
// could once zoomed in enough that the crop became a negligible fraction of
// the range). Padding translateExtent by the crop margin compensates for
// this exactly at zoom 1 (the default, most-used view, and the case that
// was actually reported broken); at higher zoom the same fixed padding
// over-compensates a little (a small sliver of blank space beyond the true
// edge becomes reachable), which is a minor, far more acceptable trade than
// not being able to see the pole at all.
function getTranslateExtent(visibleViewBox: {
  width: number;
  height: number;
}): [[number, number], [number, number]] {
  const padX = Math.max((VIEWBOX_WIDTH - visibleViewBox.width) / 2, 0);
  const padY = Math.max((VIEWBOX_HEIGHT - visibleViewBox.height) / 2, 0);
  return [
    [WORLD_CONTENT_BOUNDS[0][0] - padX, WORLD_CONTENT_BOUNDS[0][1] - padY],
    [WORLD_CONTENT_BOUNDS[1][0] + padX, WORLD_CONTENT_BOUNDS[1][1] + padY],
  ];
}

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

  // The box of each country's main landmass, never wrapping around the
  // antimeridian (see focusBounds). This used to be a raw geoBounds that
  // gave up and showed the whole world for any country with a piece across
  // the 180th meridian (New Zealand, Russia, Fiji, the USA), which made
  // zoom-in silently do nothing for them.
  const bounds = features.map((f) => focusBounds(f));

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

  const result = {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2] as [number, number],
    zoom: Math.max(zoom, MIN_ZOOM),
  };

  // A country with degenerate/empty geometry (or any other edge case in the
  // math above) can produce a NaN center or zoom. Feeding that into
  // ZoomableGroup's controlled center/zoom is a real, confirmed failure
  // mode: NaN !== NaN breaks the underlying library's "skip if unchanged"
  // check permanently, so every subsequent render re-applies the transform,
  // which is what actually trips React's "Maximum update depth exceeded"
  // guard. Fall back to the safe default framing instead of ever returning
  // a non-finite view.
  if (
    !Number.isFinite(result.center[0]) ||
    !Number.isFinite(result.center[1]) ||
    !Number.isFinite(result.zoom)
  ) {
    return { center: DEFAULT_CENTER, zoom: MIN_ZOOM };
  }

  return result;
}

const COLORS = {
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
  /**
   * Zooms tightly onto just this country, overriding the correctCode/
   * guessedCode reveal fit (which frames both at once) — for a player-
   * requested closer look at a single country, e.g. a tiny one that's hard
   * to see at the default framing. Doesn't add any color/highlight of its
   * own, so it's safe to use pre-guess without giving away the answer.
   */
  manualFocusCode?: string | null;
  /**
   * Bump this (e.g. an incrementing counter) to re-trigger the manual focus
   * animation even when manualFocusCode is unchanged — e.g. the player
   * dragged away and clicked "zoom in" again on the same country. Without
   * this, the focus effect's key wouldn't change, so the animation
   * wouldn't replay (confirmed live: the zoom button only ever worked once).
   */
  manualFocusNonce?: number;
  /** Overrides the resting zoom level (e.g. a closer view for a purely decorative map). */
  defaultZoom?: number;
  /** Overrides the resting center coordinates ([longitude, latitude]). */
  defaultCenter?: [number, number];
  /** Hides the zoom in/out/reset buttons (e.g. the purely decorative setup-screen map). */
  showZoomControls?: boolean;
}

/**
 * Renders the ~200 country paths. Split out and memoized specifically so it
 * does NOT take `center`/`zoom` as props: those change every frame during
 * animateViewTo's pan/zoom animation, and this component previously lived
 * inline in WorldMap's own render, so every one of those frames rebuilt all
 * ~200 <Geography> elements from scratch (needed back when stroke width was
 * computed from `zoom`, and fill from a `hoveredKey` state that changed on
 * every mouse enter/leave). Combined with fast real mouse movement across
 * many small countries, that was enough to overwhelm React's scheduler and
 * trip a real "Maximum update depth exceeded" error. Hover fill is now
 * plain CSS (`.geo-interactive:hover` in globals.css) and stroke width uses
 * `vectorEffect="non-scaling-stroke"` instead of dividing by `zoom`, so
 * nothing here depends on the animation at all — memoizing this component
 * makes pan/zoom frames skip re-rendering it entirely.
 */
const CountryLayer = memo(function CountryLayer({
  interactive,
  highlightedCode,
  correctCode,
  guessedCode,
  onCountryClick,
  resolveCode,
}: {
  interactive: boolean;
  highlightedCode?: string | null;
  correctCode?: string | null;
  guessedCode?: string | null;
  onCountryClick?: (code: string | null) => void;
  resolveCode: (geoId: string | number | undefined) => string | null;
}) {
  return (
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

          const geoClassName = [
            "geo-base",
            interactive ? "geo-interactive" : null,
            isCorrect ? "geo-correct-pulse" : isWrongGuess ? "geo-incorrect-pulse" : null,
            isHighlighted ? "geo-highlighted" : null,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              className={geoClassName}
              onClick={() => {
                if (interactive) onCountryClick?.(code);
              }}
              style={{
                stroke: COLORS.border,
                strokeWidth: isFeedback ? 1.5 : 0.4,
                vectorEffect: "non-scaling-stroke",
                outline: "none",
                // Matches the site-wide custom cursors in globals.css --
                // inline styles win over any CSS selector, so the global
                // rule alone wouldn't reach these SVG paths.
                cursor: interactive
                  ? 'url("/images/cursor-pointer.png") 8 1, pointer'
                  : 'url("/images/cursor-default.png") 2 1, default',
                transition: "fill 200ms ease",
              }}
            />
          );
        })
      }
    </Geographies>
  );
});

/** World map on an equirectangular (cylindrical) projection — pannable and zoomable. */
export function WorldMap({
  interactive,
  highlightedCode,
  correctCode,
  guessedCode,
  onCountryClick,
  resetSignal,
  manualFocusCode,
  manualFocusNonce,
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
    // Guards against a non-finite target ever reaching ZoomableGroup's
    // controlled center/zoom — see the matching note in computeFocusView for
    // why that's not just a visual glitch but a real infinite-render bug.
    if (
      !Number.isFinite(targetCenter[0]) ||
      !Number.isFinite(targetCenter[1]) ||
      !Number.isFinite(targetZoom)
    ) {
      return;
    }
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

  // See getTranslateExtent's own comment for why this needs padding beyond
  // the world's true bounds, and why it's only recomputed on resize (not
  // every zoom tick) — visibleViewBox only changes then.
  const translateExtent = useMemo(() => getTranslateExtent(visibleViewBox), [visibleViewBox]);

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
  // right, or both the guess and the correct answer if it was wrong. A
  // manual focus request (the player asking for a closer look at one
  // specific country) overrides this entirely rather than joining it —
  // otherwise, re-focusing on the already-visible guessed/correct country
  // would be a no-op, since it's already part of the union.
  const focusCodes = useMemo(() => {
    if (manualFocusCode) return [manualFocusCode];
    return Array.from(new Set([correctCode, guessedCode].filter((c): c is string => Boolean(c))));
  }, [manualFocusCode, correctCode, guessedCode]);

  // Smoothly zooms/pans onto the reveal once both the guess outcome and the
  // map's geometry are ready (an effect, not the render-time-adjustment
  // pattern used elsewhere in this file — starting an animation is a real
  // side effect, and setCenter/setZoom here happen asynchronously inside
  // animateViewTo's onUpdate, not synchronously in the effect body, so this
  // doesn't trip the react-hooks/set-state-in-effect lint rule).
  const focusReadyKey = `${focusCodes.join(",")}|${manualFocusCode ? (manualFocusNonce ?? 0) : "-"}|${featuresByCode ? "ready" : "pending"}`;
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
    // A new question that already comes with a focus (shape mode zooms onto
    // the highlighted country) must not be undone here: both effects run in
    // the same commit, this one second, so recentering would cancel the zoom
    // that was just started. (Only the first question was unaffected, via the
    // skip above.)
    if (manualFocusCode) return;
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
          translateExtent={translateExtent}
          onMoveEnd={({ coordinates, zoom: z }) => {
            // Same non-finite guard as animateViewTo — an extreme drag
            // gesture landing outside the projection's domain could
            // otherwise hand back NaN coordinates here.
            if (coordinates && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
              setCenter(coordinates);
            }
            if (typeof z === "number" && Number.isFinite(z)) setZoom(z);
          }}
        >
          <Graticule stroke="rgba(148, 163, 184, 0.08)" strokeWidth={0.5} />
          <CountryLayer
            interactive={interactive}
            highlightedCode={highlightedCode}
            correctCode={correctCode}
            guessedCode={guessedCode}
            onCountryClick={onCountryClick}
            resolveCode={resolveCode}
          />
        </ZoomableGroup>
      </ComposableMap>

      {/* The zoom buttons sit mid-right on phones, where nothing else floats (the prompt is above, the answer banner and input below), and bottom-right from sm up. */}
      {showZoomControls && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:bottom-4 sm:right-4 sm:top-auto sm:translate-y-0">
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
