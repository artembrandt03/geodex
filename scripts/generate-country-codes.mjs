// Generates public/data/country-codes.json: a small lookup from the
// TopoJSON's numeric country id (as it appears in each geometry's `id`
// field) to its ISO 3166-1 alpha-3 code. Ships to the browser so the map
// component can resolve which country a clicked/highlighted shape is
// without bundling the full i18n-iso-countries package client-side.
//
// Includes every geometry (even excluded territories) so a click anywhere
// on the map resolves to *something* comparable — the game logic decides
// separately whether a code is a valid quiz target.
//
// Run with: node scripts/generate-country-codes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };

countries.registerLocale(en);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const topo = JSON.parse(
  readFileSync(path.join(root, "public/data/countries-50m.json"), "utf-8"),
);

/** @type {Record<string, string>} */
const codeMap = {};

for (const geometry of topo.objects.countries.geometries) {
  const numericId = String(geometry.id);
  const alpha3 = countries.numericToAlpha3(numericId.padStart(3, "0"));
  if (alpha3) {
    codeMap[numericId] = alpha3;
  }
}

const outPath = path.join(root, "public/data/country-codes.json");
writeFileSync(outPath, JSON.stringify(codeMap));
console.log(`Wrote ${Object.keys(codeMap).length} entries to ${outPath}`);
