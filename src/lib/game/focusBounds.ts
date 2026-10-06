import { geoArea, geoBounds } from "d3-geo";
import type { Feature, Geometry, Polygon } from "geojson";

export type LonLatBounds = [[number, number], [number, number]];

/** A piece must be at least this share of the largest piece's area to count. */
const MIN_PIECE_SHARE = 0.03;
/** ...and its center within this many degrees (wrapping at the antimeridian) of the largest piece's. */
const NEAR_DEGREES = 20;

/** Shortest signed longitude difference a - b, in (-180, 180]. */
function wrapDelta(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

interface Piece {
  lon0: number;
  lat0: number;
  lon1: number;
  lat1: number;
  area: number;
}

function pieceOf(polygon: Polygon): Piece {
  const [[lon0, lat0], [lon1, lat1]] = geoBounds(polygon);
  // d3-geo reports a piece that itself crosses the antimeridian with lon0 > lon1;
  // unwrap it so lon0 <= lon1 (lon1 may then exceed 180).
  return { lon0, lat0, lon1: lon0 > lon1 ? lon1 + 360 : lon1, lat1, area: geoArea(polygon) };
}

/**
 * The longitude/latitude box to zoom to for a country: the box of its main
 * landmass, never wrapping (lon0 <= lon1).
 *
 * The plain geoBounds of a whole country is a poor target. Overseas pieces
 * stretch it (France with French Guiana spans two continents), and a piece
 * on the far side of the 180th meridian makes d3-geo report an inverted box
 * (New Zealand's Chatham Islands, Russia's Chukotka, Fiji, the USA's
 * Aleutians), which used to make zoom give up and show the whole world.
 *
 * So: take the largest piece, and add every other piece that is both sizeable
 * (a few percent of the largest) and close to it, shifting longitudes across
 * the antimeridian where needed so the result stays one contiguous box.
 */
export function focusBounds(feature: Feature<Geometry>): LonLatBounds {
  const geometry = feature.geometry;
  const polygons: Polygon[] =
    geometry.type === "MultiPolygon"
      ? geometry.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }))
      : geometry.type === "Polygon"
        ? [geometry]
        : [];

  if (polygons.length === 0) {
    const [[lon0, lat0], [lon1, lat1]] = geoBounds(feature);
    return [
      [lon0, lat0],
      [lon0 > lon1 ? lon1 + 360 : lon1, lat1],
    ];
  }

  const pieces = polygons.map(pieceOf);
  const main = pieces.reduce((best, p) => (p.area > best.area ? p : best));
  const mainCenterLon = (main.lon0 + main.lon1) / 2;
  const mainCenterLat = (main.lat0 + main.lat1) / 2;

  let { lon0, lat0, lon1, lat1 } = main;
  for (const piece of pieces) {
    if (piece === main || piece.area < main.area * MIN_PIECE_SHARE) continue;

    const centerLon = (piece.lon0 + piece.lon1) / 2;
    const centerLat = (piece.lat0 + piece.lat1) / 2;
    const dLon = wrapDelta(centerLon, mainCenterLon);
    if (Math.abs(dLon) > NEAR_DEGREES || Math.abs(centerLat - mainCenterLat) > NEAR_DEGREES) continue;

    // Slide this piece to where it sits relative to the main one on an unwrapped axis.
    const shift = mainCenterLon + dLon - centerLon;
    lon0 = Math.min(lon0, piece.lon0 + shift);
    lon1 = Math.max(lon1, piece.lon1 + shift);
    lat0 = Math.min(lat0, piece.lat0);
    lat1 = Math.max(lat1, piece.lat1);
  }

  return [
    [lon0, lat0],
    [lon1, lat1],
  ];
}
