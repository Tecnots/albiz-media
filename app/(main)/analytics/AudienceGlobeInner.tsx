"use client";

import {
  useRef, useEffect, useState, useMemo, useCallback, Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { geoEquirectangular, geoPath, geoContains } from "d3-geo";

export interface GlobeCountry {
  name: string;
  count: number;
  pct: number;
}

const GEO_FIX: Record<string, string> = {
  "United States": "United States of America",
  "UAE": "United Arab Emirates",
  "Hong Kong": "Hong Kong S.A.R.",
  "Czech Republic": "Czechia",
  "Democratic Republic of Congo": "Democratic Republic of the Congo",
};

const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Full names
  "Afghanistan": [33.94, 67.71],
  "Algeria": [28.03, 1.66],
  "Argentina": [-38.42, -63.62],
  "Australia": [-25.27, 133.77],
  "Austria": [47.52, 14.55],
  "Bangladesh": [23.68, 90.36],
  "Belgium": [50.50, 4.47],
  "Brazil": [-14.24, -51.93],
  "Cambodia": [12.57, 104.99],
  "Canada": [56.13, -106.34],
  "Chile": [-35.68, -71.54],
  "China": [35.86, 104.19],
  "Colombia": [4.57, -74.30],
  "Czech Republic": [49.82, 15.47],
  "Denmark": [56.26, 9.50],
  "Egypt": [26.82, 30.80],
  "Ethiopia": [9.15, 40.49],
  "Finland": [61.92, 25.75],
  "France": [46.23, 2.21],
  "Germany": [51.17, 10.45],
  "Ghana": [7.95, -1.02],
  "Greece": [39.07, 21.82],
  "Hong Kong": [22.32, 114.17],
  "Hungary": [47.16, 19.50],
  "India": [20.59, 78.96],
  "Indonesia": [-0.79, 113.92],
  "Iran": [32.43, 53.69],
  "Iraq": [33.22, 43.68],
  "Ireland": [53.41, -8.24],
  "Israel": [31.05, 34.85],
  "Italy": [41.87, 12.57],
  "Japan": [36.20, 138.25],
  "Jordan": [30.59, 36.24],
  "Kazakhstan": [48.02, 66.92],
  "Kenya": [-0.02, 37.91],
  "Kuwait": [29.34, 47.49],
  "Malaysia": [4.21, 101.98],
  "Mexico": [23.63, -102.55],
  "Morocco": [31.79, -7.09],
  "Myanmar": [21.91, 95.96],
  "Nepal": [28.39, 84.12],
  "Netherlands": [52.13, 5.29],
  "New Zealand": [-40.90, 174.89],
  "Nigeria": [9.08, 8.67],
  "Norway": [60.47, 8.47],
  "Pakistan": [30.38, 69.35],
  "Peru": [-9.19, -75.02],
  "Philippines": [12.88, 121.77],
  "Poland": [51.92, 19.14],
  "Portugal": [39.40, -8.22],
  "Qatar": [25.35, 51.18],
  "Romania": [45.94, 24.97],
  "Russia": [61.52, 105.32],
  "Saudi Arabia": [23.88, 45.08],
  "Singapore": [1.35, 103.82],
  "South Africa": [-30.56, 22.94],
  "South Korea": [35.91, 127.77],
  "Spain": [40.46, -3.75],
  "Sri Lanka": [7.87, 80.77],
  "Sweden": [60.13, 18.64],
  "Switzerland": [46.82, 8.23],
  "Taiwan": [23.70, 121.00],
  "Thailand": [15.87, 100.99],
  "Turkey": [38.96, 35.24],
  "Türkiye": [38.96, 35.24],
  "UAE": [23.42, 53.85],
  "Ukraine": [48.38, 31.17],
  "United Arab Emirates": [23.42, 53.85],
  "United Kingdom": [55.37, -3.43],
  "United States": [37.09, -95.71],
  "United States of America": [37.09, -95.71],
  "Vietnam": [14.06, 108.28],
  "Viet Nam": [14.06, 108.28],
  "Russian Federation": [61.52, 105.32],
  "Republic of Korea": [35.91, 127.77],
  "Korea, South": [35.91, 127.77],
  "Iran, Islamic Republic of": [32.43, 53.69],
  "Hong Kong S.A.R.": [22.32, 114.17],
  // ISO alpha-2 codes — fallback when country name is missing from user profile
  "AF": [33.94, 67.71],
  "DZ": [28.03, 1.66],
  "AR": [-38.42, -63.62],
  "AU": [-25.27, 133.77],
  "AT": [47.52, 14.55],
  "BD": [23.68, 90.36],
  "BE": [50.50, 4.47],
  "BR": [-14.24, -51.93],
  "KH": [12.57, 104.99],
  "CA": [56.13, -106.34],
  "CL": [-35.68, -71.54],
  "CN": [35.86, 104.19],
  "CO": [4.57, -74.30],
  "CZ": [49.82, 15.47],
  "DK": [56.26, 9.50],
  "EG": [26.82, 30.80],
  "ET": [9.15, 40.49],
  "FI": [61.92, 25.75],
  "FR": [46.23, 2.21],
  "DE": [51.17, 10.45],
  "GH": [7.95, -1.02],
  "GR": [39.07, 21.82],
  "HK": [22.32, 114.17],
  "HU": [47.16, 19.50],
  "IN": [20.59, 78.96],
  "ID": [-0.79, 113.92],
  "IR": [32.43, 53.69],
  "IQ": [33.22, 43.68],
  "IE": [53.41, -8.24],
  "IL": [31.05, 34.85],
  "IT": [41.87, 12.57],
  "JP": [36.20, 138.25],
  "JO": [30.59, 36.24],
  "KZ": [48.02, 66.92],
  "KE": [-0.02, 37.91],
  "KW": [29.34, 47.49],
  "MY": [4.21, 101.98],
  "MX": [23.63, -102.55],
  "MA": [31.79, -7.09],
  "MM": [21.91, 95.96],
  "NP": [28.39, 84.12],
  "NL": [52.13, 5.29],
  "NZ": [-40.90, 174.89],
  "NG": [9.08, 8.67],
  "NO": [60.47, 8.47],
  "PK": [30.38, 69.35],
  "PE": [-9.19, -75.02],
  "PH": [12.88, 121.77],
  "PL": [51.92, 19.14],
  "PT": [39.40, -8.22],
  "QA": [25.35, 51.18],
  "RO": [45.94, 24.97],
  "RU": [61.52, 105.32],
  "SA": [23.88, 45.08],
  "SG": [1.35, 103.82],
  "ZA": [-30.56, 22.94],
  "KR": [35.91, 127.77],
  "ES": [40.46, -3.75],
  "LK": [7.87, 80.77],
  "SE": [60.13, 18.64],
  "CH": [46.82, 8.23],
  "TW": [23.70, 121.00],
  "TH": [15.87, 100.99],
  "TR": [38.96, 35.24],
  "AE": [23.42, 53.85],
  "UA": [48.38, 31.17],
  "GB": [55.37, -3.43],
  "UK": [55.37, -3.43],
  "US": [37.09, -95.71],
  "VN": [14.06, 108.28],
};

