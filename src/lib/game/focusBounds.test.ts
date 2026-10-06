import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { focusBounds } from "./focusBounds";

const topology = JSON.parse(
  readFileSync(path.join(__dirname, "../../../public/data/countries-50m.json"), "utf-8"),
) as Topology;
const countries = feature(topology, topology.objects.countries as GeometryCollection);

// Numeric ids in the world-atlas data.
const ID = { NZL: "554", FRA: "250", RUS: "643", USA: "840", FJI: "242", CAN: "124" } as const;
function country(id: string): Feature<Geometry> {
  const found = countries.features.find((f) => String(f.id) === id);
  if (!found) throw new Error(`no country ${id}`);
  return found;
}

// Clockwise, which is the winding d3-geo expects for a polygon's outer ring
// (the opposite of the GeoJSON spec); counter-clockwise would mean "everything but this".
const square = (lon: number, lat: number, size: number) => [
  [
    [lon, lat],
    [lon, lat + size],
    [lon + size, lat + size],
    [lon + size, lat],
    [lon, lat],
  ],
];

describe("focusBounds", () => {
  it("is just the box of a simple country", () => {
    const f: Feature<Geometry> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: square(10, 20, 5) },
    };
    const [[lon0, lat0], [lon1, lat1]] = focusBounds(f);
    expect([lon0, lat0, lon1, lat1].map(Math.round)).toEqual([10, 20, 15, 25]);
  });

  it("ignores a tiny far-away piece instead of stretching the box", () => {
    const f: Feature<Geometry> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [square(0, 40, 10), square(-60, 4, 0.5)],
      },
    };
    const [[lon0], [lon1]] = focusBounds(f);
    expect(lon0).toBeGreaterThan(-1);
    expect(lon1).toBeLessThan(11);
  });

  it("gives New Zealand a normal box over its main islands, not an inverted one", () => {
    const [[lon0, lat0], [lon1, lat1]] = focusBounds(country(ID.NZL));
    expect(lon0).toBeLessThanOrEqual(lon1);
    expect(lon0).toBeGreaterThan(160);
    expect(lon1).toBeLessThan(181);
    expect(lat0).toBeLessThan(-45);
    expect(lat1).toBeGreaterThan(-36);
  });

  it("keeps France to the European mainland, without French Guiana", () => {
    const [[lon0], [lon1]] = focusBounds(country(ID.FRA));
    expect(lon0).toBeGreaterThan(-10);
    expect(lon1).toBeLessThan(15);
  });

  it("never returns an inverted box for countries that cross the antimeridian", () => {
    for (const id of [ID.RUS, ID.USA, ID.FJI, ID.NZL]) {
      const [[lon0], [lon1]] = focusBounds(country(id));
      expect(lon0, id).toBeLessThanOrEqual(lon1);
      expect(lon1 - lon0, id).toBeLessThan(200);
    }
  });

  it("covers Canada's islands along with the mainland", () => {
    const [[lon0], [lon1]] = focusBounds(country(ID.CAN));
    expect(lon1 - lon0).toBeGreaterThan(60);
  });
});
