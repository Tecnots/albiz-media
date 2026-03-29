"use client";

import { useRef, useEffect } from "react";
import Globe from "react-globe.gl";

interface GlobePoint {
  lat: number; lng: number; size: number; color: string; label: string;
}
interface GlobeArc {
  startLat: number; startLng: number; endLat: number; endLng: number; color: string[];
}

export default function GlobeComponent({ points, arcs }: { points: GlobePoint[]; arcs: GlobeArc[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);

  // Enable auto-rotate once mounted
  useEffect(() => {
    const timeout = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (globeEl.current as any)?.controls?.();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Globe
      ref={globeEl}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="#F44444"
      atmosphereAltitude={0.12}
      // Points
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.01}
      pointRadius="size"
      pointLabel="label"
      // Arcs
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor="color"
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={2000}
      arcStroke={0.5}
    />
  );
}
