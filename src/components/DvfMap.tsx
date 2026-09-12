"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DvfComp } from "@/lib/types";
import { eur, int } from "@/lib/format";

type Subject = { lat: number; lon: number; label?: string } | null;

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

/**
 * Comparable sales on an OpenStreetMap (Leaflet). Comps are dots coloured by
 * €/m² vs the subject (green cheaper, red pricier); the subject is a navy pin.
 */
export default function DvfMap({
  comps,
  subject,
  subjectPricePerM2,
}: {
  comps: DvfComp[];
  subject: Subject;
  subjectPricePerM2: number;
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
            pathOptions={{ color: "#1d4477", fillColor: "#3765a5", fillOpacity: 0.95, weight: 3 }}
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
