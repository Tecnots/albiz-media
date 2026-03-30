"use client";

import { useRef, useEffect, useState } from "react";
import Globe from "react-globe.gl";

interface GlobePoint {
  lat: number; lng: number; size: number; color: string; label: string;
}
interface GlobeRing {
  lat: number; lng: number; label: string; color: string; maxR: number; speed: number;
  count?: number;
}
interface GlobeArc {
  startLat: number; startLng: number; endLat: number; endLng: number; color: string[];
}

export default function GlobeComponent({ points, hotRings, warmRings, arcs }: {
  points: GlobePoint[];
  hotRings: GlobeRing[];
  warmRings: GlobeRing[];
  arcs: GlobeArc[];
}) {
  const visitorDots: GlobePoint[] = [
    ...hotRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(0.5 + (r.count ?? 1) * 0.08, 1.4), color: "#F44444", label: r.label })),
    ...warmRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(0.4 + (r.count ?? 1) * 0.06, 1.1), color: "#F59E0B", label: r.label })),
  ];
  const allPoints = [...points, ...visitorDots];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hexCountries, setHexCountries] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [indiaStates, setIndiaStates] = useState<any[]>([]);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // World hex dots — fast GPU-accelerated rendering
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
      .then(r => r.json())
      .then(data => setHexCountries(data.features ?? []))
      .catch(() => {});
  }, []);

  // India states only — small set (~30 polygons), for state outlines
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson")
      .then(r => r.json())
      .then(data => setIndiaStates(data.features ?? []))
      .catch(() => {});
  }, []);

  // Initial zoom + auto-rotate — retry until controls are ready
  useEffect(() => {
    let tries = 0;
    const attempt = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globe = globeEl.current as any;
      if (!globe) { if (tries++ < 20) setTimeout(attempt, 200); return; }
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
      const controls = globe.controls?.();
      if (!controls) { if (tries++ < 20) setTimeout(attempt, 200); return; }
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
    };
    const t = setTimeout(attempt, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere={true}
        atmosphereColor="#ffffff"
        atmosphereAltitude={0.1}
        showGraticules={true}
        globeImageUrl=""
        // Fast hex dots for world land masses (GPU shader, no lag)
        hexPolygonsData={hexCountries}
        hexPolygonResolution={3}
        hexPolygonMargin={0.5}
        hexPolygonColor={() => "rgba(255,255,255,0.4)"}
        // India states only — thin red borders (~30 polygons, minimal cost)
        polygonsData={indiaStates}
        polygonCapColor={() => "rgba(244,68,68,0.06)"}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={() => "rgba(244,68,68,0.5)"}
        polygonAltitude={0}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        polygonLabel={(f: any) => f.properties?.NAME_1 ?? f.properties?.ST_NM ?? ""}
        // Visitor dots on surface
        pointsData={allPoints}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0}
        pointRadius="size"
        pointLabel="label"
        // Animated arcs
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
    </div>
  );
}
