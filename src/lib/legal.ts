/**
 * Facts the privacy policy and terms state, kept in one place so the two
 * pages (and anything that links to them) can't drift apart. Update the date
 * whenever either document changes in a way that matters.
 */
export const LEGAL_UPDATED = "October 8, 2026";

/** Who runs Geodex and is the person responsible for protecting personal information (Quebec Law 25). */
export const OPERATOR_NAME = "Artem Brandt";
export const OPERATOR_PLACE = "Montreal, Quebec, Canada";

/** Players must be at least this old to make an account (under 14, Quebec law requires a parent's consent). */
export const MINIMUM_AGE = 14;

/**
 * A public contact address for privacy requests, if one is set
 * (NEXT_PUBLIC_CONTACT_EMAIL). Without one the pages point people to the
 * feedback window instead, so no personal address is published by accident.
 */
export function contactEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
}
