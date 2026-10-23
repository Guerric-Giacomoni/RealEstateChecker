"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { LatLngBoundsExpression } from "leaflet";
import type { DvfComp } from "@/lib/types";
import { pointInPolygon, type Ring } from "@/lib/geo";
import { eur, eurM2, int, monthYear } from "@/lib/format";
import { Card, CardTitle, Table, Td } from "@/components/ui";
import type { ColorMode } from "./ExplorerMap";

const ExplorerMap = dynamic(() => import("./ExplorerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-line text-[13px] text-muted">
      Chargement de la carte…
    </div>
  ),
});

/** A commune returned by geo.api.gouv.fr. */
type Commune = {
  nom: string;
  code: string;
  codesPostaux: string[];
  centre?: { coordinates: [number, number] };
  contour?: { type: string; coordinates: number[][][] };
};

/** median of a numeric array (0 when empty). */
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** GeoJSON polygon ([lon,lat]) → Leaflet bounds ([lat,lon] pairs). */
function contourToBounds(c: Commune["contour"]): LatLngBoundsExpression | null {
  if (!c?.coordinates?.length) return null;
  const pts: [number, number][] = [];
  for (const ringG of c.coordinates) for (const [lon, lat] of ringG) pts.push([lat, lon]);
  return pts.length ? pts : null;
}

/** Outer ring of a commune contour as a [lat,lon] ring (for the DVF query). */
function contourToRing(c: Commune["contour"]): Ring | null {
  const outer = c?.coordinates?.[0];
  if (!outer?.length) return null;
  return outer.map(([lon, lat]) => [lat, lon] as [number, number]);
}

