// Static country → region mapping (ISO 3166-1 alpha-2)
// Used by the feed algorithm to apply regional content boosts

export const COUNTRY_REGIONS: Record<string, string> = {
  // South Asia
  IN: "south_asia", PK: "south_asia", BD: "south_asia",
  LK: "south_asia", NP: "south_asia", BT: "south_asia", MV: "south_asia",

  // Southeast Asia
  SG: "southeast_asia", MY: "southeast_asia", TH: "southeast_asia",
  PH: "southeast_asia", ID: "southeast_asia", VN: "southeast_asia",
  MM: "southeast_asia", KH: "southeast_asia", LA: "southeast_asia",
  BN: "southeast_asia", TL: "southeast_asia",

  // East Asia
  CN: "east_asia", JP: "east_asia", KR: "east_asia",
  TW: "east_asia", HK: "east_asia", MO: "east_asia", MN: "east_asia",

  // Middle East & North Africa
  AE: "mena", SA: "mena", EG: "mena", JO: "mena",
  LB: "mena", QA: "mena", KW: "mena", BH: "mena",
  OM: "mena", IQ: "mena", IR: "mena", IL: "mena",
  MA: "mena", TN: "mena", DZ: "mena", LY: "mena",
  SY: "mena", YE: "mena",

  // West Africa
  NG: "west_africa", GH: "west_africa", SN: "west_africa",
  CI: "west_africa", CM: "west_africa", BJ: "west_africa",
  TG: "west_africa", BF: "west_africa", ML: "west_africa",
  GN: "west_africa", SL: "west_africa", LR: "west_africa",
  GM: "west_africa", GW: "west_africa", MR: "west_africa",
  NE: "west_africa", TD: "west_africa",

  // East Africa
  KE: "east_africa", TZ: "east_africa", UG: "east_africa",
  ET: "east_africa", RW: "east_africa", ZM: "east_africa",
  MZ: "east_africa", MG: "east_africa", SO: "east_africa",
  SS: "east_africa", SD: "east_africa", ER: "east_africa",
  DJ: "east_africa",

  // Southern Africa
  ZA: "southern_africa", ZW: "southern_africa", BW: "southern_africa",
  NA: "southern_africa", SZ: "southern_africa", LS: "southern_africa",
  MW: "southern_africa", AO: "southern_africa",

  // Western Europe
  GB: "western_europe", FR: "western_europe", DE: "western_europe",
  NL: "western_europe", BE: "western_europe", CH: "western_europe",
  AT: "western_europe", IE: "western_europe", LU: "western_europe",
  MC: "western_europe", LI: "western_europe",

  // Southern Europe
  IT: "southern_europe", ES: "southern_europe", PT: "southern_europe",
  GR: "southern_europe", TR: "southern_europe", CY: "southern_europe",
  MT: "southern_europe", HR: "southern_europe", SI: "southern_europe",
  AL: "southern_europe", RS: "southern_europe", ME: "southern_europe",
  BA: "southern_europe", MK: "southern_europe",

  // Northern Europe
  SE: "northern_europe", NO: "northern_europe", DK: "northern_europe",
  FI: "northern_europe", IS: "northern_europe", EE: "northern_europe",
  LV: "northern_europe", LT: "northern_europe",

  // Eastern Europe
  PL: "eastern_europe", CZ: "eastern_europe", SK: "eastern_europe",
  HU: "eastern_europe", RO: "eastern_europe", BG: "eastern_europe",
  UA: "eastern_europe", BY: "eastern_europe", MD: "eastern_europe",
  RU: "eastern_europe", GE: "eastern_europe", AM: "eastern_europe",
  AZ: "eastern_europe",

  // North America
  US: "north_america", CA: "north_america", MX: "north_america",

  // Latin America
  BR: "latin_america", AR: "latin_america", CO: "latin_america",
  CL: "latin_america", PE: "latin_america", VE: "latin_america",
  EC: "latin_america", BO: "latin_america", PY: "latin_america",
  UY: "latin_america", GY: "latin_america", SR: "latin_america",
  CR: "latin_america", PA: "latin_america", GT: "latin_america",
  HN: "latin_america", SV: "latin_america", NI: "latin_america",
  CU: "latin_america", DO: "latin_america", HT: "latin_america",
  JM: "latin_america", TT: "latin_america",

  // Oceania
  AU: "oceania", NZ: "oceania", FJ: "oceania",
  PG: "oceania", SB: "oceania", VU: "oceania",

  // Central Asia
  KZ: "central_asia", UZ: "central_asia", TM: "central_asia",
  TJ: "central_asia", KG: "central_asia", AF: "central_asia",
};

export function getRegion(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  return COUNTRY_REGIONS[countryCode.toUpperCase()] ?? null;
}

export function isSameRegion(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ra = getRegion(a);
  const rb = getRegion(b);
  return ra !== null && ra === rb;
}
