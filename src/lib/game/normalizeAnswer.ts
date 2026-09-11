/** Normalizes a typed country name for loose comparison: trims, lowercases,
 * strips diacritics, and drops punctuation so "Cote d'Ivoire" / "Côte d’Ivoire"
 * both match "Côte d'Ivoire". */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // punctuation (hyphens, apostrophes) becomes a space
    .replace(/\s+/g, " ")
    .trim();
}
