import { describe, expect, it } from "vitest";
import { isNeighbor, type NeighborMap } from "./neighbors";
import realData from "../../../public/data/country-neighbors.json";

const map: NeighborMap = { CHE: ["AUT", "FRA"], AUT: ["CHE"], FRA: ["CHE"] };

describe("isNeighbor", () => {
  it("is true for bordering countries", () => {
    expect(isNeighbor(map, "FRA", "CHE")).toBe(true);
    expect(isNeighbor(map, "AUT", "CHE")).toBe(true);
  });

  it("is false for non-bordering, identical, missing or null guesses", () => {
    expect(isNeighbor(map, "AUT", "FRA")).toBe(false);
    expect(isNeighbor(map, "CHE", "CHE")).toBe(false);
    expect(isNeighbor(map, "XXX", "CHE")).toBe(false);
    expect(isNeighbor(map, null, "CHE")).toBe(false);
  });

  it("matches the generated data", () => {
    const real = realData as NeighborMap;
    expect(isNeighbor(real, "DEU", "CHE")).toBe(true);
    expect(isNeighbor(real, "ESP", "CHE")).toBe(false);
    // Islands border nothing.
    expect(isNeighbor(real, "NZL", "AUS")).toBe(false);
  });
});
