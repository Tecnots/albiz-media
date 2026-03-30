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
  // Visitor dots with a glow halo — rendered as two layers per point:
  // 1. Large semi-transparent halo (the glow)
  // 2. Small bright solid dot (the actual pin)
  const visitorHalos: GlobePoint[] = [
    ...hotRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(1.0 + (r.count ?? 1) * 0.15, 3.0), color: "rgba(244,68,68,0.18)", label: "" })),
    ...warmRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(0.8 + (r.count ?? 1) * 0.12, 2.4), color: "rgba(245,158,11,0.18)", label: "" })),
  ];
  const visitorDots: GlobePoint[] = [
    ...hotRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(0.35 + (r.count ?? 1) * 0.07, 1.1), color: "#F44444", label: r.label })),
    ...warmRings.map(r => ({ lat: r.lat, lng: r.lng, size: Math.min(0.28 + (r.count ?? 1) * 0.05, 0.85), color: "#F59E0B", label: r.label })),
  ];
  const allPoints = [...points, ...visitorHalos, ...visitorDots];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countries, setCountries] = useState<any[]>([]);

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

  // Load world countries for hex polygon dots
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
      .then(r => r.json())
      .then(data => setCountries(data.features ?? []))
      .catch(() => {});
  }, []);

  // Auto-rotate
  useEffect(() => {
    const timeout = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = (globeEl.current as any)?.controls?.();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
        controls.enableZoom = true;
      }
    }, 500);
    return () => clearTimeout(timeout);
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
        // No texture — render as a minimal dark sphere
        globeImageUrl=""
        // Dotted land masses via hex polygons
        hexPolygonsData={countries}
        hexPolygonResolution={3}
        hexPolygonMargin={0.3}
        hexPolygonColor={() => "rgba(255,255,255,0.65)"}
        // All dots: faint country totals + bright individual live visitors
        pointsData={allPoints}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.02}
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
