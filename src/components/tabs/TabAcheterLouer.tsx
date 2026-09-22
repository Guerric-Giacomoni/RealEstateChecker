"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { buyVsRent } from "@/lib/finance";
import { eur, eurMonth, pct, years as fmtYears } from "@/lib/format";
import { Badge, Card, CardTitle, Insight, NumberField, Row, SectionHeading, Table, Td } from "../ui";
import { LineChart } from "../charts";
import { BrSensitivity, BrSimulator, BrThresholds } from "./BuyRentLevers";

const perM2 = (v: number) => `${Math.round(v)} €/m²·mois`;

export function TabAcheterLouer() {
  const { a, d, set } = useApp();

  // Primary "louer" leg = renting an EQUIVALENT of the bought property (its own
  // market rent). This is the like-for-like comparison for buy vs rent.
  const model = useMemo(() => buyVsRent(a, 30), [a]);
  // Secondary leg = the user's actual (usually smaller/cheaper) current rental.
  const modelActual = useMemo(
    () =>
      buyVsRent(a, 30, {
        rent: { start: a.currentRent + a.currentRentCharges, growthPct: a.currentRentGrowth },
      }),
    [a],
  );

  const stay = Math.min(Math.max(1, Math.round(a.plannedStayYears)), 30);
  const atSim = model.rows[stay - 1]; // louer similaire (+ buyer side)
  const atAct = modelActual.rows[stay - 1]; // louer actuel
  const be = model.breakEvenYears; // buy vs louer similaire
  const buyingBetter = atSim.buyWealth >= atSim.rentWealth;
  const gap = Math.abs(atSim.buyWealth - atSim.rentWealth);

  const monthlyBuy = d.monthlyPayment + (a.propertyTax + d.buildingCharge + a.landlordInsurance) / 12;
  const similarCharges = Math.round(d.buildingCharge / 12);
  const similarRent = a.monthlyRent + similarCharges;
  const actualRent = a.currentRent + a.currentRentCharges;

  const perM2Actual = a.currentSurface > 0 ? actualRent / a.currentSurface : 0;
  const perM2Similar = a.surface > 0 ? similarRent / a.surface : 0;
  const perM2Buy = a.surface > 0 ? monthlyBuy / a.surface : 0;

  return (
    <div className="space-y-4">
      {/* ---------------- Résultat principal (à logement équivalent) ---------------- */}
      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Résultat — à logement équivalent ({a.surface} m²)
            </div>
            {be !== null ? (
              <>
                <div className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  L&apos;achat devient plus intéressant après{" "}
                  <span className="text-navy-600">{fmtYears(be)}</span>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                  Comparé à <strong>louer le même bien</strong> ({eurMonth(similarRent)}). Avant ce
                  seuil, l&apos;apport, les frais et les intérêts pèsent plus lourd que le capital
                  remboursé et la valorisation ; au-delà, la propriété prend l&apos;avantage.
                </p>
              </>
            ) : (
              <>
                <div className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  Louer un bien équivalent reste plus avantageux sur{" "}
                  <span className="text-warn">30 ans</span>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                  Le coût de possession ne rattrape jamais le loyer d&apos;un bien similaire augmenté
                  du rendement du capital placé.
                </p>
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="info">Louer similaire {eurMonth(similarRent)}</Badge>
              <Badge tone="info">Coût mensuel en achat {eurMonth(monthlyBuy)}</Badge>
              <Badge tone={buyingBetter ? "good" : "warn"}>Durée envisagée {stay} ans</Badge>
            </div>
            <p className="mt-2 text-[11.5px] text-faint">
              Votre logement actuel ({a.currentSurface} m², {eurMonth(actualRent)}) est plus petit —
              voir le scénario « Continuer à louer » ci-dessous.
            </p>
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
                <div className="text-[12px] text-muted">Louer similaire</div>
                <div className="tnum mt-0.5 text-[19px] font-semibold text-ink">
                  {eur(atSim.rentNetCost)}
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
                  {eur(atSim.buyNetCost)}
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
        <CardTitle hint="Patrimoine net, capital placé inclus. « Louer » = un bien équivalent au bien acheté.">
          Position financière nette dans le temps
        </CardTitle>
        <LineChart
          data={model.rows.map((r, i) => ({
            label: `${r.year}a`,
            buy: r.buyWealth,
            rentSim: r.rentWealth,
            rentAct: modelActual.rows[i].rentWealth,
          }))}
          series={[
            { key: "buy", label: "Acheter", color: "#1d4477", area: true },
            { key: "rentSim", label: "Louer similaire", color: "#b45309" },
            { key: "rentAct", label: "Louer actuel", color: "#94a3b8", dashed: true },
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
                À logement équivalent, le croisement intervient à <strong>{fmtYears(be)}</strong>.
                Vous prévoyez de rester <strong>{stay} ans</strong> —{" "}
                {stay >= be
                  ? "l'achat est donc préférable dans votre horizon."
                  : "louer un bien similaire reste préférable sur votre horizon."}
              </>
            ) : (
              <>
                Aucun croisement sur 30 ans face à un loyer équivalent. Il faudrait une valorisation
                plus forte ou un prix d&apos;achat plus bas pour que l&apos;achat rattrape.
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

      {/* ---------------- Quatre scénarios (2×2 : Louer / Acheter) ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Louer --- */}
        <div className="space-y-4">
          <SectionHeading hint="Vous restez locataire et placez votre capital">Louer</SectionHeading>

          <Card>
            <CardTitle hint={`${a.currentSurface} m² · ${perM2(perM2Actual)} · sur ${stay} ans`}>
              <ScenarioBadge n={1} tone="warn" />
              Continuer à louer (logement actuel)
            </CardTitle>
            <Row label="Loyers versés" value={eur(-atAct.rentPaid)} tone="neg" />
            <Row
              label="Loyer en fin de période"
              value={eurMonth(actualRent * Math.pow(1 + a.currentRentGrowth / 100, stay))}
            />
            <Row label="Capital resté placé" value={eur(model.upfront)} />
            <Row
              label="Écart mensuel placé"
              hint={monthlyBuy >= actualRent ? "le locataire épargne" : "le locataire dépense plus"}
              value={eur(monthlyBuy - actualRent)}
              tone={monthlyBuy >= actualRent ? "pos" : "neg"}
            />
            <Row label="Gains des placements" value={eur(atAct.renterGains)} tone="pos" />
            <Row label="Patrimoine net" value={eur(atAct.rentWealth)} strong divider />
          </Card>

          <Card>
            <CardTitle hint={`${a.surface} m² · ${perM2(perM2Similar)} · sur ${stay} ans`}>
              <ScenarioBadge n={2} tone="warn" />
              Louer un bien similaire à l&apos;annonce
            </CardTitle>
            <Row label="Loyers versés" value={eur(-atSim.rentPaid)} tone="neg" />
            <Row
              label="Loyer en fin de période"
              value={eurMonth(similarRent * Math.pow(1 + a.rentGrowth / 100, stay))}
            />
            <Row label="Capital resté placé" value={eur(model.upfront)} />
            <Row
              label="Écart mensuel placé"
              hint={monthlyBuy >= similarRent ? "le locataire épargne" : "le locataire dépense plus"}
              value={eur(monthlyBuy - similarRent)}
              tone={monthlyBuy >= similarRent ? "pos" : "neg"}
            />
            <Row label="Gains des placements" value={eur(atSim.renterGains)} tone="pos" />
            <Row label="Patrimoine net" value={eur(atSim.rentWealth)} strong divider />
          </Card>
        </div>

        {/* --- Acheter --- */}
        <div className="space-y-4">
          <SectionHeading hint="Vous devenez propriétaire du bien">Acheter</SectionHeading>

          <Card>
            <CardTitle hint={`${a.surface} m² · ${perM2(perM2Buy)} · revente à ${stay} ans`}>
              <ScenarioBadge n={3} tone="info" />
              Acheter et revendre
            </CardTitle>
            <Row label="Apport + frais initiaux" value={eur(-model.upfront)} tone="neg" />
            <Row
              label="Écart mensuel placé"
              hint={monthlyBuy < similarRent ? "l'acheteur épargne" : "l'acheteur dépense plus"}
              value={eur(similarRent - monthlyBuy)}
              tone={monthlyBuy < similarRent ? "pos" : "neg"}
            />
            <Row label="Intérêts + assurance" value={eur(-atSim.interestPaid)} tone="neg" />
            <Row label="Taxe foncière, charges, entretien" value={eur(-atSim.ownerCosts)} tone="neg" />
            <Row label="Frais de revente" hint={pct(a.sellingFeesPct, 0)} value={eur(-atSim.sellingFees)} tone="neg" />
            <Row label="Capital remboursé" value={eur(atSim.principalRepaid)} tone="pos" />
            <Row label="Valorisation du bien" value={eur(atSim.propertyValue - a.purchasePrice - d.renovation * 0.6)} tone="pos" />
            <Row label="Prix de revente net" value={eur(atSim.propertyValue - atSim.sellingFees)} />
            <Row label="Capital restant dû" value={eur(-atSim.loanRemaining)} tone="neg" />
            <Row label="Patrimoine net" value={eur(atSim.buyWealth)} strong divider />
          </Card>

          <Card>
            <CardTitle hint="Vous déménagez mais gardez le bien">
              <ScenarioBadge n={4} tone="info" />
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
                value={eurMonth(model.scenarioKeep.potentialRent * 0.75 - d.monthlyPayment)}
                tone={model.scenarioKeep.potentialRent * 0.75 - d.monthlyPayment >= 0 ? "pos" : "neg"}
              />
              <p className="mt-1 text-[11px] leading-relaxed text-faint">
                Hypothèse : 25 % du loyer absorbé par la vacance et les charges.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ---------------- Hypothèses ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle hint="Votre logement actuel + le bien équivalent">Situation locative</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Loyer actuel" value={a.currentRent} step={10} suffix="€" onChange={(v) => set("currentRent", v)} />
            <NumberField label="Charges actuelles" value={a.currentRentCharges} step={5} suffix="€" onChange={(v) => set("currentRentCharges", v)} />
            <NumberField label="Surface actuelle" value={a.currentSurface} step={1} suffix="m²" onChange={(v) => set("currentSurface", v)} />
            <NumberField label="Hausse du loyer actuel" value={a.currentRentGrowth} step={0.1} suffix="%/an" onChange={(v) => set("currentRentGrowth", v)} />
            <NumberField
              label="Loyer d'un bien similaire"
              value={a.monthlyRent}
              step={10}
              suffix="€"
              hint="estimé des comparables"
              info="Loyer de marché du bien que vous achèteriez — c'est la vraie base de comparaison avec l'achat (louer le même logement plutôt que votre logement actuel plus petit)."
              onChange={(v) => set("monthlyRent", v)}
            />
            <NumberField label="Durée envisagée" value={a.plannedStayYears} step={1} suffix="ans" onChange={(v) => set("plannedStayYears", v)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row label="Coût mensuel — logement actuel" value={eurMonth(actualRent)} strong />
            <Row label="Coût mensuel — louer similaire" value={eurMonth(similarRent)} strong />
            <Row label="Coût mensuel — en achat" value={eurMonth(monthlyBuy)} strong />
          </div>
        </Card>

        <Card>
          <CardTitle hint="Communes aux scénarios">Hypothèses de projection</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Valorisation du bien" value={a.propertyAppreciation} step={0.1} suffix="%/an" onChange={(v) => set("propertyAppreciation", v)} />
            <NumberField label="Rendement des placements" value={a.investmentReturn} step={0.1} suffix="%/an" onChange={(v) => set("investmentReturn", v)} />
            <NumberField label="Hausse des loyers du marché" value={a.rentGrowth} step={0.1} suffix="%/an" onChange={(v) => set("rentGrowth", v)} />
            <NumberField label="Frais de revente" value={a.sellingFeesPct} step={0.5} suffix="%" onChange={(v) => set("sellingFeesPct", v)} />
            <NumberField label="Entretien propriétaire" value={a.ownerMaintenancePct} step={0.1} suffix="%/an" onChange={(v) => set("ownerMaintenancePct", v)} />
            <NumberField label="Taux d'intérêt" value={a.interestRate} step={0.05} suffix="%" onChange={(v) => set("interestRate", v)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row label="Apport + frais engagés" value={eur(model.upfront)} strong />
            <Row label="Montant emprunté" value={eur(d.loanAmount)} />
            <Row label="Mensualité de crédit" value={eurMonth(d.monthlyPayment)} />
          </div>
        </Card>
      </div>

      {/* ---------------- Tableau détaillé (vs louer similaire) ---------------- */}
      <Card>
        <CardTitle hint="Patrimoine net comparé (louer = bien équivalent), année par année">
          Détail annuel
        </CardTitle>
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

function ScenarioBadge({ n, tone }: { n: number; tone: "warn" | "info" }) {
  return (
    <span
      className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-navy-50 text-navy-600"
      }`}
    >
      {n}
    </span>
  );
}
