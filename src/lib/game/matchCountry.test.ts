import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRY_ALIASES } from "../countries/aliases";
import { matchCountry, matchKey, type CountryRef } from "./matchCountry";

// The families of names most likely to be confused with each other, using
// the exact names the game shows.
const COUNTRIES: CountryRef[] = [
  { code: "USA", name: "United States of America" },
  { code: "GBR", name: "United Kingdom" },
  { code: "CIV", name: "Côte d'Ivoire" },
  { code: "CZE", name: "Czechia" },
  { code: "SWZ", name: "eSwatini" },
  { code: "MKD", name: "North Macedonia" },
  { code: "TUR", name: "Turkey" },
  { code: "COD", name: "DR Congo" },
  { code: "COG", name: "Congo-Brazzaville" },
  { code: "KOR", name: "South Korea" },
  { code: "PRK", name: "North Korea" },
  { code: "GIN", name: "Guinea" },
  { code: "GNB", name: "Guinea-Bissau" },
  { code: "GNQ", name: "Equatorial Guinea" },
  { code: "PNG", name: "Papua New Guinea" },
  { code: "NER", name: "Niger" },
  { code: "NGA", name: "Nigeria" },
  { code: "GMB", name: "The Gambia" },
  { code: "BHS", name: "Bahamas" },
  { code: "NLD", name: "Netherlands" },
  { code: "KNA", name: "Saint Kitts and Nevis" },
  { code: "LCA", name: "Saint Lucia" },
  { code: "VCT", name: "Saint Vincent and the Grenadines" },
  { code: "ATG", name: "Antigua and Barbuda" },
  { code: "TTO", name: "Trinidad and Tobago" },
  { code: "BIH", name: "Bosnia and Herzegovina" },
  { code: "STP", name: "São Tomé and Principe" },
];

const answer = (typed: string) => matchCountry(typed, COUNTRIES);

describe("matchKey", () => {
  it("reads & as and, drops a leading the, and reads St as Saint", () => {
    expect(matchKey("Trinidad & Tobago")).toBe("trinidad and tobago");
    expect(matchKey("The Gambia")).toBe("gambia");
    expect(matchKey("St. Lucia")).toBe("saint lucia");
    expect(matchKey("  St Kitts  &  Nevis ")).toBe("saint kitts and nevis");
  });

  it("joins dotted abbreviations", () => {
    expect(matchKey("U.S.A.")).toBe("usa");
    expect(matchKey("U.K.")).toBe("uk");
    expect(matchKey("u s")).toBe("us");
    // Single letters inside a real name are left alone.
    expect(matchKey("Cote d'Ivoire")).toBe("cote d ivoire");
  });

  it("only treats whole words as St, and only a leading the", () => {
    expect(matchKey("Estonia")).toBe("estonia");
    expect(matchKey("Burkina Faso")).toBe("burkina faso");
    expect(matchKey("Papua New Guinea")).toBe("papua new guinea");
  });
});

describe("matchCountry", () => {
  it("accepts a country's own name, however it's typed", () => {
    expect(answer("Turkey")).toBe("TUR");
    expect(answer("  turkey ")).toBe("TUR");
    expect(answer("Cote d'Ivoire")).toBe("CIV");
    expect(answer("Côte dIvoire")).toBe("CIV");
    expect(answer("Sao Tome and Principe")).toBe("STP");
  });

  it("accepts the alternate names players actually type", () => {
    expect(answer("USA")).toBe("USA");
    expect(answer("U.S.A.")).toBe("USA");
    expect(answer("United States")).toBe("USA");
    expect(answer("UK")).toBe("GBR");
    expect(answer("Great Britain")).toBe("GBR");
    expect(answer("Ivory Coast")).toBe("CIV");
    expect(answer("Czech Republic")).toBe("CZE");
    expect(answer("Swaziland")).toBe("SWZ");
    expect(answer("Macedonia")).toBe("MKD");
    expect(answer("Türkiye")).toBe("TUR");
  });

  it("handles the, St and & without aliases", () => {
    expect(answer("Gambia")).toBe("GMB");
    expect(answer("the Bahamas")).toBe("BHS");
    expect(answer("The Netherlands")).toBe("NLD");
    expect(answer("St Lucia")).toBe("LCA");
    expect(answer("St. Kitts & Nevis")).toBe("KNA");
    expect(answer("St Vincent and the Grenadines")).toBe("VCT");
    expect(answer("Antigua & Barbuda")).toBe("ATG");
    expect(answer("Trinidad & Tobago")).toBe("TTO");
    expect(answer("Bosnia & Herzegovina")).toBe("BIH");
  });

  it("keeps look-alike countries apart", () => {
    expect(answer("Niger")).toBe("NER");
    expect(answer("Nigeria")).toBe("NGA");
    expect(answer("Guinea")).toBe("GIN");
    expect(answer("Guinea Bissau")).toBe("GNB");
    expect(answer("Equatorial Guinea")).toBe("GNQ");
    expect(answer("Papua New Guinea")).toBe("PNG");
    expect(answer("Democratic Republic of the Congo")).toBe("COD");
    expect(answer("DRC")).toBe("COD");
    expect(answer("Republic of the Congo")).toBe("COG");
    expect(answer("South Korea")).toBe("KOR");
    expect(answer("North Korea")).toBe("PRK");
  });

  it("refuses ambiguous or partial answers rather than guessing", () => {
    expect(answer("Congo")).toBeNull();
    expect(answer("Korea")).toBeNull();
    expect(answer("England")).toBeNull();
    expect(answer("Guinea Guinea")).toBeNull();
    expect(answer("")).toBeNull();
    expect(answer("   ")).toBeNull();
    expect(answer("Atlantis")).toBeNull();
  });

  it("accepts Burma for Myanmar when Myanmar is in the list", () => {
    expect(matchCountry("Burma", [{ code: "MMR", name: "Myanmar" }])).toBe("MMR");
  });

  it("ignores an alias for a country that isn't in the round's list", () => {
    expect(matchCountry("Ivory Coast", [{ code: "TUR", name: "Turkey" }])).toBeNull();
  });
});

describe("the alias table", () => {
  const validCodes = new Set(
    Object.values(
      JSON.parse(
        readFileSync(path.join(__dirname, "../../../public/data/country-codes.json"), "utf-8"),
      ) as Record<string, string>,
    ),
  );

  it("only names countries that exist on the map", () => {
    for (const code of Object.keys(COUNTRY_ALIASES)) {
      expect(validCodes.has(code), code).toBe(true);
    }
  });

  it("never gives two countries the same alias, or the same one twice", () => {
    const owner = new Map<string, string>();
    for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
      for (const alias of aliases) {
        const key = matchKey(alias);
        expect(key, `empty alias for ${code}`).not.toBe("");
        expect(owner.get(key) ?? code, `"${alias}" is claimed by two countries`).toBe(code);
        owner.set(key, code);
      }
    }
  });
});
