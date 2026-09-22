"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Lycee } from "@/lib/types";

type Subject = { lat: number; lon: number; label?: string } | null;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [34, 34] });
  }, [map, points]);
  return null;
}

/** Lycées on an OpenStreetMap: blue = public, violet = privé, teal = ce bien. */
export default function SchoolsMap({ schools, subject }: { schools: Lycee[]; subject: Subject }) {
  const located = schools.filter((s) => s.lat != null && s.lon != null);
  const points: [number, number][] = [
    ...located.map((s) => [s.lat as number, s.lon as number] as [number, number]),
    ...(subject ? ([[subject.lat, subject.lon]] as [number, number][]) : []),
  ];
  const center: [number, number] = points[0] ?? [46.6, 2.5];

  return (
    <div className="h-[320px] w-full overflow-hidden rounded-xl border border-line">
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

        {located.map((s) => {
          const color = /public/i.test(s.sector) ? "#2563eb" : "#7c3aed";
          return (
            <CircleMarker
              key={s.uai}
              center={[s.lat as number, s.lon as number]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1 }}
            >
              <Popup>
                <div className="text-[12px] leading-relaxed">
                  <div className="font-semibold">{s.name}</div>
                  {s.address && <div>{s.address}</div>}
                  <div>
                    Bac <strong>{s.passRate != null ? `${s.passRate}%` : "—"}</strong>
                    {s.mentionRate != null ? ` · ${s.mentionRate}% mentions` : ""}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {subject && (
          <CircleMarker
            center={[subject.lat, subject.lon]}
            radius={9}
            pathOptions={{ color: "#0b5b4b", fillColor: "#15b796", fillOpacity: 0.95, weight: 3 }}
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
