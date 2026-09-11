"use client";

import { useCallback, useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEOGRAPHY_URL = "/data/countries-50m.json";
const COUNTRY_CODES_URL = "/data/country-codes.json";

const COLORS = {
  ocean: "#0f172a",
  land: "#334155",
  landHover: "#475569",
  highlighted: "#f59e0b", // amber — shape-mode target, before answering
  correct: "#22c55e",
  incorrect: "#ef4444",
  border: "#0f172a",
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
}

/** World map rendered on an equirectangular (cylindrical) projection. */
export function WorldMap({
  interactive,
  highlightedCode,
  feedbackCode,
  feedbackCorrect,
  onCountryClick,
}: WorldMapProps) {
  const [codeByNumericId, setCodeByNumericId] = useState<Record<string, string> | null>(
    null,
  );

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

  const resolveCode = useCallback(
    (geoId: string | number) => codeByNumericId?.[String(geoId)] ?? null,
    [codeByNumericId],
  );

  return (
    <ComposableMap
      projection="geoEquirectangular"
      className="h-auto w-full"
      style={{ backgroundColor: COLORS.ocean }}
    >
      <Geographies geography={GEOGRAPHY_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const code = resolveCode(geo.id);

            let fill = COLORS.land;
            if (highlightedCode && code === highlightedCode) {
              fill = COLORS.highlighted;
            }
            if (feedbackCode && code === feedbackCode) {
              fill = feedbackCorrect ? COLORS.correct : COLORS.incorrect;
            }

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => {
                  if (interactive) onCountryClick?.(code);
                }}
                style={{
                  default: {
                    fill,
                    stroke: COLORS.border,
                    strokeWidth: 0.3,
                    outline: "none",
                    cursor: interactive ? "pointer" : "default",
                    transition: "fill 150ms ease",
                  },
                  hover: {
                    fill: interactive ? COLORS.landHover : fill,
                    stroke: COLORS.border,
                    strokeWidth: 0.3,
                    outline: "none",
                  },
                  pressed: {
                    fill,
                    stroke: COLORS.border,
                    strokeWidth: 0.3,
                    outline: "none",
                  },
                }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
