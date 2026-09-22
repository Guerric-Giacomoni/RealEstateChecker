"use client";

import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";
import { eur, eurM2, int, num, pct } from "@/lib/format";
import { Badge, Bar, Card, CardTitle, Insight, Mock, MockBadge, Row, Table, Td, pctWidth } from "../ui";
import { BarChart, LineChart } from "../charts";
import { SaleComps } from "../SaleComps";

const mapLoader = () => (
  <div className="flex h-[320px] items-center justify-center rounded-xl border border-line text-[13px] text-muted">
    Chargement de la carte…
  </div>
);
const SchoolsMap = dynamic(() => import("../SchoolsMap"), { ssr: false, loading: mapLoader });
const HospitalsMap = dynamic(() => import("../HospitalsMap"), { ssr: false, loading: mapLoader });

export function TabMarche() {
  const { a, d, market, comps, property, priceHistory, marketStats, marketLoading, crime, crimeLoading, schools, schoolsLoading, hospitals, hospitalsLoading, risks, risksLoading } =
    useApp();

  const subjectPoint =
    property.latitude != null && property.longitude != null
      ? { lat: property.latitude, lon: property.longitude, label: property.address || undefined }
      : null;

  // Real INSEE figures when loaded, else the mock market.
  const pop = marketStats?.population;
  const inc = marketStats?.income;
  const un = marketStats?.unemployment;
  const hv = marketStats?.housing;
  const growthTone = (v?: number | null): "pos" | "neg" | undefined =>
    v == null ? undefined : v >= 0 ? "pos" : "neg";

  const clayLevel = risks?.clay.level ?? null;
  const clayTone: "good" | "warn" | "bad" = !clayLevel
    ? "good"
    : /fort/i.test(clayLevel)
      ? "bad"
      : /moyen/i.test(clayLevel)
        ? "warn"
        : "good";
  const seismicNum = risks?.seismic.level ? parseInt(risks.seismic.level, 10) : 0;
  const seismicTone: "good" | "warn" | "bad" = seismicNum >= 4 ? "bad" : seismicNum === 3 ? "warn" : "good";

  // Real yearly €/m² (DVF indicators) when available, else the mock series.
  const realPrice = priceHistory && priceHistory.series.length >= 2 ? priceHistory.series : null;
  const priceChart = realPrice
    ? realPrice.map((p) => ({ label: String(p.year), value: p.priceM2 }))
    : market.pricePerM2History.map((p) => ({ label: p.label, value: p.value }));
  const pv = priceChart.map((p) => p.value);
  const last = pv[pv.length - 1];
  const y1 = pv[pv.length - 2] ?? last;
  const y3 = pv[pv.length - 4] ?? pv[0];
  const y5 = pv[pv.length - 6] ?? pv[0];
  // 10-year lookback, or the oldest year we have when the series is shorter.
  const y10 = pv[pv.length - 11] ?? pv[0];
  // Transaction volume — real (latest year's recorded sales) when available.
  const txVolume = priceHistory?.latestVolume ?? null;

  const rentHist = market.rentPerM2History;
  const rentLast = rentHist[rentHist.length - 1].value;
  const rentY1 = rentHist[rentHist.length - 2].value;
  const rentY5 = rentHist[rentHist.length - 6].value;

  const vacancy = market.vacancyHistory[market.vacancyHistory.length - 1].value;

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
          <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { l: "Prix médian /m²", v: eurM2(comps.salePerM2.median), mock: false },
              {
                l: "Logements vacants",
                v: pct(hv?.vacancyRate ?? vacancy),
                mock: hv?.vacancyRate == null,
              },
              {
                l: "Transactions /an",
                v: int(txVolume ?? market.transactionVolume),
                mock: txVolume == null,
              },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-slate-50 px-3.5 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                <div className="tnum mt-0.5 text-[16px] font-semibold text-ink">
                  {s.mock ? <Mock>{s.v}</Mock> : s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------------- Marché immobilier ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle
            hint={
              realPrice
                ? `Prix moyen au m² — ${property.city} (DVF 2015–2024)`
                : `Prix moyen au m² — ${property.city}`
            }
            right={realPrice ? undefined : <MockBadge />}
          >
            Évolution des prix de vente
          </CardTitle>
          <LineChart
            data={priceChart}
            series={[{ key: "value", label: "Prix moyen €/m²", color: "#108971", area: true }]}
            yFormat={(v) => `${int(v)} €`}
            legend={false}
            height={220}
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "1 an", v: ((last - y1) / y1) * 100 },
              { l: "3 ans", v: ((last - y3) / y3) * 100 },
              { l: "5 ans", v: ((last - y5) / y5) * 100 },
              { l: "10 ans", v: ((last - y10) / y10) * 100 },
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
          <Row
            label="Volume de transactions"
            hint={txVolume != null ? "ventes en 2024" : "12 derniers mois"}
            value={
              txVolume != null ? int(txVolume) : <Mock>{int(market.transactionVolume)}</Mock>
            }
          />
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

      {/* ---------------- Ventes comparables (DVF, réel) ---------------- */}
      <SaleComps />

      {/* ---------------- Marché locatif ----------------
          Masqué pour l'instant : en attente d'un vrai indicateur de loyer au m².
          Remettre `true` pour réafficher (chart + Indicateurs locatifs). */}
      {false && (
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle hint="Loyer moyen au m² et taux de vacance du parc" right={<MockBadge />}>
            Marché locatif
          </CardTitle>
          <LineChart
            data={rentHist.map((p, i) => ({
              label: p.label,
              rent: p.value,
              vacancy: market.vacancyHistory[i]?.value ?? 0,
            }))}
            series={[
              { key: "rent", label: "Loyer €/m²", color: "#108971", area: true },
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
          <Row label="Évolution 1 an" value={<Mock>{pct(((rentLast - rentY1) / rentY1) * 100)}</Mock>} />
          <Row label="Évolution 5 ans" value={<Mock>{pct(((rentLast - rentY5) / rentY5) * 100)}</Mock>} />
          <Row label="Taux de vacance" value={<Mock>{pct(vacancy)}</Mock>} />
          <Row label="Annonces comparables" value={<Mock>{String(market.rentComps.length)}</Mock>} />
          <div className="mt-3 space-y-1.5 border-t border-line pt-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-muted">Tension locative</span>
              <MockBadge />
            </div>
            {market.rentalDemand.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted">{r.label}</span>
                <Badge tone={r.tone}>{r.value}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}

      {/* ---------------- Population & économie ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle hint={pop ? `Recensement INSEE — ${pop.year}` : "Recensement INSEE"}>
            Population {marketLoading && !pop ? "…" : ""}
          </CardTitle>
          <LineChart
            data={(pop?.history ?? market.populationHistory).map((p) => ({
              label: p.label,
              value: p.value,
            }))}
            series={[{ key: "value", label: "Habitants", color: "#15b796", area: true }]}
            yFormat={(v) => int(v)}
            legend={false}
            height={200}
          />
          {marketStats && marketStats.ageBands.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">
                Répartition par âge
              </div>
              <div className="space-y-1.5">
                {marketStats.ageBands.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-muted">{b.label} ans</span>
                      <span className="tnum text-[12px] font-semibold text-ink">{pct(b.share, 0)}</span>
                    </div>
                    <Bar value={b.share} max={40} tone="info" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle hint="INSEE Melodi (commune)">Économie locale</CardTitle>
          <Row label="Population" hint={pop ? String(pop.year) : undefined} value={int(pop?.latest ?? market.population)} />
          <Row
            label="Croissance 5 ans"
            value={pct(pop?.change5y ?? market.populationGrowth5y)}
            tone={growthTone(pop?.change5y ?? market.populationGrowth5y)}
          />
          {pop?.change10y != null && (
            <Row label="Croissance 10 ans" value={pct(pop.change10y)} tone={growthTone(pop.change10y)} />
          )}
          <Row
            label="Revenu médian"
            hint={inc?.year ? `niveau de vie ${inc.year}` : undefined}
            value={eur(inc?.median ?? market.medianIncome)}
            divider
          />
          {inc?.france != null ? (
            <Row
              label="Revenu médian — France"
              value={`${eur(inc.france)}${inc.vsFrancePct != null ? ` (${inc.vsFrancePct > 0 ? "+" : ""}${pct(inc.vsFrancePct)})` : ""}`}
              tone={growthTone(inc.vsFrancePct)}
            />
          ) : (
            <Row label="Revenu médian — département" value={<Mock>{eur(market.medianIncomeDept)}</Mock>} />
          )}
          <div className="mt-3 space-y-2.5 border-t border-line pt-3">
            {[
              { l: "Chômage (recensement)", v: un?.rate ?? market.unemployment, tone: "bad" as const },
              { l: "Logements vacants", v: hv?.vacancyRate ?? vacancy, tone: "warn" as const },
            ].map((s) => (
              <div key={s.l}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted">{s.l}</span>
                  <span className="tnum text-[12.5px] font-semibold text-ink">{pct(s.v)}</span>
                </div>
                <Bar value={s.v} max={15} tone={s.tone} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Chômage au sens du recensement (≠ taux BIT). « Logements vacants » = part du parc de
            logements — indicateur de tension locative, et non le taux de vacance de votre bien.
          </p>
        </Card>
      </div>

      {/* ---------------- Risques naturels ---------------- */}
      <Card>
        <CardTitle hint="Source : Géorisques — commune & environs (localisation approximative)">
          Risques naturels
        </CardTitle>

        {risksLoading ? (
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
            Analyse des risques…
          </div>
        ) : !risks ? (
          <p className="text-[13px] text-muted">Risques indisponibles pour cette localisation.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">Inondation</div>
                <div className="mt-1">
                  <Badge tone={risks.flood.communeRisk ? "bad" : "good"}>
                    {risks.flood.communeRisk ? "Présent" : "Non recensé"}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-faint">
                  {risks.flood.catnatCount > 0
                    ? `${risks.flood.catnatCount} arrêté${risks.flood.catnatCount > 1 ? "s" : ""} CatNat`
                    : risks.flood.atlasNearby
                      ? "zone connue à proximité"
                      : "aucun historique"}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">Argiles</div>
                <div className="mt-1">
                  <Badge tone={clayTone}>{clayLevel ?? "Faible ou nul"}</Badge>
                </div>
                <div className="mt-1 text-[11px] text-faint">retrait-gonflement</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-muted">Séisme</div>
                <div className="mt-1">
                  <Badge tone={seismicTone}>{risks.seismic.level ?? "—"}</Badge>
                </div>
                <div className="mt-1 text-[11px] text-faint">zonage sismique</div>
              </div>
            </div>

            {risks.catnat.events.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                  Arrêtés de catastrophe naturelle ({risks.catnat.total})
                </div>
                <div className="thin-scroll max-h-64 overflow-y-auto">
                  <Table head={["Période", "Type", "Publié"]} align={["left", "left", "left"]}>
                    {risks.catnat.events.map((e, i) => (
                      <tr key={`${e.start}-${i}`} className="transition hover:bg-slate-50/70">
                        <Td>{e.end && e.end !== e.start ? `${e.start} → ${e.end}` : e.start}</Td>
                        <Td>{e.label}</Td>
                        <Td>{e.published || "—"}</Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              {risks.reportUrl && (
                <a
                  href={risks.reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-[12.5px] font-semibold text-navy-600 transition hover:bg-navy-100"
                >
                  Télécharger le rapport officiel Géorisques ↗
                </a>
              )}
              <span className="text-[11px] leading-relaxed text-faint">
                Risques à l&apos;échelle de la commune / à proximité — ne remplace pas l&apos;état
                des risques (ERP) à l&apos;adresse exacte.
              </span>
            </div>
          </>
        )}
      </Card>

      {/* ---------------- Criminalité (SSMSI) ---------------- */}
      {crimeLoading ? (
        <Card>
          <CardTitle hint="Faits pour 1 000 habitants — SSMSI">Sécurité</CardTitle>
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
            Chargement des données de délinquance…
          </div>
        </Card>
      ) : !crime ? (
        <Card>
          <CardTitle hint="Faits pour 1 000 habitants — SSMSI">Sécurité</CardTitle>
          <p className="text-[13px] text-muted">
            Données de délinquance non disponibles pour cette commune.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
          <Card>
            <CardTitle hint={`Faits pour 1 000 hab. — indice global (${crime.year})`}>
              Sécurité
            </CardTitle>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Commune", v: crime.index.commune },
                { l: "Département", v: crime.index.dept },
                { l: "France", v: crime.index.france },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                  <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
                  <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">{num(s.v, 1)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <LineChart
                data={crime.history.map((p) => ({ label: p.label, value: p.value }))}
                series={[{ key: "value", label: "Indice", color: "#be123c" }]}
                yFormat={(v) => num(v, 0)}
                legend={false}
                height={160}
              />
            </div>
            {crime.index.france > 0 &&
              (() => {
                const diff = (crime.index.commune / crime.index.france - 1) * 100;
                return (
                  <Insight tone={diff > 10 ? "warn" : "good"}>
                    L&apos;indice communal est{" "}
                    <strong>
                      {diff >= 0 ? "supérieur de " : "inférieur de "}
                      {pct(Math.abs(diff), 0)}
                    </strong>{" "}
                    à la moyenne nationale ({num(crime.index.france, 1)} faits/1 000 hab.).
                  </Insight>
                );
              })()}
          </Card>

          <Card>
            <CardTitle hint="Pour 1 000 habitants — commune vs département">
              Détail par catégorie
            </CardTitle>
            <BarChart
              data={crime.categories.map((c) => ({
                label: c.label.length > 12 ? c.label.slice(0, 11) + "…" : c.label,
                commune: c.value,
                dept: c.dept,
              }))}
              series={[
                { key: "commune", label: "Commune", color: "#108971" },
                { key: "dept", label: "Département", color: "#76efd7" },
              ]}
              yFormat={(v) => num(v, 1)}
              height={210}
            />
            <div className="mt-4">
              <Table
                head={["Catégorie", "Commune", "Dépt", "France", "Tendance 1 an"]}
                align={["left", "right", "right", "right", "right"]}
              >
                {crime.categories.map((c) => (
                  <tr key={c.label} className="transition hover:bg-slate-50/70">
                    <Td strong>{c.label}</Td>
                    <Td right>{num(c.value, 1)}</Td>
                    <Td right>{num(c.dept, 1)}</Td>
                    <Td right className="text-muted">{num(c.france, 1)}</Td>
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
      )}

      {/* ---------------- Lycées (Éducation nationale) ---------------- */}
      <Card>
        <CardTitle hint="Résultats du bac (général & technologique) — Éducation nationale">
          Lycées de la commune
        </CardTitle>

        {schoolsLoading ? (
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
            Chargement des résultats du bac…
          </div>
        ) : schools.length === 0 ? (
          <p className="text-[13px] text-muted">
            Aucun lycée général ou technologique enregistré dans cette commune.
          </p>
        ) : (
          <>
            {schools.some((s) => s.lat != null) && (
              <div className="mb-4">
                <SchoolsMap
                  schools={schools}
                  subject={
                    property.latitude != null && property.longitude != null
                      ? {
                          lat: property.latitude,
                          lon: property.longitude,
                          label: property.address || undefined,
                        }
                      : null
                  }
                />
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: "#2563eb" }} /> Public
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: "#7c3aed" }} /> Privé
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: "#15b796" }} /> Ce bien
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {schools.map((s) => {
                const pub = /public/i.test(s.sector);
                return (
                  <div key={s.uai} className="rounded-xl border border-line px-5 py-4">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0">
                        <div className="text-[16px] font-semibold text-ink">{s.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone={pub ? "info" : "neutral"}>{pub ? "PUBLIC" : "PRIVÉ"}</Badge>
                          <span className="text-[12px] text-muted">Lycée GT</span>
                          {s.mentionRate != null && (
                            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                              {s.mentionRate} % mentions
                            </span>
                          )}
                        </div>
                        {s.address && (
                          <div className="mt-2 text-[12px] text-muted">📍 {s.address}</div>
                        )}
                        <div className="mt-1 text-[11.5px] text-faint">
                          {s.candidates ?? "—"} candidats · valeur ajoutée{" "}
                          <span
                            className={
                              s.addedValue == null
                                ? ""
                                : s.addedValue > 0
                                  ? "text-pos"
                                  : s.addedValue < 0
                                    ? "text-bad"
                                    : ""
                            }
                          >
                            {s.addedValue == null
                              ? "—"
                              : `${s.addedValue > 0 ? "+" : ""}${s.addedValue}`}
                          </span>{" "}
                          · session {s.year}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tnum text-[28px] font-bold leading-none text-ink">
                          {s.passRate != null ? `${s.passRate} %` : "—"}
                        </div>
                        <div className="mt-2 h-2 w-[180px] max-w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-pos"
                            style={{ width: `${pctWidth(s.passRate ?? 0, 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[10.5px] uppercase tracking-wide text-faint">
                          Réussite bac
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Réussite = taux d&apos;obtention du bac. Valeur ajoutée = écart à la réussite attendue
              compte tenu du profil des élèves (positif = le lycée fait mieux qu&apos;attendu).
            </p>
          </>
        )}
      </Card>

      {/* ---------------- Hôpitaux (FINESS) ---------------- */}
      <Card>
        <CardTitle hint="Établissements de santé dans un rayon de 15 km — FINESS">
          Hôpitaux &amp; cliniques à proximité
        </CardTitle>

        {hospitalsLoading ? (
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
            Recherche des établissements de santé…
          </div>
        ) : hospitals.length === 0 ? (
          <p className="text-[13px] text-muted">
            Aucun hôpital ou clinique recensé dans un rayon de 15 km.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <HospitalsMap hospitals={hospitals} subject={subjectPoint} />
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} /> Hôpital
                  / clinique
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#15b796" }} /> Ce bien
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {hospitals.slice(0, 12).map((h) => (
                <div
                  key={h.finess}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{h.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px]">
                      <span className="rounded-full bg-bad-soft px-2 py-0.5 font-medium text-bad">
                        {h.category}
                      </span>
                      {h.city && <span className="text-muted">{h.city}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tnum text-[15px] font-semibold text-navy-700">
                      {h.distance.toFixed(1)} km
                    </div>
                    <div className="text-[10.5px] uppercase tracking-wide text-faint">distance</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Source FINESS (établissements sanitaires). Distance à vol d&apos;oiseau depuis le bien.
            </p>
          </>
        )}
      </Card>

      {/* ---------------- Commodités ----------------
          Masqué — données d'exemple. Remettre `true` pour réafficher. */}
      {false && (
        <Card>
          <CardTitle hint="Nombre d'établissements autour du bien" right={<MockBadge />}>
            Commodités à proximité
          </CardTitle>
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
      )}
    </div>
  );
}
