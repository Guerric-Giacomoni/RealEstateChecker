"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { buyVsRent } from "@/lib/finance";
import { eur, eurMonth, pct, years as fmtYears } from "@/lib/format";
import { Badge, Card, CardTitle, Insight, NumberField, Row, Table, Td } from "../ui";
import { LineChart } from "../charts";
import { BrSensitivity, BrSimulator, BrThresholds } from "./BuyRentLevers";

export function TabAcheterLouer() {
  const { a, d, set } = useApp();
  const model = useMemo(() => buyVsRent(a, 30), [a]);

  const stay = Math.min(Math.max(1, Math.round(a.plannedStayYears)), 30);
  const at = model.rows[stay - 1];
  const be = model.breakEvenYears;
  const buyingBetter = at.buyWealth >= at.rentWealth;
  const gap = Math.abs(at.buyWealth - at.rentWealth);

  const monthlyBuy = d.monthlyPayment + (a.propertyTax + a.condoCharges + a.landlordInsurance) / 12;
  const monthlyRentNow = a.currentRent + a.currentRentCharges;

  return (
    <div className="space-y-4">
      {/* ---------------- Résultat principal ---------------- */}
      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Résultat
            </div>
            {be !== null ? (
              <>
                <div className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  L&apos;achat devient plus intéressant après{" "}
                  <span className="text-navy-600">{fmtYears(be)}</span>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                  Avant ce seuil, l&apos;apport, les frais de notaire et les intérêts pèsent plus
                  lourd que le capital remboursé et la valorisation du bien. Au-delà, la
                  propriété prend l&apos;avantage.
                </p>
              </>
            ) : (
              <>
                <div className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  La location reste plus avantageuse sur <span className="text-warn">30 ans</span>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                  Avec ces hypothèses, le coût de possession ne rattrape jamais le loyer actuel
                  augmenté du rendement du capital placé.
                </p>
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="info">Loyer actuel {eurMonth(monthlyRentNow)}</Badge>
              <Badge tone="info">Coût mensuel en achat {eurMonth(monthlyBuy)}</Badge>
              <Badge tone={buyingBetter ? "good" : "warn"}>
                Durée envisagée {stay} ans
              </Badge>
            </div>
          </div>

          {/* Comparaison à la durée prévue */}
          <div className="shrink-0 lg:border-l lg:border-line lg:pl-8">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
              À {stay} ans
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`rounded-xl border px-4 py-3 ${
                  !buyingBetter ? "border-pos/30 bg-pos-soft" : "border-line bg-slate-50"
                }`}
              >
                <div className="text-[12px] text-muted">Continuer à louer</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">
                  {eur(at.rentNetCost)}
                </div>
                <div className="text-[11px] text-faint">coût net</div>
              </div>
              <div
                className={`rounded-xl border px-4 py-3 ${
                  buyingBetter ? "border-pos/30 bg-pos-soft" : "border-line bg-slate-50"
                }`}
              >
                <div className="text-[12px] text-muted">Acheter et revendre</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">
                  {eur(at.buyNetCost)}
                </div>
                <div className="text-[11px] text-faint">coût net</div>
              </div>
            </div>
            <div
              className={`mt-3 rounded-xl px-4 py-2.5 text-center ${
                buyingBetter ? "bg-pos text-white" : "bg-warn text-white"
              }`}
            >
              <span className="text-[13px] font-medium">
                {buyingBetter ? "L'achat est meilleur de " : "La location est meilleure de "}
              </span>
              <span className="tnum text-[17px] font-semibold">{eur(gap)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ---------------- Graphique ---------------- */}
      <Card>
        <CardTitle hint="Patrimoine net, en tenant compte du capital placé dans chaque scénario">
          Position financière nette dans le temps
        </CardTitle>
        <LineChart
          data={model.rows.map((r) => ({
            label: `${r.year}a`,
            buy: r.buyWealth,
            rent: r.rentWealth,
          }))}
          series={[
            { key: "buy", label: "Acheter", color: "#1d4477", area: true },
            { key: "rent", label: "Louer", color: "#b45309", dashed: true },
          ]}
          yFormat={(v) => eur(v)}
          zeroLine
          height={260}
          markerX={be !== null ? be - 1 : null}
          markerLabel={be !== null ? `Point d'équilibre — ${fmtYears(be)}` : undefined}
        />
        <div className="mt-3">
          <Insight tone={buyingBetter ? "good" : "warn"}>
            {be !== null ? (
              <>
                Le croisement intervient à <strong>{fmtYears(be)}</strong>. Vous prévoyez de
                rester <strong>{stay} ans</strong> —{" "}
                {stay >= be
                  ? "l'achat est donc financièrement préférable dans votre horizon."
                  : "la location reste préférable sur votre horizon."}
              </>
            ) : (
              <>
                Aucun croisement sur 30 ans. Il faudrait une valorisation annuelle supérieure à{" "}
                <strong>{pct(a.propertyAppreciation + 1.5)}</strong> ou un prix d&apos;achat
                nettement inférieur pour que l&apos;achat rattrape la location.
              </>
            )}
          </Insight>
        </div>
      </Card>

      {/* ---------------- Simulateur + sensibilité ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <BrSimulator />
        <BrSensitivity />
      </div>

      {/* ---------------- Seuils ---------------- */}
      <BrThresholds />

      {/* ---------------- Trois scénarios ---------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle hint={`Sur ${stay} ans`}>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-warn-soft text-[11px] font-bold text-warn">
              1
            </span>
            Continuer à louer
          </CardTitle>
          <Row label="Loyers versés" value={eur(-at.rentPaid)} tone="neg" />
          <Row label="Loyer en fin de période" value={eurMonth(monthlyRentNow * Math.pow(1 + a.currentRentGrowth / 100, stay))} />
          <Row label="Capital resté placé" value={eur(model.upfront)} />
          <Row
            label="Écart mensuel placé"
            hint={monthlyBuy >= monthlyRentNow ? "le locataire épargne" : "le locataire dépense plus"}
            value={eur(monthlyBuy - monthlyRentNow)}
            tone={monthlyBuy >= monthlyRentNow ? "pos" : "neg"}
          />
          <Row label="Gains des placements" value={eur(at.renterGains)} tone="pos" />
          <Row label="Coût non récupérable" value={eur(at.rentPaid)} />
          <Row label="Patrimoine net" value={eur(at.rentWealth)} strong divider />
        </Card>

        <Card>
          <CardTitle hint={`Achat puis revente à ${stay} ans`}>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy-50 text-[11px] font-bold text-navy-600">
              2
            </span>
            Acheter et revendre
          </CardTitle>
          <Row label="Apport + frais initiaux" value={eur(-model.upfront)} tone="neg" />
          <Row
            label="Écart mensuel placé"
            hint={monthlyBuy < monthlyRentNow ? "l'acheteur épargne" : "l'acheteur dépense plus"}
            value={eur(monthlyRentNow - monthlyBuy)}
            tone={monthlyBuy < monthlyRentNow ? "pos" : "neg"}
          />
          <Row label="Intérêts + assurance" value={eur(-at.interestPaid)} tone="neg" />
          <Row label="Taxe foncière, charges, entretien" value={eur(-at.ownerCosts)} tone="neg" />
          <Row label="Frais de revente" hint={pct(a.sellingFeesPct, 0)} value={eur(-at.sellingFees)} tone="neg" />
          <Row label="Capital remboursé" value={eur(at.principalRepaid)} tone="pos" />
          <Row label="Valorisation du bien" value={eur(at.propertyValue - a.purchasePrice - d.renovation * 0.6)} tone="pos" />
          <Row label="Prix de revente net" value={eur(at.propertyValue - at.sellingFees)} />
          <Row label="Capital restant dû" value={eur(-at.loanRemaining)} tone="neg" />
          <Row label="Patrimoine net" value={eur(at.buyWealth)} strong divider />
        </Card>

        <Card>
          <CardTitle hint="Vous déménagez mais gardez le bien">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy-50 text-[11px] font-bold text-navy-600">
              3
            </span>
            Acheter et conserver
          </CardTitle>
          <Row label="Valeur estimée du bien" value={eur(model.scenarioKeep.propertyValue)} />
          <Row label="Capital restant dû" value={eur(-model.scenarioKeep.loanRemaining)} tone="neg" />
          <Row label="Capital accumulé" value={eur(model.scenarioKeep.equity)} strong divider />
          <div className="mt-3 rounded-xl border border-line bg-slate-50/60 p-3">
            <div className="text-[12px] font-semibold text-slate-600">
              Bascule en location à {stay} ans
            </div>
            <Row label="Loyer estimé" value={eurMonth(model.scenarioKeep.potentialRent)} />
            <Row label="Mensualité restante" value={eurMonth(d.monthlyPayment)} />
            <Row
              label="Cash-flow indicatif"
              value={eurMonth(
                model.scenarioKeep.potentialRent * 0.75 - d.monthlyPayment,
              )}
              tone={
                model.scenarioKeep.potentialRent * 0.75 - d.monthlyPayment >= 0 ? "pos" : "neg"
              }
            />
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              Hypothèse : 25 % du loyer absorbé par la vacance et les charges.
            </p>
          </div>
        </Card>
      </div>

      {/* ---------------- Hypothèses ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle hint="Votre logement actuel">Situation locative actuelle</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Loyer mensuel" value={a.currentRent} step={10} suffix="€" onChange={(v) => set("currentRent", v)} />
            <NumberField label="Charges mensuelles" value={a.currentRentCharges} step={5} suffix="€" onChange={(v) => set("currentRentCharges", v)} />
            <NumberField label="Hausse annuelle du loyer" value={a.currentRentGrowth} step={0.1} suffix="%" onChange={(v) => set("currentRentGrowth", v)} />
            <NumberField label="Durée envisagée" value={a.plannedStayYears} step={1} suffix="ans" onChange={(v) => set("plannedStayYears", v)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row label="Coût locatif mensuel total" value={eurMonth(monthlyRentNow)} strong />
            <Row label="Coût mensuel en cas d'achat" value={eurMonth(monthlyBuy)} strong />
            <Row
              label="Écart mensuel"
              value={eurMonth(monthlyBuy - monthlyRentNow)}
              tone={monthlyBuy > monthlyRentNow ? "neg" : "pos"}
            />
          </div>
        </Card>

        <Card>
          <CardTitle hint="Communes aux deux scénarios">Hypothèses de projection</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Valorisation du bien" value={a.propertyAppreciation} step={0.1} suffix="%/an" onChange={(v) => set("propertyAppreciation", v)} />
            <NumberField label="Rendement des placements" value={a.investmentReturn} step={0.1} suffix="%/an" onChange={(v) => set("investmentReturn", v)} />
            <NumberField label="Frais de revente" value={a.sellingFeesPct} step={0.5} suffix="%" onChange={(v) => set("sellingFeesPct", v)} />
            <NumberField label="Entretien propriétaire" value={a.ownerMaintenancePct} step={0.1} suffix="%/an" onChange={(v) => set("ownerMaintenancePct", v)} />
            <NumberField label="Inflation des charges" value={a.expenseGrowth} step={0.1} suffix="%/an" onChange={(v) => set("expenseGrowth", v)} />
            <NumberField label="Taux d'intérêt" value={a.interestRate} step={0.05} suffix="%" onChange={(v) => set("interestRate", v)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row label="Apport + frais engagés" value={eur(model.upfront)} strong />
            <Row label="Montant emprunté" value={eur(d.loanAmount)} />
            <Row label="Mensualité de crédit" value={eurMonth(d.monthlyPayment)} />
          </div>
        </Card>
      </div>

      {/* ---------------- Tableau détaillé ---------------- */}
      <Card>
        <CardTitle hint="Patrimoine net comparé, année par année">Détail annuel</CardTitle>
        <Table
          head={[
            "Année",
            "Loyers cumulés",
            "Intérêts cumulés",
            "Capital remboursé",
            "Valeur du bien",
            "Patrimoine — louer",
            "Patrimoine — acheter",
            "Écart",
          ]}
          align={["left", "right", "right", "right", "right", "right", "right", "right"]}
        >
          {model.rows
            .filter((r) => r.year <= 25)
            .map((r) => {
              const diff = r.buyWealth - r.rentWealth;
              const isStay = r.year === stay;
              return (
                <tr
                  key={r.year}
                  className={`transition hover:bg-slate-50/70 ${isStay ? "bg-navy-50/60" : ""}`}
                >
                  <Td strong>
                    {r.year} an{r.year > 1 ? "s" : ""}
                    {isStay && (
                      <span className="ml-1.5 rounded bg-navy-600 px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
                        PRÉVU
                      </span>
                    )}
                  </Td>
                  <Td right>{eur(r.rentPaid)}</Td>
                  <Td right>{eur(r.interestPaid)}</Td>
                  <Td right>{eur(r.principalRepaid)}</Td>
                  <Td right>{eur(r.propertyValue)}</Td>
                  <Td right>{eur(r.rentWealth)}</Td>
                  <Td right>{eur(r.buyWealth)}</Td>
                  <Td right strong className={diff >= 0 ? "!text-pos" : "!text-bad"}>
                    {diff >= 0 ? "+" : ""}
                    {eur(diff)}
                  </Td>
                </tr>
              );
            })}
        </Table>
      </Card>
    </div>
  );
}
