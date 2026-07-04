import { NextRequest, NextResponse } from "next/server";
import { currencyFlag } from "@/app/lib/currency";

// ── Language codes: widely supported BCP 47 codes ────────────────────────────
const LANGUAGE_CODES = [
  "af","ak","am","ar","az","be","bg","bm","bn","bo","br","bs","ca","ce","co",
  "cs","cy","da","de","dz","ee","el","en","eo","es","et","eu","fa","fi","fo",
  "fr","fy","ga","gd","gl","gu","gv","ha","he","hi","hr","ht","hu","hy","ia",
  "id","ig","ii","is","it","ja","jv","ka","ki","kk","kl","km","kn","ko","ks",
  "ku","kw","ky","la","lb","lg","ln","lo","lt","lu","lv","mg","mi","mk","ml",
  "mn","mr","ms","mt","my","nb","nd","ne","nl","nn","no","or","os","pa","pl",
  "ps","pt","qu","rm","rn","ro","ru","rw","sd","se","sg","si","sk","sl","sn",
  "so","sq","sr","ss","st","su","sv","sw","ta","te","tg","th","ti","tk","tl",
  "tn","to","tr","ts","tt","tw","ug","uk","ur","uz","ve","vi","vo","wa","wo",
  "xh","yi","yo","za","zh","zu",
];

function buildLanguages() {
  const enNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });
  const result: { code: string; name: string; nativeName: string }[] = [];
  for (const code of LANGUAGE_CODES) {
    try {
      const enName = enNames.of(code) ?? code;
      const nativeDisp = new Intl.DisplayNames([code], { type: "language", fallback: "code" });
      const nativeName = nativeDisp.of(code) ?? enName;
      result.push({ code, name: enName, nativeName });
    } catch {
      result.push({ code, name: code, nativeName: code });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

// ── Timezone helpers ──────────────────────────────────────────────────────────
function getUtcOffsetMinutes(tz: string): number {
  try {
    const ref    = new Date(2026, 0, 15, 12, 0, 0); // mid-winter to avoid DST edge
    const utcStr = ref.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr  = ref.toLocaleString("en-US", { timeZone: tz });
    return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60_000;
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs  = Math.abs(minutes);
  const h    = Math.floor(abs / 60).toString().padStart(2, "0");
  const m    = (abs % 60).toString().padStart(2, "0");
  return `${sign}${h}:${m}`;
}

function buildTimezones() {
  const zones = Intl.supportedValuesOf("timeZone") as string[];
  return zones
    .map(tz => {
      const offsetMins = getUtcOffsetMinutes(tz);
      const offsetStr  = formatOffset(offsetMins);
      const label      = tz.replace(/_/g, " ");
      return { code: tz, name: `UTC${offsetStr} – ${label}`, offset: offsetMins };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "en"));
}

// ── Currency helpers ──────────────────────────────────────────────────────────
// Non-physical / special ISO 4217 codes excluded from the user-facing list.
const SKIP_CURRENCY_CODES = new Set([
  "BOV","CHE","CHW","CLF","COU","MXV","USN","UYI","UYW",
  "XAG","XAU","XBA","XBB","XBC","XBD","XDR","XPD","XPT",
  "XSU","XTS","XUA","XXX",
]);

function getSymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find(p => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

function buildCurrencies() {
  const codes = (Intl.supportedValuesOf("currency") as string[])
    .filter(c => !SKIP_CURRENCY_CODES.has(c));
  const names = new Intl.DisplayNames(["en"], { type: "currency", fallback: "code" });
  return codes
    .map(code => ({
      code,
      name:   names.of(code) ?? code,
      symbol: getSymbol(code),
      flag:   currencyFlag(code),   // uses the shared CURRENCY_COUNTRY map
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

// ── Cache: built once per server process lifecycle ────────────────────────────
let _languages: ReturnType<typeof buildLanguages> | null = null;
let _timezones: ReturnType<typeof buildTimezones> | null = null;
let _currencies: ReturnType<typeof buildCurrencies> | null = null;

const getLanguages  = () => (_languages  ??= buildLanguages());
const getTimezones  = () => (_timezones  ??= buildTimezones());
const getCurrencies = () => (_currencies ??= buildCurrencies());

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const type    = req.nextUrl.searchParams.get("type");
  const headers = { "Cache-Control": "public, max-age=3600, stale-while-revalidate=300" };

  switch (type) {
    case "languages":  return NextResponse.json(getLanguages(),  { headers });
    case "timezones":  return NextResponse.json(getTimezones(),  { headers });
    case "currencies": return NextResponse.json(getCurrencies(), { headers });
    default:
      return NextResponse.json(
        { error: "Invalid type. Use: languages, timezones, currencies" },
        { status: 400 }
      );
  }
}