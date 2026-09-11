/**
 * Hand-curated country data layered on top of the raw world-atlas TopoJSON.
 *
 * The TopoJSON (public/data/countries-50m.json) includes every landmass it
 * has a shape for — sovereign states, dependent territories, disputed
 * regions, and a few uninhabited islands. For a "guess the country" game we
 * only want sovereign/generally-recognized states as quiz targets, so this
 * file defines:
 *
 *  - EXCLUDED_CODES: ISO 3166-1 alpha-3 codes present in the map data that
 *    are dependent territories or otherwise not treated as guessable
 *    countries (still rendered on the map for visual context, just never
 *    picked as a question).
 *  - NAME_OVERRIDES: friendlier/less-abbreviated display names than the
 *    raw TopoJSON properties or ISO library output provide.
 *  - EASY_CODES / HARD_CODES: the Easy/Hard difficulty pools. Anything not
 *    listed in either is Medium. This is a subjective prominence heuristic
 *    (population, media/cultural visibility, how often a country comes up
 *    in general geography knowledge) — reasonable, but not scientific.
 *    Refine as playtesting reveals mismatches.
 *
 * Used by prisma/seed.ts to populate the Country table, and can be reused
 * client-side if the map ever needs to distinguish playable vs. contextual
 * shapes.
 */

/** Dependent territories, disputed regions, and uninhabited areas — never quiz targets. */
export const EXCLUDED_CODES = new Set([
  "ABW", // Aruba (Netherlands)
  "AIA", // Anguilla (UK)
  "ALA", // Åland (Finland)
  "ASM", // American Samoa (US)
  "ATA", // Antarctica
  "ATF", // French Southern and Antarctic Lands
  "BLM", // Saint Barthélemy (France)
  "BMU", // Bermuda (UK)
  "COK", // Cook Islands (NZ free association)
  "CUW", // Curaçao (Netherlands)
  "CYM", // Cayman Islands (UK)
  "ESH", // Western Sahara (disputed)
  "FLK", // Falkland Islands (UK)
  "FRO", // Faroe Islands (Denmark)
  "GGY", // Guernsey (UK crown dependency)
  "GRL", // Greenland (Denmark)
  "GUM", // Guam (US)
  "HKG", // Hong Kong (China SAR)
  "HMD", // Heard Island and McDonald Islands (uninhabited, AU)
  "IMN", // Isle of Man (UK crown dependency)
  "IOT", // British Indian Ocean Territory
  "JEY", // Jersey (UK crown dependency)
  "MAC", // Macao (China SAR)
  "MAF", // Saint Martin (France)
  "MNP", // Northern Mariana Islands (US)
  "MSR", // Montserrat (UK)
  "NCL", // New Caledonia (France)
  "NFK", // Norfolk Island (Australia)
  "NIU", // Niue (NZ free association)
  "PCN", // Pitcairn Islands (UK)
  "PRI", // Puerto Rico (US)
  "PYF", // French Polynesia (France)
  "SGS", // South Georgia and the South Sandwich Islands (uninhabited, UK)
  "SHN", // Saint Helena, Ascension and Tristan da Cunha (UK)
  "SPM", // Saint Pierre and Miquelon (France)
  "SXM", // Sint Maarten (Netherlands)
  "TCA", // Turks and Caicos Islands (UK)
  "VGB", // British Virgin Islands
  "VIR", // U.S. Virgin Islands
  "WLF", // Wallis and Futuna (France)
]);

/** Friendlier display names than the raw TopoJSON/ISO library provide. */
export const NAME_OVERRIDES: Record<string, string> = {
  ATG: "Antigua and Barbuda",
  BIH: "Bosnia and Herzegovina",
  CAF: "Central African Republic",
  COD: "DR Congo",
  COG: "Congo-Brazzaville",
  DOM: "Dominican Republic",
  GNQ: "Equatorial Guinea",
  KNA: "Saint Kitts and Nevis",
  MHL: "Marshall Islands",
  SLB: "Solomon Islands",
  SSD: "South Sudan",
  VAT: "Vatican City",
  VCT: "Saint Vincent and the Grenadines",
  TUR: "Turkey",
  CHN: "China",
  RUS: "Russia",
  IRN: "Iran",
  SYR: "Syria",
  LAO: "Laos",
  BRN: "Brunei",
  MDA: "Moldova",
  TWN: "Taiwan",
  FSM: "Micronesia",
  GMB: "The Gambia",
  TZA: "Tanzania",
  PSE: "Palestine",
  MKD: "North Macedonia",
};

/** Widely-known countries — the "Easy" pool. */
export const EASY_CODES = new Set([
  "USA", "CAN", "MEX", "BRA", "ARG", "GBR", "FRA", "DEU", "ITA", "ESP",
  "PRT", "RUS", "CHN", "JPN", "KOR", "PRK", "IND", "PAK", "IDN", "THA",
  "VNM", "PHL", "MYS", "SGP", "AUS", "NZL", "EGY", "ZAF", "NGA", "KEN",
  "ETH", "MAR", "DZA", "SAU", "ARE", "ISR", "TUR", "IRN", "IRQ", "GRC",
  "NLD", "BEL", "CHE", "AUT", "SWE", "NOR", "DNK", "FIN", "POL", "UKR",
  "CUB", "JAM", "COL", "VEN", "PER", "CHL", "ECU", "CRI", "PAN",
]);

/** Lesser-known countries — the "Hard" pool. */
export const HARD_CODES = new Set([
  "TUV", "NRU", "PLW", "MHL", "FSM", "KIR", "WSM", "TON", "VUT", "SLB",
  "COM", "STP", "SYC", "MDV", "BTN", "TLS", "DJI", "ERI", "GNB", "GNQ",
  "CAF", "TCD", "NER", "MRT", "GMB", "LSO", "SWZ", "BDI", "MWI", "TGO",
  "BEN", "SLE", "LBR", "GIN", "MUS", "CPV", "GUY", "SUR", "BLZ", "GRD",
  "DMA", "LCA", "VCT", "ATG", "KNA", "LIE", "MCO", "SMR", "AND", "VAT",
  "SSD", "YEM", "QAT", "BHR", "BRN",
]);
