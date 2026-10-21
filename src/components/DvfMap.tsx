"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { DvfComp } from "@/lib/types";
import { eur, int } from "@/lib/format";

type Subject = { lat: number; lon: number; label?: string } | null;
type Ring = [number, number][];

/** Frame the map around all points whenever they change. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [30, 30] });
  }, [map, points]);
  return null;
}

/** Adds the Geoman polygon/rectangle toolbar; emits the drawn ring. The shape
 *  itself is rendered by React (<Polygon>), so we drop Geoman's own layer. */
function DrawControl({ onDraw }: { onDraw: (ring: Ring) => void }) {
  const map = useMap();
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (map as any).pm;
    if (!pm) return;
    pm.addControls({
      position: "topright",
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
      drawPolyline: false,
      drawText: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: false,
    });
    pm.setGlobalOptions({ snappable: false, allowSelfIntersection: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCreate = (e: any) => {
      const ll = e.layer.getLatLngs();
      const arr = Array.isArray(ll[0]) ? ll[0] : ll;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ring: Ring = arr.map((p: any) => [p.lat, p.lng]);
      map.removeLayer(e.layer);
      onDraw(ring);
    };
    map.on("pm:create", onCreate);
    return () => {
      map.off("pm:create", onCreate);
      try {
        pm.removeControls();
      } catch {
        /* map already torn down */
      }
    };
  }, [map, onDraw]);
  return null;
}

/**
 * Comparable sales on an OpenStreetMap (Leaflet). Comps are dots coloured by
 * €/m² vs the subject (green cheaper, red pricier); the subject is a navy pin.
 */
export default function DvfMap({
  comps,
  subject,
  subjectPricePerM2,
  drawable = false,
  drawnArea = null,
  onDraw,
}: {
  comps: DvfComp[];
  subject: Subject;
  subjectPricePerM2: number;
  drawable?: boolean;
  drawnArea?: Ring | null;
  onDraw?: (ring: Ring) => void;
}) {
  const located = comps.filter((c) => c.lat != null && c.lon != null);
  const points: [number, number][] = [
    ...located.map((c) => [c.lat as number, c.lon as number] as [number, number]),
    ...(subject ? ([[subject.lat, subject.lon]] as [number, number][]) : []),
  ];
  const center: [number, number] = points[0] ?? [46.6, 2.5]; // France fallback

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {drawable && onDraw && <DrawControl onDraw={onDraw} />}
        {drawnArea && drawnArea.length >= 3 && (
          <Polygon
            positions={drawnArea}
            pathOptions={{ color: "#108971", weight: 2, fillColor: "#15b796", fillOpacity: 0.08 }}
          />
        )}

        {located.map((c) => {
          const cheaper = c.pricePerM2 <= subjectPricePerM2;
          const color = cheaper ? "#0f766e" : "#be123c";
          return (
            <CircleMarker
              key={c.id}
              center={[c.lat as number, c.lon as number]}
              radius={6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 1 }}
            >
              <Popup>
                <div className="text-[12px] leading-relaxed">
                  <div className="font-semibold">{c.address || "—"}</div>
                  <div>
                    {eur(c.price)} · {c.surface} m² ·{" "}
                    <strong>{int(c.pricePerM2)} €/m²</strong>
                  </div>
                  {c.rooms != null && <div>{c.rooms} pièces</div>}
                  {c.distance != null && <div>à {c.distance.toFixed(2)} km</div>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {subject && (
          <CircleMarker
            center={[subject.lat, subject.lon]}
            radius={9}
            pathOptions={{ color: "#108971", fillColor: "#15b796", fillOpacity: 0.95, weight: 3 }}
          >
            <Popup>
              <div className="text-[12px] font-semibold">{subject.label || "Ce bien"}</div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
