import { COUNTRY_ALIASES } from "../countries/aliases";
import { normalizeAnswer } from "./normalizeAnswer";

/**
 * The comparison form of a country name or a typed answer. On top of
 * normalizeAnswer (case, accents, punctuation): "&" reads as "and", a leading
 * "the" is dropped ("The Gambia" and "Gambia" are one answer), and "St" reads
 * as "Saint", and dotted abbreviations ("U.S.A.") are joined up. Applied to
 * both sides, so "St. Kitts & Nevis" meets "Saint Kitts and Nevis" without
 * anyone listing that spelling.
 */
export function matchKey(text: string): string {
  const spelled = text.replace(/&/g, " and ");
  return normalizeAnswer(spelled)
    // Dotted abbreviations: "U.S.A." arrives as "u s a" and "U.K." as "u k"; join them up.
    .replace(/\b[a-z](?: [a-z])+\b/g, (letters) => letters.replace(/ /g, ""))
    .replace(/^the /, "")
    .replace(/\bst\b/g, "saint")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CountryRef {
  code: string;
  name: string;
}

/**
 * Which country a typed answer means, or null if it matches none. A
 * country's own name always counts; aliases (lib/countries/aliases.ts) are
 * extras. If an alias and a real name ever collided the real name wins, so
 * adding an alias can never make a country unguessable.
 */
export function matchCountry(input: string, countries: CountryRef[]): string | null {
  const key = matchKey(input);
  if (!key) return null;

  const byName = countries.find((country) => matchKey(country.name) === key);
  if (byName) return byName.code;

  const known = new Set(countries.map((country) => country.code));
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (known.has(code) && aliases.some((alias) => matchKey(alias) === key)) return code;
  }
  return null;
}
