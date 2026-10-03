/** Country code -> codes of countries sharing a land border (public/data/country-neighbors.json). */
export type NeighborMap = Record<string, string[]>;

/** True when the two (different) countries share a land border. */
export function isNeighbor(map: NeighborMap, a: string | null, b: string): boolean {
  if (!a || a === b) return false;
  return map[a]?.includes(b) ?? false;
}
