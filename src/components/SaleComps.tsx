"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";
import { eur, eurM2, int, monthYear, pct } from "@/lib/format";
import { Badge, Card, CardTitle, Table, Td } from "./ui";
import { ScatterStrip } from "./charts";

const DvfMap = dynamic(() => import("./DvfMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-xl border border-line text-[13px] text-muted">
      Chargement de la carte…
    </div>
  ),
});

const RADII = [0.5, 1, 2, 5];

/**
 * Real DVF "Ventes comparables" card, shared by the Le bien and Marché tabs.
 * Stats are computed over every matching sale (whole postal code, or a radius
 * around the exact address). Includes a map with a pin per sale + the subject.
 */
export function SaleComps() {
  const { a, d, comps, saleComps, saleCompsLoading, set, property, radiusKm, setRadiusKm, setExactAddress } =
    useApp();
  const perM2 = saleComps.map((c) => c.pricePerM2);
  const suggested = Math.round(comps.salePerM2.median * a.surface);

  const [addr, setAddr] = useState(property.address || "");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle");
  const located = property.latitude != null && property.longitude != null;
  const showDist = radiusKm != null;

  const locate = async () => {
    if (!addr.trim()) return;
    setGeoStatus("loading");
    const r = await setExactAddress(addr.trim());
    setGeoStatus(r ? "idle" : "error");
    if (r && radiusKm == null) setRadiusKm(1); // switch to radius mode once located
  };

  const hasMap = located || saleComps.some((c) => c.lat != null);

  return (
    <Card>
      <CardTitle
        hint={
          saleComps.length
            ? `${saleComps.length} ventes réelles (DVF 2025) — ${
                radiusKm != null ? `rayon de ${radiusKm} km` : "même code postal"
              }`
            : "Ventes réelles enregistrées (DVF 2025)"
        }
        right={
          suggested > 0 ? (
            <button
              onClick={() => set("purchasePrice", suggested)}
              className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition hover:bg-navy-100"
            >
              Appliquer le prix suggéré ({eur(suggested)})
            </button>
          ) : undefined
        }
      >
        Ventes comparables
      </CardTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Prix médian /m²", v: eurM2(comps.salePerM2.median) },
          { l: "Prix moyen /m²", v: eurM2(comps.salePerM2.avg) },
          { l: "Ce bien /m²", v: eurM2(d.pricePerM2) },
          { l: "Fourchette", v: `${int(comps.salePerM2.min)} – ${int(comps.salePerM2.max)} €` },
        ].map((s) => (
          <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
            <div className="tnum mt-0.5 text-[15px] font-semibold text-ink">{s.v}</div>
          </div>
        ))}
      </div>

      <ScatterStrip
        values={perM2}
        subject={d.pricePerM2}
        median={comps.salePerM2.median}
        format={(v) => `${int(v)} €`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-50/60 px-4 py-3">
        <span className="text-[13px] font-medium text-slate-600">Ajuster le prix retenu</span>
        <input
          type="range"
          className="min-w-[200px] flex-1"
          min={Math.round(suggested * 0.6)}
          max={Math.round(suggested * 1.4)}
          step={1000}
          value={a.purchasePrice}
          onChange={(e) => set("purchasePrice", parseFloat(e.target.value))}
        />
        <span className="tnum text-[16px] font-semibold text-navy-700">{eur(a.purchasePrice)}</span>
        <Badge tone={Math.abs(comps.priceVsComps) < 5 ? "good" : comps.priceVsComps > 0 ? "warn" : "info"}>
          {comps.priceVsComps > 0 ? "+" : ""}
          {pct(comps.priceVsComps)} vs marché
        </Badge>
      </div>

      {/* Exact address + radius controls */}
      <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              Adresse exacte du bien (pour la carte)
            </span>
            <input
              type="text"
              value={addr}
              placeholder="12 rue de la Paix, 75002 Paris"
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && locate()}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
            />
          </label>
          <button
            onClick={locate}
            disabled={geoStatus === "loading" || !addr.trim()}
            className="rounded-lg bg-navy-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {geoStatus === "loading" ? "Localisation…" : "Localiser"}
          </button>
        </div>
        {geoStatus === "error" && (
          <p className="mt-2 text-[12px] text-bad">Adresse introuvable — précisez la rue et la ville.</p>
        )}
        {located && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-[12px] text-muted">Comparables :</span>
            {RADII.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                  radiusKm === r
                    ? "bg-navy-600 text-white"
                    : "border border-navy-200 bg-white text-navy-600 hover:bg-navy-50"
                }`}
              >
                {r} km
              </button>
            ))}
            <button
              onClick={() => setRadiusKm(null)}
              className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                radiusKm == null
                  ? "bg-navy-600 text-white"
                  : "border border-navy-200 bg-white text-navy-600 hover:bg-navy-50"
              }`}
            >
              Tout le code postal
            </button>
          </div>
        )}
      </div>

      {hasMap && (
        <div className="mb-4">
          <DvfMap
            comps={saleComps}
            subject={
              located
                ? { lat: property.latitude!, lon: property.longitude!, label: property.address }
                : null
            }
            subjectPricePerM2={d.pricePerM2}
          />
          <p className="mt-1.5 text-[11px] text-faint">
            Points verts : moins chers au m² que ce bien · rouges : plus chers · bleu : ce bien.
          </p>
        </div>
      )}

      {saleCompsLoading ? (
        <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
          Recherche des ventes récentes…
        </div>
      ) : saleComps.length === 0 ? (
        <p className="text-[13px] text-muted">
          Aucune vente enregistrée (DVF 2025) {radiusKm != null ? "dans ce rayon" : "dans ce code postal"}.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <Table
            head={
              showDist
                ? ["Adresse", "Date", "Prix", "Surface", "€/m²", "Pièces", "Distance"]
                : ["Adresse", "Date", "Prix", "Surface", "€/m²", "Pièces"]
            }
            align={
              showDist
                ? ["left", "left", "right", "right", "right", "right", "right"]
                : ["left", "left", "right", "right", "right", "right"]
            }
          >
            {saleComps.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50/70">
                <Td className="text-slate-600">{c.address || "—"}</Td>
                <Td>{monthYear(c.soldOn)}</Td>
                <Td right strong>{eur(c.price)}</Td>
                <Td right>{c.surface} m²</Td>
                <Td right className={c.pricePerM2 > d.pricePerM2 ? "!text-pos" : "!text-bad"}>
                  {int(c.pricePerM2)} €
                </Td>
                <Td right>{c.rooms ?? "—"}</Td>
                {showDist && <Td right>{c.distance != null ? `${c.distance.toFixed(1)} km` : "—"}</Td>}
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Card>
  );
}
