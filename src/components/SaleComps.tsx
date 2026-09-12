"use client";

import { useApp } from "@/lib/store";
import { eur, eurM2, int, monthYear, pct } from "@/lib/format";
import { Badge, Card, CardTitle, Table, Td } from "./ui";
import { ScatterStrip } from "./charts";

/**
 * Real DVF "Ventes comparables" card, shared by the Le bien and Marché tabs.
 * Mirrors the Loyers comparables card: a button to apply the market-suggested
 * price and a slider to adjust the retained purchase price.
 */
export function SaleComps() {
  const { a, d, comps, saleComps, saleCompsLoading, set } = useApp();
  const perM2 = saleComps.map((c) => c.pricePerM2);
  // Suggested price = median €/m² of comparable sales × this bien's surface.
  const suggested = Math.round(comps.salePerM2.median * a.surface);

  return (
    <Card>
      <CardTitle
        hint={
          saleComps.length
            ? `${saleComps.length} ventes réelles (DVF 2025) — même code postal`
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

      {saleCompsLoading ? (
        <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
          Recherche des ventes récentes…
        </div>
      ) : saleComps.length === 0 ? (
        <p className="text-[13px] text-muted">
          Aucune vente enregistrée (DVF 2025) dans ce code postal.
        </p>
      ) : (
        <Table
          head={["Adresse", "Date", "Prix", "Surface", "€/m²", "Pièces"]}
          align={["left", "left", "right", "right", "right", "right"]}
        >
          {saleComps.map((c) => (
            <tr key={c.id} className="transition hover:bg-slate-50/70">
              <Td className="text-slate-600">
                <span className="block max-w-[220px] truncate">{c.address || "—"}</span>
              </Td>
              <Td>{monthYear(c.soldOn)}</Td>
              <Td right strong>{eur(c.price)}</Td>
              <Td right>{c.surface} m²</Td>
              <Td right className={c.pricePerM2 > d.pricePerM2 ? "!text-pos" : "!text-bad"}>
                {int(c.pricePerM2)} €
              </Td>
              <Td right>{c.rooms ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
