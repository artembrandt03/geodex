/**
 * Other names players type for a country in shape mode, by ISO alpha-3 code.
 * The canonical name (what the game shows and the autocomplete lists) always
 * matches too; these are extras. See lib/game/matchCountry.ts for how they're
 * compared: case, accents and punctuation are ignored, "&" means "and", a
 * leading "the" is dropped, and "St" means "Saint", so none of those need
 * listing here.
 *
 * Left out on purpose:
 *  - a bare "Congo" or "Korea": each fits two countries, so accepting it
 *    would make one of them unguessable by that name or hand out free points;
 *  - "England", "Scotland", "Wales": parts of the United Kingdom, not the
 *    country the shape shows;
 *  - names in other languages, apart from the few that are also the
 *    country's current official English-language name (Türkiye, Eswatini).
 */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  ARE: ["UAE", "Emirates"],
  ATG: ["Antigua"],
  BIH: ["Bosnia"],
  BRN: ["Brunei Darussalam"],
  CAF: ["CAR"],
  CHN: ["PRC", "People's Republic of China"],
  CIV: ["Ivory Coast", "Cote dIvoire"],
  COD: [
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
    "DRC",
    "Congo-Kinshasa",
  ],
  COG: ["Republic of the Congo", "Republic of Congo", "Congo Republic"],
  CPV: ["Cape Verde"],
  CZE: ["Czech Republic"],
  FSM: ["Federated States of Micronesia"],
  GBR: ["UK", "Great Britain", "Britain"],
  IRL: ["Republic of Ireland"],
  KGZ: ["Kyrgyz Republic"],
  KNA: ["Saint Kitts"],
  KOR: ["Republic of Korea", "Korea South"],
  LAO: ["Lao", "Lao PDR"],
  MDA: ["Republic of Moldova"],
  MKD: ["Macedonia"],
  MMR: ["Burma"],
  NLD: ["Holland"],
  PNG: ["PNG"],
  PRK: ["DPRK", "Korea North"],
  PSE: ["State of Palestine", "Palestinian Territories"],
  RUS: ["Russian Federation"],
  SAU: ["KSA"],
  STP: ["Sao Tome"],
  SVK: ["Slovak Republic"],
  SWZ: ["Swaziland"],
  SYR: ["Syrian Arab Republic"],
  TLS: ["East Timor"],
  TTO: ["Trinidad"],
  TUR: ["Turkiye"],
  TZA: ["United Republic of Tanzania"],
  USA: ["USA", "US", "United States", "America"],
  VAT: ["Vatican", "Holy See"],
  VCT: ["Saint Vincent"],
  VNM: ["Viet Nam"],
  ZAF: ["RSA"],
};
