"use client";

import { useApp } from "@/lib/store";
import { dist, eur, eurM2, int, monthYear, num, pct } from "@/lib/format";
import { Badge, Bar, Card, CardTitle, Insight, Row, Table, Td } from "../ui";
import { BarChart, LineChart } from "../charts";

export function TabMarche() {
  const { a, d, market, comps, property } = useApp();

  const hist = market.pricePerM2History;
  const last = hist[hist.length - 1].value;
  const y1 = hist[hist.length - 2].value;
  const y3 = hist[hist.length - 4].value;
  const y5 = hist[hist.length - 6].value;

  const rentHist = market.rentPerM2History;
  const rentLast = rentHist[rentHist.length - 1].value;
  const rentY1 = rentHist[rentHist.length - 2].value;
  const rentY5 = rentHist[rentHist.length - 6].value;

  const vacancy = market.vacancyHistory[market.vacancyHistory.length - 1].value;
  const byDate = [...market.saleComps].sort((x, y) => (x.date < y.date ? 1 : -1));

  return (
    <div className="space-y-4">
      {/* ---------------- Bandeau localisation ---------------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Localisation
            </div>
            <div className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
              {property.city}{" "}
              <span className="text-[15px] font-normal text-muted">({property.postalCode})</span>
            </div>
            <div className="text-[13px] text-muted">{property.address}</div>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Prix médian /m²", v: eurM2(comps.salePerM2.median) },
              { l: "Loyer moyen /m²", v: `${num(rentLast)} €` },
              { l: "Vacance", v: pct(vacancy) },
              { l: "Transactions /an", v: int(market.transactionVolume) },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-slate-50 px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                <div className="tnum mt-0.5 text-[16px] font-semibold text-ink">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------------- Marché immobilier ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle hint={`Prix moyen au m² — ${property.city}`}>
            Évolution des prix de vente
          </CardTitle>
          <LineChart
            data={hist.map((p) => ({ label: p.label, value: p.value }))}
            series={[{ key: "value", label: "Prix moyen €/m²", color: "#1d4477", area: true }]}
            yFormat={(v) => `${int(v)} €`}
            legend={false}
            height={220}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { l: "1 an", v: ((last - y1) / y1) * 100 },
              { l: "3 ans", v: ((last - y3) / y3) * 100 },
              { l: "5 ans", v: ((last - y5) / y5) * 100 },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                <div
                  className={`tnum mt-0.5 text-[17px] font-semibold ${s.v >= 0 ? "text-pos" : "text-bad"}`}
                >
                  {s.v > 0 ? "+" : ""}
                  {pct(s.v)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle hint="Positionnement de ce bien">Statistiques de prix</CardTitle>
          <Row label="Prix médian du secteur" value={eurM2(comps.salePerM2.median)} />
          <Row label="Prix moyen du secteur" value={eurM2(comps.salePerM2.avg)} />
          <Row label="Prix le plus bas" value={eurM2(comps.salePerM2.min)} />
          <Row label="Prix le plus haut" value={eurM2(comps.salePerM2.max)} />
          <Row label="Ce bien" value={eurM2(d.pricePerM2)} strong divider />
          <Row
            label="Écart au marché"
            value={`${comps.priceVsComps > 0 ? "+" : ""}${pct(comps.priceVsComps)}`}
            tone={comps.priceVsComps > 0 ? "neg" : "pos"}
            strong
          />
          <Row label="Volume de transactions" hint="12 derniers mois" value={int(market.transactionVolume)} />
          <div className="mt-3">
            <Insight tone={comps.priceVsComps > 5 ? "warn" : "good"}>
              À la médiane du secteur, ce bien de {a.surface} m² vaudrait{" "}
              <strong>{eur(comps.salePerM2.median * a.surface)}</strong>, soit{" "}
              <strong>{eur(Math.abs(a.purchasePrice - comps.salePerM2.median * a.surface))}</strong>{" "}
              {a.purchasePrice > comps.salePerM2.median * a.surface ? "de plus" : "de moins"} que
              le prix affiché.
            </Insight>
          </div>
        </Card>
      </div>

      {/* ---------------- Ventes comparables ---------------- */}
      <Card>
        <CardTitle hint="Base DVF — mutations à titre onéreux, rayon 600 m">
          Ventes comparables récentes
        </CardTitle>
        <Table
          head={["Date", "Prix", "Surface", "€/m²", "Pièces", "DPE", "Distance", "vs ce bien"]}
          align={["left", "right", "right", "right", "right", "left", "right", "right"]}
        >
          {byDate.map((c) => {
            const ppm = c.price / c.surface;
            const delta = (ppm / d.pricePerM2 - 1) * 100;
            return (
              <tr key={c.id} className="transition hover:bg-slate-50/70">
                <Td>{monthYear(c.date)}</Td>
                <Td right strong>{eur(c.price)}</Td>
                <Td right>{c.surface} m²</Td>
                <Td right>{int(ppm)} €</Td>
                <Td right>{c.rooms}</Td>
                <Td>{c.dpe ? <Badge tone="neutral">{c.dpe}</Badge> : <span className="text-faint">—</span>}</Td>
                <Td right>{dist(c.distance)}</Td>
                <Td right className={delta >= 0 ? "!text-pos" : "!text-bad"}>
                  {delta > 0 ? "+" : ""}
                  {pct(delta)}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* ---------------- Marché locatif ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle hint="Loyer moyen au m² et taux de vacance du parc">
            Marché locatif
          </CardTitle>
          <LineChart
            data={rentHist.map((p, i) => ({
              label: p.label,
              rent: p.value,
              vacancy: market.vacancyHistory[i]?.value ?? 0,
            }))}
            series={[
              { key: "rent", label: "Loyer €/m²", color: "#1d4477", area: true },
              { key: "vacancy", label: "Vacance %", color: "#b45309", dashed: true },
            ]}
            yFormat={(v) => num(v, 1)}
            height={220}
          />
        </Card>

        <Card>
          <CardTitle hint="Ce que disent les annonces">Indicateurs locatifs</CardTitle>
          <Row label="Loyer moyen /m²" value={`${num(comps.rentPerM2.avg)} €`} />
          <Row label="Loyer médian /m²" value={`${num(comps.rentPerM2.median)} €`} />
          <Row label="Évolution 1 an" value={pct(((rentLast - rentY1) / rentY1) * 100)} tone="pos" />
          <Row label="Évolution 5 ans" value={pct(((rentLast - rentY5) / rentY5) * 100)} tone="pos" />
          <Row label="Taux de vacance" value={pct(vacancy)} tone={vacancy > 8 ? "neg" : undefined} />
          <Row label="Annonces comparables" value={String(market.rentComps.length)} />
          <div className="mt-3 space-y-1.5 border-t border-line pt-3">
            {market.rentalDemand.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted">{r.label}</span>
                <Badge tone={r.tone}>{r.value}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- Population & économie ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle hint="Recensement INSEE">Population</CardTitle>
          <LineChart
            data={market.populationHistory.map((p) => ({ label: p.label, value: p.value }))}
            series={[{ key: "value", label: "Habitants", color: "#3765a5", area: true }]}
            yFormat={(v) => int(v)}
            legend={false}
            height={200}
          />
        </Card>

        <Card>
          <CardTitle hint="Commune vs département vs France">Économie locale</CardTitle>
          <Row label="Population" value={int(market.population)} />
          <Row label="Croissance 5 ans" value={pct(market.populationGrowth5y)} tone="pos" />
          <Row label="Ménages" value={int(market.households)} />
          <Row label="Croissance des ménages" value={pct(market.householdGrowth)} tone="pos" />
          <Row label="Part de locataires" value={pct(market.tenantShare, 0)} />
          <Row label="Revenu médian" value={eur(market.medianIncome)} divider />
          <Row label="Revenu médian — département" value={eur(market.medianIncomeDept)} />
          <div className="mt-3 space-y-2.5 border-t border-line pt-3">
            {[
              { l: "Chômage — commune", v: market.unemployment, tone: "bad" as const },
              { l: "Chômage — département", v: market.unemploymentDept, tone: "warn" as const },
              { l: "Chômage — France", v: market.unemploymentFrance, tone: "info" as const },
            ].map((s) => (
              <div key={s.l}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted">{s.l}</span>
                  <span className="tnum text-[12.5px] font-semibold text-ink">{pct(s.v)}</span>
                </div>
                <Bar value={s.v} max={12} tone={s.tone} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- Criminalité ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <Card>
          <CardTitle hint="Faits pour 1 000 habitants — indice global">Sécurité</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Commune", v: market.crime.index, tone: "bad" },
              { l: "Département", v: market.crime.dept, tone: "warn" },
              { l: "France", v: market.crime.france, tone: "info" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <LineChart
              data={market.crime.history.map((p) => ({ label: p.label, value: p.value }))}
              series={[{ key: "value", label: "Indice", color: "#be123c" }]}
              yFormat={(v) => String(Math.round(v))}
              legend={false}
              height={160}
            />
          </div>
          <Insight tone="warn">
            L&apos;indice communal est supérieur de{" "}
            <strong>{pct(((market.crime.index - market.crime.france) / market.crime.france) * 100, 0)}</strong>{" "}
            à la moyenne nationale, ce qui est courant pour une ville-centre de cette taille.
          </Insight>
        </Card>

        <Card>
          <CardTitle hint="Pour 1 000 habitants — commune vs département">
            Détail par catégorie
          </CardTitle>
          <BarChart
            data={market.crime.categories.map((c) => ({
              label: c.label.length > 12 ? c.label.slice(0, 11) + "…" : c.label,
              commune: c.value,
              dept: c.dept,
            }))}
            series={[
              { key: "commune", label: "Commune", color: "#1d4477" },
              { key: "dept", label: "Département", color: "#8daed9" },
            ]}
            yFormat={(v) => num(v, 1)}
            height={210}
          />
          <div className="mt-4">
            <Table head={["Catégorie", "Commune", "Département", "Tendance 1 an"]} align={["left", "right", "right", "right"]}>
              {market.crime.categories.map((c) => (
                <tr key={c.label} className="transition hover:bg-slate-50/70">
                  <Td strong>{c.label}</Td>
                  <Td right>{num(c.value, 1)}</Td>
                  <Td right>{num(c.dept, 1)}</Td>
                  <Td right className={c.trend <= 0 ? "!text-pos" : "!text-bad"}>
                    {c.trend > 0 ? "+" : ""}
                    {pct(c.trend)}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>

      {/* ---------------- Commodités ---------------- */}
      <Card>
        <CardTitle hint="Nombre d'établissements autour du bien">Commodités à proximité</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {market.amenities.map((am) => (
            <div key={am.label} className="rounded-xl border border-line px-3 py-3 text-center">
              <div className="text-[20px] leading-none">{am.icon}</div>
              <div className="tnum mt-2 text-[22px] font-semibold text-navy-700">
                {am.within500}
              </div>
              <div className="text-[11.5px] text-muted">{am.label}</div>
              <div className="mt-1 text-[10.5px] text-faint">{am.within1000} à 1 km</div>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-faint">
          Comptages dans un rayon de 500 m à pied. Un secteur dense en commerces et en écoles
          soutient la demande locative et limite la vacance.
        </p>
      </Card>
    </div>
  );
}
