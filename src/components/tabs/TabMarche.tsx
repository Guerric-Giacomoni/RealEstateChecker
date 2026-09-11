"use client";

import { useApp } from "@/lib/store";
import { eur, eurM2, int, monthYear, num, pct } from "@/lib/format";
import { Badge, Bar, Card, CardTitle, Insight, Mock, MockBadge, Row, Table, Td } from "../ui";
import { BarChart, LineChart, ScatterStrip } from "../charts";

export function TabMarche() {
  const { a, d, market, comps, property, saleComps, saleCompsLoading, marketStats, marketLoading, crime, crimeLoading, risks, risksLoading } =
    useApp();

  const perM2 = saleComps.map((c) => c.pricePerM2);

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
              { l: "Prix médian /m²", v: eurM2(comps.salePerM2.median), mock: false },
              { l: "Loyer moyen /m²", v: `${num(rentLast)} €`, mock: true },
              { l: "Vacance", v: pct(vacancy), mock: true },
              { l: "Transactions /an", v: int(market.transactionVolume), mock: true },
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
          <CardTitle hint={`Prix moyen au m² — ${property.city}`} right={<MockBadge />}>
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
          <Row label="Volume de transactions" hint="12 derniers mois" value={<Mock>{int(market.transactionVolume)}</Mock>} />
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
      <Card>
        <CardTitle
          hint={
            saleComps.length
              ? `${saleComps.length} ventes réelles (DVF 2025) — même code postal`
              : "Ventes réelles enregistrées (DVF 2025)"
          }
          right={
            <Badge tone={comps.priceVsComps > 3 ? "bad" : comps.priceVsComps < -3 ? "good" : "warn"}>
              {comps.priceVsComps > 0 ? "+" : ""}
              {pct(comps.priceVsComps)} vs marché
            </Badge>
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

        <div className="mb-4">
          <Insight tone={comps.priceVsComps > 3 ? "warn" : "good"}>
            Le prix affiché est{" "}
            <strong>
              {comps.priceVsComps > 0 ? "supérieur de " : "inférieur de "}
              {pct(Math.abs(comps.priceVsComps))}
            </strong>{" "}
            au prix médian des ventes comparables. À la médiane du secteur, le bien se
            négocierait autour de{" "}
            <strong>{eur(comps.salePerM2.median * a.surface)}</strong>.
          </Insight>
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

      {/* ---------------- Marché locatif ---------------- */}
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
            series={[{ key: "value", label: "Habitants", color: "#3765a5", area: true }]}
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
          <Row label="Ménages" value={<Mock>{int(market.households)}</Mock>} />
          <Row label="Croissance des ménages" value={<Mock>{pct(market.householdGrowth)}</Mock>} />
          <Row label="Part de locataires" value={<Mock>{pct(market.tenantShare, 0)}</Mock>} />
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
                { key: "commune", label: "Commune", color: "#1d4477" },
                { key: "dept", label: "Département", color: "#8daed9" },
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

      {/* ---------------- Commodités ---------------- */}
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
    </div>
  );
}
