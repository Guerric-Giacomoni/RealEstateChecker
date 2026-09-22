"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Hospital } from "@/lib/types";

type Subject = { lat: number; lon: number; label?: string } | null;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(points, { padding: [34, 34] });
  }, [map, points]);
  return null;
}

/** Health establishments (red) + the subject (teal) on OpenStreetMap. */
export default function HospitalsMap({
  hospitals,
  subject,
}: {
  hospitals: Hospital[];
  subject: Subject;
}) {
  const points: [number, number][] = [
    ...hospitals.map((h) => [h.lat, h.lon] as [number, number]),
    ...(subject ? ([[subject.lat, subject.lon]] as [number, number][]) : []),
  ];
  const center: [number, number] = points[0] ?? [46.6, 2.5];

  return (
    <div className="h-[320px] w-full overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />

        {hospitals.map((h) => (
          <CircleMarker
            key={h.finess}
            center={[h.lat, h.lon]}
            radius={7}
            pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.8, weight: 1 }}
          >
            <Popup>
              <div className="text-[12px] leading-relaxed">
                <div className="font-semibold">{h.name}</div>
                <div>{h.category}</div>
                {h.city && <div>{h.city}</div>}
                <div>à {h.distance.toFixed(1)} km</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

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
