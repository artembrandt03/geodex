import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// Built once at module load — the matcher compiles its word list into regexes
// up front, so it's meant to be reused across calls, not recreated per check.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** True if `text` contains profanity (leetspeak/spacing/case variants included). */
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
