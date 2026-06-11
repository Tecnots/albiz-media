"use client";

import dynamic from "next/dynamic";
import type { GlobeCountry } from "./AudienceGlobeInner";

const AudienceGlobeInner = dynamic(() => import("./AudienceGlobeInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center" style={{ height: 340 }}>
      <div className="w-5 h-5 rounded-full border-2 border-[#F44444] border-t-transparent animate-spin" />
    </div>
  ),
});

export default function AudienceGlobe({
  countries,
  focusCountry,
  onCountrySelect,
}: {
  countries: GlobeCountry[];
  focusCountry?: string | null;
  onCountrySelect?: (country: GlobeCountry | null) => void;
}) {
  return (
    <AudienceGlobeInner
      countries={countries}
      focusCountry={focusCountry}
      onCountrySelect={onCountrySelect}
    />
  );
}
