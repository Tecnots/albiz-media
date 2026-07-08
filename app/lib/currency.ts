// ISO 4217 currency code → ISO 3166-1 alpha-2 country code (or "EU" for euro area).
// For currencies shared by multiple countries the most recognisable member is used.
// Covers every non-special currency returned by Intl.supportedValuesOf("currency").
export const CURRENCY_COUNTRY: Record<string, string> = {
  AED: "AE", AFN: "AF", ALL: "AL", AMD: "AM", ANG: "CW", AOA: "AO",
  ARS: "AR", AUD: "AU", AWG: "AW", AZN: "AZ",
  BAM: "BA", BBD: "BB", BDT: "BD", BGN: "BG", BHD: "BH", BIF: "BI",
  BMD: "BM", BND: "BN", BOB: "BO", BRL: "BR", BSD: "BS", BTN: "BT",
  BWP: "BW", BYN: "BY", BZD: "BZ",
  CAD: "CA", CDF: "CD", CHF: "CH", CLP: "CL", CNY: "CN", COP: "CO",
  CRC: "CR", CUC: "CU", CUP: "CU", CVE: "CV", CZK: "CZ",
  DJF: "DJ", DKK: "DK", DOP: "DO", DZD: "DZ",
  EGP: "EG", ERN: "ER", ETB: "ET", EUR: "EU",
  FJD: "FJ", FKP: "FK",
  GBP: "GB", GEL: "GE", GHS: "GH", GIP: "GI", GMD: "GM", GNF: "GN",
  GTQ: "GT", GYD: "GY",
  HKD: "HK", HNL: "HN", HRK: "HR", HTG: "HT", HUF: "HU",
  IDR: "ID", ILS: "IL", INR: "IN", IQD: "IQ", IRR: "IR", ISK: "IS",
  JMD: "JM", JOD: "JO", JPY: "JP",
  KES: "KE", KGS: "KG", KHR: "KH", KMF: "KM", KPW: "KP", KRW: "KR",
  KWD: "KW", KYD: "KY", KZT: "KZ",
  LAK: "LA", LBP: "LB", LKR: "LK", LRD: "LR", LSL: "LS", LYD: "LY",
  MAD: "MA", MDL: "MD", MGA: "MG", MKD: "MK", MMK: "MM", MNT: "MN",
  MOP: "MO", MRU: "MR", MUR: "MU", MVR: "MV", MWK: "MW", MXN: "MX",
  MYR: "MY", MZN: "MZ",
  NAD: "NA", NGN: "NG", NIO: "NI", NOK: "NO", NPR: "NP", NZD: "NZ",
  OMR: "OM",
  PAB: "PA", PEN: "PE", PGK: "PG", PHP: "PH", PKR: "PK", PLN: "PL",
  PYG: "PY",
  QAR: "QA",
  RON: "RO", RSD: "RS", RUB: "RU", RWF: "RW",
  SAR: "SA", SBD: "SB", SCR: "SC", SDG: "SD", SEK: "SE", SGD: "SG",
  SHP: "SH", SLE: "SL", SLL: "SL", SOS: "SO", SRD: "SR", SSP: "SS",
  STN: "ST", SVC: "SV", SYP: "SY", SZL: "SZ",
  THB: "TH", TJS: "TJ", TMT: "TM", TND: "TN", TOP: "TO", TRY: "TR",
  TTD: "TT", TWD: "TW", TZS: "TZ",
  UAH: "UA", UGX: "UG", USD: "US", UYU: "UY", UZS: "UZ",
  VES: "VE", VND: "VN", VUV: "VU",
  WST: "WS",
  // Multi-country shared currencies — representative member used for flag
  XAF: "CM",  // CFA Franc BEAC  → Cameroon
  XCD: "AG",  // East Caribbean Dollar → Antigua & Barbuda
  XCG: "CW",  // Caribbean Guilder (new 2025) → Curaçao
  XOF: "SN",  // CFA Franc BCEAO → Senegal
  XPF: "PF",  // CFP Franc → French Polynesia
  YER: "YE",
  ZAR: "ZA", ZMW: "ZM", ZWG: "ZW", ZWL: "ZW",
};

// Converts a 2-letter country code (or "EU") to a flag emoji using Regional
// Indicator Symbol Letters. Works for the EU flag too (🇪🇺).
export function currencyFlag(code: string): string {
  const cc = CURRENCY_COUNTRY[code];
  if (!cc || cc.length !== 2) return "";
  const base = 0x1F1E6;
  const A    = 65;
  return String.fromCodePoint(
    base + cc.toUpperCase().charCodeAt(0) - A,
    base + cc.toUpperCase().charCodeAt(1) - A,
  );
}