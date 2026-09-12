"use client";

import { useApp } from "@/lib/store";
import { stats } from "@/lib/finance";
import { eur, eurM2, eurMonth, int, pct, num } from "@/lib/format";
import { Badge, Card, CardTitle, DpeBadge, Insight, Row, Table, Td, pctWidth } from "../ui";
import { ScatterStrip } from "../charts";
import { SaleComps } from "../SaleComps";

export function TabBien() {
  const { a, d, set, property, comparables, comparablesLoading } = useApp();

  // Stats for the currently-listed comparables (SeLoger "Ventes en cours").
  const listValues = comparables.map((c) => c.pricePerM2).filter((v) => v > 0);
  const listPerM2 = stats(listValues);
  const listVsMarket =
    listPerM2.median > 0 ? (d.pricePerM2 / listPerM2.median - 1) * 100 : 0;
  // Suggested price = median listing €/m² × this bien's surface.
  const suggestedList = Math.round(listPerM2.median * a.surface);

  return (
    <div className="space-y-4">
      {/* ---------------- Récapitulatif ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardTitle right={<Badge tone="info">{property.type}</Badge>}>
            Récapitulatif du bien
          </CardTitle>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <Row label="Prix affiché" value={eur(a.purchasePrice)} strong />
              <Row label="Surface" value={`${a.surface} m²`} />
              <Row label="Prix au m²" value={eurM2(d.pricePerM2)} />
              <Row label="Pièces" value={String(property.rooms)} />
              <Row label="Chambres" value={String(property.bedrooms)} />
            </div>
            <div>
              <Row label="Type" value={property.type} />
              <Row label="DPE" value={<DpeBadge value={property.dpe} />} />
              <Row label="GES" value={<Badge tone="info">{property.ges}</Badge>} />
              <Row label="Étage" value={property.floor.split("—")[0].trim()} />
              <Row label="Année de construction" value={property.year} />
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed text-slate-600">
            {property.description}
          </p>
        </Card>

        {/* ---------------- Coût d'acquisition ---------------- */}
        <Card>
          <CardTitle hint="Tout ce qu'il faut sortir pour être propriétaire">
            Coût total de l&apos;opération
          </CardTitle>
          <Row label="Prix du bien" value={eur(a.purchasePrice)} />
          <Row label="Frais de notaire" hint={`${num(a.notaryRatePct, 1)} %`} value={eur(d.notaryFees)} />
          <Row label="Frais d'agence" value={eur(a.agencyFees)} />
          <Row label="Travaux" value={eur(d.renovation)} />
          <Row label="Coût total du projet" value={eur(d.totalProject)} strong divider />
          <Row label="Coût de revient au m²" value={eurM2(d.allInPerM2)} />

          <div className="mt-4 flex overflow-hidden rounded-lg">
            {[
              { label: "Prix", v: a.purchasePrice, c: "bg-navy-700" },
              { label: "Notaire", v: d.notaryFees, c: "bg-navy-500" },
              { label: "Agence", v: a.agencyFees, c: "bg-navy-400" },
              { label: "Travaux", v: d.renovation, c: "bg-navy-200" },
            ].map((s) => (
              <div
                key={s.label}
                className={`${s.c} h-2`}
                style={{ width: `${pctWidth(s.v, d.totalProject)}%` }}
                title={s.label}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            {[
              { label: "Prix", v: a.purchasePrice, c: "bg-navy-700" },
              { label: "Notaire", v: d.notaryFees, c: "bg-navy-500" },
              { label: "Agence", v: a.agencyFees, c: "bg-navy-400" },
              { label: "Travaux", v: d.renovation, c: "bg-navy-200" },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-[2px] ${s.c}`} />
                {s.label} {pct((s.v / d.totalProject) * 100, 0)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- Travaux + financement ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Budget travaux</CardTitle>
          <Row label="Montant des travaux" hint="tous corps d'état" value={eur(d.renovation)} strong />
          <Row label="Coût des travaux au m²" value={eurM2(d.renovationPerM2)} />
          <Row label="Part du coût total" value={pct((d.renovation / d.totalProject) * 100)} />
          <Row label="Prix + frais d'acquisition" value={eur(d.acquisitionCost)} divider />
          <Row label="Coût total du projet" value={eur(d.totalProject)} strong />
          <div className="mt-3">
            {d.renovation > 0 ? (
              <Insight tone={d.renovationPerM2 > 400 ? "warn" : "info"}>
                À {eurM2(d.renovationPerM2)}, le budget travaux correspond à une rénovation{" "}
                {d.renovationPerM2 > 700
                  ? "lourde"
                  : d.renovationPerM2 > 350
                    ? "intermédiaire"
                    : "légère"}
                . Un passage de DPE {property.dpe} à D est généralement atteignable dans cette
                enveloppe.
              </Insight>
            ) : (
              <Insight tone="warn">
                Aucun budget travaux n&apos;est prévu. Avec un DPE {property.dpe}, une rénovation
                énergétique reste à anticiper : elle conditionne la valeur de revente et, pour un
                bien loué, la conformité aux seuils de décence.
              </Insight>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle hint="Modifiable dans le panneau d'hypothèses">Financement</CardTitle>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <Row label="Apport" value={eur(d.downPaymentEffective)} />
              <Row label="Montant emprunté" value={eur(d.loanAmount)} />
              <Row label="Taux d'intérêt" value={pct(a.interestRate, 2)} />
              <Row label="Durée" value={`${a.loanYears} ans`} />
            </div>
            <div>
              <Row label="Assurance emprunteur" value={pct(a.insuranceRate, 2)} />
              <Row label="Travaux financés" value={a.financeRenovation ? "Oui" : "Non"} />
              <Row label="Intérêts totaux" value={eur(d.totalInterest)} />
              <Row label="Assurance totale" value={eur(d.totalInsurance)} />
            </div>
          </div>
          <Row label="Mensualité" value={eurMonth(d.monthlyPayment)} strong divider />
          <Row label="Coût total du crédit" value={eur(d.totalCreditCost)} strong />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { l: "Capital", v: d.loanAmount },
              { l: "Intérêts", v: d.totalInterest },
              { l: "Assurance", v: d.totalInsurance },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                <div className="text-[10.5px] text-muted">{s.l}</div>
                <div className="tnum text-[13px] font-semibold text-ink">{eur(s.v)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- Comparables de vente ---------------- */}
      <SaleComps />

      {/* ---------------- Ventes en cours ---------------- */}
      <Card>
        <CardTitle
          hint={
            comparables.length
              ? `${comparables.length} annonces en vente (SeLoger) — €/m²`
              : "Annonces comparables actuellement en vente (SeLoger)"
          }
          right={
            comparables.length && suggestedList > 0 ? (
              <button
                onClick={() => set("purchasePrice", suggestedList)}
                className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition hover:bg-navy-100"
              >
                Appliquer le prix suggéré ({eur(suggestedList)})
              </button>
            ) : undefined
          }
        >
          Ventes en cours
        </CardTitle>

        {comparablesLoading ? (
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
            Recherche des annonces comparables en cours…
          </div>
        ) : comparables.length === 0 ? (
          <p className="text-[13px] text-muted">
            Aucune annonce comparable actuellement en vente pour ce bien.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: "Prix médian /m²", v: eurM2(listPerM2.median) },
                { l: "Prix moyen /m²", v: eurM2(listPerM2.avg) },
                { l: "Ce bien /m²", v: eurM2(d.pricePerM2) },
                { l: "Fourchette", v: `${int(listPerM2.min)} – ${int(listPerM2.max)} €` },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                  <div className="tnum mt-0.5 text-[15px] font-semibold text-ink">{s.v}</div>
                </div>
              ))}
            </div>

            <ScatterStrip
              values={listValues}
              subject={d.pricePerM2}
              median={listPerM2.median}
              format={(v) => `${int(v)} €`}
            />

            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-50/60 px-4 py-3">
              <span className="text-[13px] font-medium text-slate-600">Ajuster le prix retenu</span>
              <input
                type="range"
                className="min-w-[200px] flex-1"
                min={Math.round(suggestedList * 0.6)}
                max={Math.round(suggestedList * 1.4)}
                step={1000}
                value={a.purchasePrice}
                onChange={(e) => set("purchasePrice", parseFloat(e.target.value))}
              />
              <span className="tnum text-[16px] font-semibold text-navy-700">{eur(a.purchasePrice)}</span>
              <Badge tone={Math.abs(listVsMarket) < 5 ? "good" : listVsMarket > 0 ? "warn" : "info"}>
                {listVsMarket > 0 ? "+" : ""}
                {pct(listVsMarket)} vs annonces
              </Badge>
            </div>

          <Table
            head={["Adresse", "Prix", "Surface", "€/m²", "DPE", ""]}
            align={["left", "right", "right", "right", "left", "right"]}
          >
            {comparables.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50/70">
                <Td className="text-slate-600">
                  <span className="block max-w-[220px] truncate">{c.address || "—"}</span>
                </Td>
                <Td right strong>{eur(c.price)}</Td>
                <Td right>{c.surface} m²</Td>
                <Td right className={c.pricePerM2 > d.pricePerM2 ? "!text-pos" : "!text-bad"}>
                  {int(c.pricePerM2)} €
                </Td>
                <Td><DpeBadge value={c.dpe} /></Td>
                <Td right>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-navy-600 hover:underline"
                  >
                    Voir ↗
                  </a>
                </Td>
              </tr>
            ))}
          </Table>
          </>
        )}
      </Card>

    </div>
  );
}
