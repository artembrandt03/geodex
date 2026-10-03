// Generates public/data/country-neighbors.json: for each country (ISO
// 3166-1 alpha-3), the codes of the countries it shares a land border with.
// Used for the "neighbor" consolation point when a wrong guess borders the
// right answer. Derived from the same TopoJSON the map draws, so what counts
// as bordering always matches what the player can see (islands have none).
//
// Run with: node scripts/generate-country-neighbors.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neighbors } from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const topo = JSON.parse(
  readFileSync(path.join(root, "public/data/countries-50m.json"), "utf-8"),
);
const codes = JSON.parse(
  readFileSync(path.join(root, "public/data/country-codes.json"), "utf-8"),
);

const geometries = topo.objects.countries.geometries;
const codeAt = (i) => codes[String(geometries[i].id)];

/** @type {Record<string, string[]>} */
const result = {};
neighbors(geometries).forEach((indices, i) => {
  const code = codeAt(i);
  if (!code) return;
  const list = indices.map(codeAt).filter((c) => c && c !== code).sort();
  if (list.length > 0) result[code] = list;
});

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path.join(root, "public/data/country-neighbors.json"), JSON.stringify(sorted));
console.log(`${Object.keys(sorted).length} countries with at least one land neighbor`);
