"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { LatLngBoundsExpression, CircleMarker as LCircleMarker } from "leaflet";
import type { DvfComp } from "@/lib/types";
import type { Ring } from "@/lib/geo";
import { eur, int } from "@/lib/format";

/** How comps are coloured. */
export type ColorMode = "budget" | "market";

/** Fly/zoom the map to a city's bounds (or centre) when they change. */
function FlyTo({ bounds, center }: { bounds: LatLngBoundsExpression | null; center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
    else if (center) map.setView(center, 14);
  }, [map, bounds, center]);
  return null;
}

/** Geoman polygon/rectangle toolbar; emits the drawn ring. React renders the
 *  shape itself (<Polygon>), so Geoman's own layer is dropped. */
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

/** Colour a comp: green = good (below budget / cheaper €/m²), red = above. */
function compColor(c: DvfComp, mode: ColorMode, budget: number, medianPerM2: number): string {
  const good =
    mode === "budget" ? c.price <= budget : c.pricePerM2 <= medianPerM2;
  return good ? "#0f766e" : "#be123c";
}

/**
 * Zone-explorer map. Zooms to a chosen city, lets the user draw a polygon, and
 * plots the DVF sold properties found inside it — coloured by budget or by €/m².
 */
export default function ExplorerMap({
  comps,
  drawnArea,
  onDraw,
  drawable = true,
  colorMode,
  budget,
  medianPerM2,
  cityBounds = null,
  cityCenter = null,
  selectedId = null,
  onSelect,
  highlightId = null,
}: {
  comps: DvfComp[];
  drawnArea: Ring | null;
  onDraw: (ring: Ring) => void;
  drawable?: boolean;
  colorMode: ColorMode;
  budget: number;
  medianPerM2: number;
  cityBounds?: LatLngBoundsExpression | null;
  cityCenter?: [number, number] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  highlightId?: string | null;
}) {
  const located = comps.filter((c) => c.lat != null && c.lon != null);

  // Open the popup of the hovered table row's pin; close on leave/change.
  const markerRefs = useRef<Record<string, LCircleMarker | null>>({});
  useEffect(() => {
    const m = highlightId ? markerRefs.current[highlightId] : null;
    m?.openPopup();
    return () => {
      m?.closePopup();
    };
  }, [highlightId]);

  return (
    <div className="h-[480px] w-full overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={cityCenter ?? [46.6, 2.5]}
        zoom={cityCenter ? 13 : 6}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Frame the city on load; the user drives zoom/pan afterwards. */}
        <FlyTo bounds={cityBounds} center={cityCenter} />
        {drawable && <DrawControl onDraw={onDraw} />}

        {drawnArea && drawnArea.length >= 3 && (
          <Polygon
            positions={drawnArea}
            // Non-interactive so clicks pass through to the pins underneath.
            pathOptions={{
              color: "#108971",
              weight: 2,
              fillColor: "#15b796",
              fillOpacity: 0.08,
              interactive: false,
            }}
          />
        )}

        {located.map((c) => {
          const color = compColor(c, colorMode, budget, medianPerM2);
          const selected = c.id === selectedId;
          return (
            <CircleMarker
              key={c.id}
              ref={(m) => {
                markerRefs.current[c.id] = m;
              }}
              center={[c.lat as number, c.lon as number]}
              radius={selected ? 10 : 6}
              pathOptions={{
                color: selected ? "#0b5b4b" : color,
                fillColor: color,
                fillOpacity: selected ? 1 : 0.7,
                weight: selected ? 3 : 1,
              }}
              eventHandlers={{ click: () => onSelect?.(c.id) }}
            >
              <Popup>
                <div className="text-[12px] leading-relaxed">
                  <div className="font-semibold">{c.address || "—"}</div>
                  <div>
                    {eur(c.price)} · {c.surface} m² ·{" "}
                    <strong>{int(c.pricePerM2)} €/m²</strong>
                  </div>
                  <div>
                    {c.type}
                    {c.rooms != null ? ` · ${c.rooms} pièces` : ""}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