// Convert lat/lng to THREE.js Cartesian matching SphereGeometry UV layout
function geoToCartesian(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = ((lng + 180) / 360) * 2 * Math.PI;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
     r * Math.cos(theta),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// Inverse: THREE.js Cartesian → [lat, lng]
function cartesianToGeo(point: THREE.Vector3): [number, number] {
  const n = point.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
  const phi = Math.atan2(n.z, -n.x);
  const phiNorm = ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const lng = (phiNorm / (2 * Math.PI)) * 360 - 180;
  return [lat, lng];
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Build a canvas texture with country choropleth overlay
function buildOverlayTexture(
  features: any[],
  followerMap: Map<string, GlobeCountry>,
  maxCount: number,
  selectedName: string | null
): THREE.CanvasTexture {
  const W = 4096, H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const projection = geoEquirectangular()
    .scale(H / Math.PI)
    .translate([W / 2, H / 2]);

  const path = geoPath(projection, ctx as any);

  for (const feature of features) {
    const name =
      (feature?.properties?.ADMIN as string) ||
      (feature?.properties?.NAME as string) ||
      "";
    const entry = followerMap.get(name);
    const isSelected = !!selectedName && entry?.name === selectedName;

    ctx.beginPath();
    path(feature as any);

    if (isSelected) {
      ctx.fillStyle = "rgba(244,68,68,0.9)";
      ctx.strokeStyle = "rgba(255,140,140,0.85)";
      ctx.lineWidth = 3;
    } else if (entry) {
      const ratio = entry.count / maxCount;
      const alpha = (0.18 + ratio * 0.52).toFixed(2);
      ctx.fillStyle = `rgba(244,68,68,${alpha})`;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.2;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.5;
    }

    ctx.fill();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// — Earth sphere with PBR-ish material + canvas choropleth overlay —
function EarthMesh({
  features,
  followerMap,
  maxCount,
  selectedName,
}: {
  features: any[];
  followerMap: Map<string, GlobeCountry>;
  maxCount: number;
  selectedName: string | null;
}) {
  const textures = useTexture([
    "//unpkg.com/three-globe/example/img/earth-day.jpg",
    "//unpkg.com/three-globe/example/img/earth-topology.png",
  ]);
  const dayTex = textures[0];
  const bumpTex = textures[1];

  const specColor = useMemo(() => new THREE.Color(0x111111), []);

  const overlayTex = useMemo(() => {
    if (features.length === 0) return null;
    return buildOverlayTexture(features, followerMap, maxCount, selectedName);
  }, [features, followerMap, maxCount, selectedName]);

  const prevOverlay = useRef<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const prev = prevOverlay.current;
    if (prev && prev !== overlayTex) prev.dispose();
    prevOverlay.current = overlayTex;
  }, [overlayTex]);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={dayTex}
          bumpMap={bumpTex}
          bumpScale={0.04}
          specular={specColor}
          shininess={6}
        />
      </mesh>

      {overlayTex && (
        <mesh renderOrder={1}>
          <sphereGeometry args={[1.001, 64, 64]} />
          <meshBasicMaterial
            map={overlayTex}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Subtle atmosphere rim */}
      <mesh scale={1.12}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// — Smooth camera fly-to animation —
function CameraRig({
  focusCountry,
  controlsRef,
}: {
  focusCountry?: string | null;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const flyTo = useRef<THREE.Vector3 | null>(null);
  const flyFrom = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 3));
  const flyT = useRef(1);

  useEffect(() => {
    if (!focusCountry) return;
    const coords = COUNTRY_COORDS[focusCountry];
    if (!coords) return;

    flyFrom.current = camera.position.clone();
    flyTo.current = geoToCartesian(coords[0], coords[1], 2.4);
    flyT.current = 0;

    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, [focusCountry, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!flyTo.current || flyT.current >= 1) return;
    flyT.current = Math.min(flyT.current + delta * 1.4, 1);
    const t = easeInOut(flyT.current);

    const fromDist = flyFrom.current.length();
    const toDist = flyTo.current.length();
    const dist = fromDist + (toDist - fromDist) * t;

    const fromN = flyFrom.current.clone().normalize();
    const toN = flyTo.current.clone().normalize();
    // nlerp along great-circle arc
    const dir = fromN.lerp(toN, t).normalize();
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);
    controlsRef.current?.update();

    if (flyT.current >= 1) {
      flyTo.current = null;
      const ctrl = controlsRef.current;
      if (ctrl) setTimeout(() => { ctrl.autoRotate = true; }, 5000);
    }
  });

  return null;
}

// — Presence dots + pulse rings at each country centroid —
function CountryMarkers({
  countries,
  selected,
  onSelect,
}: {
  countries: GlobeCountry[];
  selected: GlobeCountry | null;
  onSelect: (c: GlobeCountry | null) => void;
}) {
  const maxCount = useMemo(
    () => Math.max(...countries.map(c => c.count), 1),
    [countries]
  );

  const markers = useMemo(
    () =>
      countries.slice(0, 15).reduce<
        {
          country: GlobeCountry;
          pos: THREE.Vector3;
          baseScale: number;
          isPulse: boolean;
          ringQuat: THREE.Quaternion;
        }[]
      >((acc, c, i) => {
        const coords = COUNTRY_COORDS[c.name];
        if (!coords) return acc;
        const pos = geoToCartesian(coords[0], coords[1], 1.028);
        const baseScale = 0.012 + (c.count / maxCount) * 0.016;
        const isPulse = i < 3;
        const ringQuat = new THREE.Quaternion();
        ringQuat.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          pos.clone().normalize()
        );
        acc.push({ country: c, pos, baseScale, isPulse, ringQuat });
        return acc;
      }, []),
    [countries, maxCount]
  );

  const pulseTs = useRef<number[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(() => {
    pulseTs.current = markers.map((_, i) => (i * 0.38) % 1);
    ringRefs.current = new Array(markers.length).fill(null);
  }, [markers]);

  useFrame((_, delta) => {
    for (let i = 0; i < markers.length; i++) {
      if (!markers[i].isPulse) continue;
      const ring = ringRefs.current[i];
      if (!ring) continue;
      pulseTs.current[i] = ((pulseTs.current[i] ?? 0) + delta * 0.65) % 1;
      const t = pulseTs.current[i];
      ring.scale.setScalar(1 + t * 3.8);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45;
    }
  });

  return (
    <>
      {markers.map((m, i) => {
        const isSelected = selected?.name === m.country.name;
        const color = isSelected ? "#F44444" : "#ffffff";
        return (
          <group key={m.country.name} position={m.pos}>
            {/* Soft glow halo */}
            <mesh>
              <sphereGeometry args={[m.baseScale * 3.2, 6, 6]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.15 : 0.06}
                depthWrite={false}
              />
            </mesh>
            {/* Dot */}
            <mesh
              onPointerDown={e => {
                e.stopPropagation();
                onSelect(isSelected ? null : m.country);
              }}
            >
              <sphereGeometry args={[m.baseScale, 10, 10]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 1 : 0.88}
              />
            </mesh>
            {/* Pulse ring for top 3 */}
            {m.isPulse && (
              <mesh
                ref={el => { ringRefs.current[i] = el; }}
                quaternion={m.ringQuat}
              >
                <ringGeometry args={[m.baseScale * 1.5, m.baseScale * 2.2, 32]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.4}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

// — Invisible click-catcher sphere for country hit detection —
function ClickLayer({
  features,
  followerMap,
  selected,
  onSelect,
  controlsRef,
}: {
  features: any[];
  followerMap: Map<string, GlobeCountry>;
  selected: GlobeCountry | null;
  onSelect: (c: GlobeCountry | null) => void;
  controlsRef: React.MutableRefObject<any>;
}) {
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const [lat, lng] = cartesianToGeo(e.point);
      const geoPoint: [number, number] = [lng, lat];

      for (const feat of features) {
        if (geoContains(feat, geoPoint)) {
          const name =
            (feat?.properties?.ADMIN as string) ||
            (feat?.properties?.NAME as string) ||
            "";
          const entry = followerMap.get(name);
          if (entry) {
            const next = selected?.name === entry.name ? null : entry;
            onSelect(next);
          } else {
            onSelect(null);
          }
          if (controlsRef.current) {
            controlsRef.current.autoRotate = false;
            setTimeout(() => {
              if (controlsRef.current) controlsRef.current.autoRotate = true;
            }, 4000);
          }
          return;
        }
      }
      onSelect(null);
    },
    [features, followerMap, selected, onSelect, controlsRef]
  );

  return (
    <mesh onPointerDown={handleClick} renderOrder={2}>
      <sphereGeometry args={[1.005, 32, 32]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// — Scene root —
function GlobeScene({
  countries,
  focusCountry,
  geoFeatures,
  selected,
  onSelect,
}: {
  countries: GlobeCountry[];
  focusCountry?: string | null;
  geoFeatures: any[];
  selected: GlobeCountry | null;
  onSelect: (c: GlobeCountry | null) => void;
}) {
  const controlsRef = useRef<any>(null);

  const maxCount = useMemo(
    () => Math.max(...countries.map(c => c.count), 1),
    [countries]
  );

  const followerMap = useMemo(() => {
    const m = new Map<string, GlobeCountry>();
    for (const c of countries) {
      m.set(c.name, c);
      const fix = GEO_FIX[c.name];
      if (fix) m.set(fix, c);
    }
    return m;
  }, [countries]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 3, 4]} intensity={1.1} />
      <directionalLight position={[-3, -1, -2]} intensity={0.12} color="#7799ff" />

      <Suspense fallback={null}>
        <EarthMesh
          features={geoFeatures}
          followerMap={followerMap}
          maxCount={maxCount}
          selectedName={selected?.name ?? null}
        />
      </Suspense>

      <CountryMarkers
        countries={countries}
        selected={selected}
        onSelect={onSelect}
      />

      <ClickLayer
        features={geoFeatures}
        followerMap={followerMap}
        selected={selected}
        onSelect={onSelect}
        controlsRef={controlsRef}
      />

      <CameraRig focusCountry={focusCountry} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={1.5}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.5}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
        makeDefault
      />
    </>
  );
}

// — Public component —
export default function AudienceGlobeInner({
  countries,
  focusCountry,
  onCountrySelect,
}: {
  countries: GlobeCountry[];
  focusCountry?: string | null;
  onCountrySelect?: (country: GlobeCountry | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [geoFeatures, setGeoFeatures] = useState<any[]>([]);
  const [selected, setSelected] = useState<GlobeCountry | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson"
    )
      .then(r => r.json())
      .then((d: any) => setGeoFeatures(d.features ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (focusCountry === null) {
      setSelected(null);
    } else if (focusCountry) {
      const entry = countries.find(c => c.name === focusCountry);
      if (entry) setSelected(entry);
    }
  }, [focusCountry, countries]);

  const handleSelect = useCallback(
    (c: GlobeCountry | null) => {
      setSelected(c);
      onCountrySelect?.(c);
    },
    [onCountrySelect]
  );

  const height = Math.min(Math.round(width * 0.82), 500);
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  return (
    <div ref={containerRef} className="relative" style={{ width: "100%", height }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        dpr={dpr}
        style={{ background: "transparent" }}
      >
        <GlobeScene
          countries={countries}
          focusCountry={focusCountry}
          geoFeatures={geoFeatures}
          selected={selected}
          onSelect={handleSelect}
        />
      </Canvas>

      {selected && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
          style={{
            background: "rgba(10,10,10,0.85)",
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          <span className="font-semibold text-white">{selected.name}</span>
          <span className="text-[#F44444] font-medium">{selected.count} followers</span>
          <span className="text-[#777]">{selected.pct}%</span>
          <button
            onClick={() => handleSelect(null)}
            className="text-[#555] hover:text-white ml-1 leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
