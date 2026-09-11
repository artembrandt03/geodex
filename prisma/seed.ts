/**
 * Populates the Country table from the world-atlas TopoJSON, filtered and
 * annotated by the curation rules in src/lib/countries/curation.ts.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
import { PrismaClient, Difficulty } from "../src/generated/prisma/client";
import {
  EXCLUDED_CODES,
  NAME_OVERRIDES,
  EASY_CODES,
  HARD_CODES,
} from "../src/lib/countries/curation";

countries.registerLocale(en);

const prisma = new PrismaClient();

interface TopoGeometry {
  id: string | number;
  properties?: { name?: string };
}

interface CountrySeedRow {
  code: string;
  name: string;
  difficultyTier: Difficulty;
}

function loadSeedRows(): CountrySeedRow[] {
  const topoPath = path.join(process.cwd(), "public/data/countries-50m.json");
  const topo = JSON.parse(readFileSync(topoPath, "utf-8"));
  const geometries: TopoGeometry[] = topo.objects.countries.geometries;

  const rows = new Map<string, CountrySeedRow>();

  for (const geometry of geometries) {
    const numeric = String(geometry.id).padStart(3, "0");
    const alpha3 = countries.numericToAlpha3(numeric);
    if (!alpha3 || EXCLUDED_CODES.has(alpha3)) continue;

    const name =
      NAME_OVERRIDES[alpha3] ??
      geometry.properties?.name ??
      countries.getName(alpha3, "en") ??
      alpha3;

    const difficultyTier: Difficulty = EASY_CODES.has(alpha3)
      ? "EASY"
      : HARD_CODES.has(alpha3)
        ? "HARD"
        : "MEDIUM";

    // Some countries (e.g. Australia's outlying islands) appear as multiple
    // geometries sharing one alpha-3 code — dedupe by code.
    if (!rows.has(alpha3)) {
      rows.set(alpha3, { code: alpha3, name, difficultyTier });
    }
  }

  return Array.from(rows.values());
}

async function main() {
  const rows = loadSeedRows();
  console.log(`Seeding ${rows.length} countries...`);

  for (const row of rows) {
    await prisma.country.upsert({
      where: { code: row.code },
      create: row,
      update: { name: row.name, difficultyTier: row.difficultyTier },
    });
  }

  const counts = await prisma.country.groupBy({
    by: ["difficultyTier"],
    _count: true,
  });
  console.log("Seed complete. Counts by difficulty:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