export function ZoneExplorer() {
  // --- Form state ---
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Commune[]>([]);
  const [commune, setCommune] = useState<Commune | null>(null);
  const [budget, setBudget] = useState(300_000);
  const [roomsMin, setRoomsMin] = useState("");
  const [surfaceMin, setSurfaceMin] = useState("");
  const [surfaceMax, setSurfaceMax] = useState("");

  // --- Map / results state ---
  const [submitted, setSubmitted] = useState(false);
  const [drawnArea, setDrawnArea] = useState<Ring | null>(null);
  // All sold properties in the chosen city (fetched once on "Afficher la carte").
  const [cityComps, setCityComps] = useState<DvfComp[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("budget");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Debounced commune autocomplete. All setState happens inside async callbacks
  // (never synchronously in the effect body) to avoid cascading renders.
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 2 || commune?.nom === q) {
        setSuggestions([]);
        return;
      }
      try {
        const r = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}` +
            `&fields=nom,code,codesPostaux,centre,contour&boost=population&limit=6`,
          { signal: ctrl.signal },
        );
        setSuggestions(r.ok ? await r.json() : []);
      } catch {
        /* aborted or offline */
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, commune]);

  const cityCenter = useMemo<[number, number] | null>(() => {
    const c = commune?.centre?.coordinates;
    return c ? [c[1], c[0]] : null;
  }, [commune]);
  const cityBounds = useMemo(() => contourToBounds(commune?.contour), [commune]);

  // Displayed set: the whole city, narrowed to the drawn zone once one exists.
  const comps = useMemo(
    () =>
      drawnArea && drawnArea.length >= 3
        ? cityComps.filter(
            (c) => c.lat != null && c.lon != null && pointInPolygon(c.lat, c.lon, drawnArea),
          )
        : cityComps,
    [cityComps, drawnArea],
  );

  const perM2 = comps.map((c) => c.pricePerM2);
  const medianPerM2 = median(perM2);
  const avgPerM2 = perM2.length
    ? Math.round(perM2.reduce((s, v) => s + v, 0) / perM2.length)
    : 0;

  const pickCommune = (c: Commune) => {
    setCommune(c);
    setQuery(c.nom);
    setSuggestions([]);
  };

  // "Afficher la carte": load every sold property in the city at once. The zone
  // the user later draws just filters this set client-side (no extra request).
  const showMap = async () => {
    if (!commune) return;
    const ring = contourToRing(commune.contour);
    if (!ring) return;
    setSubmitted(true);
    setDrawnArea(null);
    setSelectedId(null);
    setLoading(true);
    setLoaded(false);
    try {
      const r = await fetch("/api/dvf/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: ring,
          roomsMin: roomsMin ? Number(roomsMin) : undefined,
          surfaceMin: surfaceMin ? Number(surfaceMin) : undefined,
          surfaceMax: surfaceMax ? Number(surfaceMax) : undefined,
        }),
      });
      const data = r.ok ? await r.json() : { comps: [] };
      setCityComps(Array.isArray(data.comps) ? data.comps : []);
    } catch {
      setCityComps([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const belowBudget = comps.filter((c) => c.price <= budget).length;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Explorer une zone</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Choisissez une ville, tracez un périmètre sur la carte, et voyez les biens
            réellement vendus à l&apos;intérieur (DVF 2025).
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← Accueil
        </Link>
      </div>

      {/* Form */}
      <Card>
        <CardTitle hint="Les filtres s'appliquent aux ventes trouvées dans la zone">
          Critères
        </CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Commune autocomplete */}
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-[12px] font-medium text-muted">Ville</span>
            <input
              type="text"
              value={query}
              placeholder="Bayeux, Paris 15e…"
              onChange={(e) => {
                setQuery(e.target.value);
                setCommune(null);
              }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.code}>
                    <button
                      onClick={() => pickCommune(c)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-slate-700 transition hover:bg-navy-50"
                    >
                      <span>{c.nom}</span>
                      <span className="text-[11px] text-faint">
                        {c.codesPostaux?.[0] ?? ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>

          <label>
            <span className="mb-1 block text-[12px] font-medium text-muted">Budget (€)</span>
            <input
              type="number"
              value={budget}
              min={0}
              step={10_000}
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
          </label>

          <label>
            <span className="mb-1 block text-[12px] font-medium text-muted">Pièces (min.)</span>
            <input
              type="number"
              value={roomsMin}
              min={0}
              placeholder="indifférent"
              onChange={(e) => setRoomsMin(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[12px] font-medium text-muted">m² min.</span>
              <input
                type="number"
                value={surfaceMin}
                min={0}
                placeholder="—"
                onChange={(e) => setSurfaceMin(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-[12px] font-medium text-muted">m² max.</span>
              <input
                type="number"
                value={surfaceMax}
                min={0}
                placeholder="—"
                onChange={(e) => setSurfaceMax(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={showMap}
            disabled={!commune || loading}
            className="rounded-lg bg-navy-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Afficher la carte"}
          </button>
          {!commune && (
            <span className="text-[12px] text-faint">Sélectionnez une ville dans la liste.</span>
          )}
        </div>
      </Card>

      {/* Map + draw + filter */}
      {submitted && commune && (
        <div className="mt-5">
          <Card>
            <CardTitle
              hint={
                drawnArea
                  ? "Filtré sur la zone tracée — effacez-la pour revoir toute la ville"
                  : "Tracez un polygone ou un rectangle pour filtrer (outils en haut à droite de la carte)"
              }
            >
              {commune.nom} {commune.codesPostaux?.[0] ? `(${commune.codesPostaux[0]})` : ""}
            </CardTitle>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {drawnArea && (
                <button
                  onClick={() => {
                    setDrawnArea(null);
                    setSelectedId(null);
                  }}
                  className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-[12.5px] font-medium text-navy-600 transition hover:bg-navy-50"
                >
                  Effacer la zone
                </button>
              )}

              {/* Colour mode */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] text-muted">Couleur :</span>
                {(
                  [
                    ["budget", "vs budget"],
                    ["market", "vs €/m² médian"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setColorMode(m)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                      colorMode === m
                        ? "bg-navy-600 text-white"
                        : "border border-navy-200 bg-white text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live stats — recompute as soon as a zone is drawn/cleared. */}
            <div className="mb-3 grid grid-cols-3 gap-3">
              {[
                { l: "Prix moyen /m²", v: avgPerM2 ? eurM2(avgPerM2) : "—" },
                { l: "Prix médian /m²", v: medianPerM2 ? eurM2(medianPerM2) : "—" },
                {
                  l: drawnArea ? "Biens dans la zone" : "Biens dans la ville",
                  v: int(comps.length),
                },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                  <div className="tnum mt-0.5 text-[15px] font-semibold text-ink">{s.v}</div>
                </div>
              ))}
            </div>

            <ExplorerMap
              comps={comps}
              drawnArea={drawnArea}
              onDraw={setDrawnArea}
              colorMode={colorMode}
              budget={budget}
              medianPerM2={medianPerM2}
              cityBounds={cityBounds}
              cityCenter={cityCenter}
              selectedId={selectedId}
              onSelect={setSelectedId}
              highlightId={hoverId}
            />
            <p className="mt-1.5 text-[11px] text-faint">
              {colorMode === "budget"
                ? "Vert : vendu ≤ votre budget · rouge : au-dessus."
                : "Vert : moins cher que le €/m² médian de la zone · rouge : plus cher."}
            </p>
          </Card>
        </div>
      )}

      {/* Results */}
      {loaded && (
        <div className="mt-5">
          <Card>
            <CardTitle
              hint={
                comps.length
                  ? `${comps.length} vente${comps.length > 1 ? "s" : ""} (DVF 2025) · ${belowBudget} ≤ budget · médian ${eurM2(medianPerM2)}`
                  : "Aucune vente"
              }
            >
              {drawnArea ? "Ventes dans la zone" : "Ventes dans la ville"}
            </CardTitle>

            {comps.length === 0 ? (
              <p className="text-[13px] text-muted">
                {drawnArea
                  ? "Aucune vente dans la zone tracée — agrandissez-la ou effacez-la."
                  : "Aucune vente enregistrée (DVF 2025) dans cette ville avec ces filtres — assouplissez les critères."}
              </p>
            ) : (
              <div className="max-h-[460px] overflow-y-auto">
                <Table
                  head={["Adresse", "Date", "Type", "Prix", "Surface", "€/m²", "Pièces"]}
                  align={["left", "left", "left", "right", "right", "right", "right"]}
                >
                  {comps.map((c) => (
                    <tr
                      key={c.id}
                      ref={c.id === selectedId ? selectedRowRef : undefined}
                      onMouseEnter={() => setHoverId(c.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer transition ${
                        c.id === selectedId ? "bg-navy-50" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <Td className="text-slate-600">{c.address || "—"}</Td>
                      <Td>{monthYear(c.soldOn)}</Td>
                      <Td>{c.type}</Td>
                      <Td right strong className={c.price <= budget ? "!text-pos" : "!text-bad"}>
                        {eur(c.price)}
                      </Td>
                      <Td right>{c.surface} m²</Td>
                      <Td right>{int(c.pricePerM2)} €</Td>
                      <Td right>{c.rooms ?? "—"}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
