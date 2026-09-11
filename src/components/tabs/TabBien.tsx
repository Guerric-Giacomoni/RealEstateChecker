"use client";

import { useApp } from "@/lib/store";
import { eur, eurM2, eurMonth, int, monthYear, pct, num } from "@/lib/format";
import { Badge, Card, CardTitle, DpeBadge, Insight, Row, Table, Td, pctWidth } from "../ui";
import { ScatterStrip } from "../charts";

export function TabBien() {
  const {
    a, d, property, comps, comparables, comparablesLoading, saleComps, saleCompsLoading,
    risks, risksLoading,
  } = useApp();

  const perM2 = saleComps.map((c) => c.pricePerM2);

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
              <Row label="DPE" value={<Badge tone={property.dpe <= "D" ? "good" : "warn"}>{property.dpe}</Badge>} />
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
              <Row label="Apport" value={eur(a.downPayment)} />
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

            {risks.catnat.total > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
                  Arrêtés de catastrophe naturelle ({risks.catnat.total})
                </div>
                {risks.catnat.byType.map((t) => (
                  <Row key={t.label} label={t.label} value={String(t.count)} />
                ))}
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

      {/* ---------------- Comparables de vente ---------------- */}
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

      {/* ---------------- Ventes en cours ---------------- */}
      <Card>
        <CardTitle hint="Annonces comparables actuellement en vente (SeLoger)">
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
        )}
      </Card>

    </div>
  );
}
