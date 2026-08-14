"use client";

import { useApp } from "@/lib/store";
import { eur, eurM2, eurMonth, pct } from "@/lib/format";
import { Badge, Card, CardTitle, Insight, NumberField, Row, Toggle } from "../ui";

export function TabHypotheses() {
  const { a, d, set, reset, dirty, profile, setProfile, comps, restartOnboarding } = useApp();
  const isResidence = profile === "residence";

  return (
    <div className="space-y-4">
      {/* ---------------- Projet ---------------- */}
      <Card>
        <CardTitle
          hint="Détermine les analyses affichées"
          right={
            <div className="flex gap-2">
              {dirty && (
                <button
                  onClick={reset}
                  className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition hover:bg-slate-50"
                >
                  Tout réinitialiser
                </button>
              )}
              <button
                onClick={restartOnboarding}
                className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-navy-600 transition hover:bg-navy-50"
              >
                Refaire le questionnaire
              </button>
            </div>
          }
        >
          Votre projet
        </CardTitle>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              id: "residence" as const,
              icon: "🔑",
              title: "J'achète pour y habiter",
              lead: "Comparaison acheter vs continuer à louer",
            },
            {
              id: "locatif" as const,
              icon: "📈",
              title: "J'investis pour louer",
              lead: "Cash-flow, rendement et verdict d'investissement",
            },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setProfile(o.id)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                profile === o.id
                  ? "border-navy-600 bg-navy-50/50"
                  : "border-line hover:border-navy-300"
              }`}
            >
              <span className="text-[20px]">{o.icon}</span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink">{o.title}</div>
                <div className="text-[12px] text-muted">{o.lead}</div>
              </div>
              {profile === o.id && (
                <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-600 text-[11px] font-bold text-white">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* ---------------- Acquisition + travaux ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle hint="Extrait de l'annonce, ajustable">Acquisition</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Prix d'achat" value={a.purchasePrice} step={1000} suffix="€" onChange={(v) => set("purchasePrice", v)} />
            <NumberField label="Surface" value={a.surface} step={1} suffix="m²" onChange={(v) => set("surface", v)} hint={eurM2(d.pricePerM2)} />
            <NumberField label="Frais d'agence" value={a.agencyFees} step={500} suffix="€" onChange={(v) => set("agencyFees", v)} />
            <NumberField label="Frais de notaire" value={a.notaryRatePct} step={0.1} suffix="%" onChange={(v) => set("notaryRatePct", v)} hint={eur(d.notaryFees)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row label="Coût total du projet" value={eur(d.totalProject)} strong />
            <Row label="Coût de revient au m²" value={eurM2(d.allInPerM2)} />
            <Row
              label="Écart aux comparables"
              value={`${comps.priceVsComps > 0 ? "+" : ""}${pct(comps.priceVsComps)}`}
              tone={comps.priceVsComps > 3 ? "neg" : comps.priceVsComps < -3 ? "pos" : undefined}
            />
          </div>
        </Card>

        <Card>
          <CardTitle
            hint="Budget estimé, tous corps d'état"
            right={
              <Badge tone={a.renovationBudget > 0 ? "info" : "neutral"}>
                {a.renovationBudget > 0 ? "Travaux prévus" : "Aucun travaux"}
              </Badge>
            }
          >
            Travaux
          </CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Montant des travaux"
              value={a.renovationBudget}
              step={500}
              suffix="€"
              onChange={(v) => set("renovationBudget", Math.max(0, v))}
            />
            <div className="flex flex-col justify-end pb-0.5">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
                <div className="text-[10.5px] text-muted">Travaux au m²</div>
                <div className="tnum text-[15px] font-semibold text-ink">
                  {eurM2(d.renovationPerM2)}
                </div>
              </div>
            </div>
          </div>
          <input
            type="range"
            className="mt-3 w-full"
            min={0}
            max={100000}
            step={500}
            value={a.renovationBudget}
            onChange={(e) => set("renovationBudget", parseFloat(e.target.value))}
          />
          <div className="mt-3 border-t border-line pt-3">
            <Row label="Prix + frais d'acquisition" value={eur(d.acquisitionCost)} />
            <Row label="Travaux" value={eur(d.renovation)} />
            <Row label="Coût total du projet" value={eur(d.totalProject)} strong />
          </div>
        </Card>
      </div>

      {/* ---------------- Financement ---------------- */}
      <Card>
        <CardTitle
          hint="Le poste qui pèse le plus lourd dans le résultat"
          right={
            <Badge tone={a.usesLoan ? "info" : "neutral"}>
              {a.usesLoan ? "Achat financé" : "Achat comptant"}
            </Badge>
          }
        >
          Financement
        </CardTitle>

        <div className="mb-4 rounded-xl border border-line px-4 py-3">
          <Toggle
            label="Je finance cet achat par un emprunt bancaire"
            checked={a.usesLoan}
            onChange={(v) => set("usesLoan", v)}
          />
        </div>

        {a.usesLoan ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <NumberField label="Apport" value={a.downPayment} step={1000} suffix="€" onChange={(v) => set("downPayment", Math.max(0, v))} />
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[12px] font-medium text-muted">Montant emprunté</span>
                  <span className="text-[11px] text-faint">calculé</span>
                </div>
                <div className="flex items-center rounded-lg border border-navy-200 bg-navy-50 px-3 py-2">
                  <span className="tnum w-full text-right text-sm font-semibold text-navy-700">
                    {eur(d.loanAmount)}
                  </span>
                </div>
              </div>
              <NumberField label="Taux d'intérêt" value={a.interestRate} step={0.05} suffix="%" onChange={(v) => set("interestRate", v)} hint="hors assurance" />
              <NumberField label="Durée du prêt" value={a.loanYears} step={1} suffix="ans" onChange={(v) => set("loanYears", v)} />
              <NumberField label="Assurance emprunteur" value={a.insuranceRate} step={0.01} suffix="%" onChange={(v) => set("insuranceRate", v)} hint="du capital / an" />
            </div>

            {a.renovationBudget > 0 && (
              <div className="mt-4 rounded-xl border border-line px-4 py-3">
                <Toggle
                  label="Les travaux sont financés par le prêt"
                  checked={a.financeRenovation}
                  onChange={(v) => set("financeRenovation", v)}
                />
                <p className="mt-1.5 text-[11.5px] text-faint">
                  {a.financeRenovation
                    ? `Les ${eur(d.renovation)} de travaux sont intégrés au montant emprunté.`
                    : `Les ${eur(d.renovation)} de travaux sortent de votre poche en plus de l'apport.`}
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: "Mensualité", v: eurMonth(d.monthlyPayment) },
                { l: "Coût total du crédit", v: eur(d.totalCreditCost) },
                { l: "Effort de trésorerie", v: eur(d.cashInvested) },
                { l: "Coût total du projet", v: eur(d.totalProject) },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-navy-50 px-3.5 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wide text-navy-500">{s.l}</div>
                  <div className="tnum mt-0.5 text-[16px] font-semibold text-navy-700">{s.v}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Insight>
            Achat comptant : <strong>{eur(d.totalProject)}</strong> de fonds propres mobilisés,
            aucune mensualité de crédit.
          </Insight>
        )}
      </Card>

      {/* ---------------- Situation locative actuelle (résidence) ---------------- */}
      {isResidence && (
        <Card>
          <CardTitle hint="La base de comparaison de l'onglet « Acheter ou louer »">
            Votre situation locative actuelle
          </CardTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Loyer mensuel actuel" value={a.currentRent} step={10} suffix="€" onChange={(v) => set("currentRent", v)} hint="hors charges" />
            <NumberField label="Charges mensuelles" value={a.currentRentCharges} step={5} suffix="€" onChange={(v) => set("currentRentCharges", v)} />
            <NumberField label="Hausse annuelle du loyer" value={a.currentRentGrowth} step={0.1} suffix="%/an" onChange={(v) => set("currentRentGrowth", v)} />
            <NumberField label="Durée envisagée sur place" value={a.plannedStayYears} step={1} suffix="ans" onChange={(v) => set("plannedStayYears", v)} />
            <NumberField label="Rendement des placements" value={a.investmentReturn} step={0.1} suffix="%/an" onChange={(v) => set("investmentReturn", v)} hint="capital non immobilisé" />
            <NumberField label="Entretien propriétaire" value={a.ownerMaintenancePct} step={0.1} suffix="%/an" onChange={(v) => set("ownerMaintenancePct", v)} hint="de la valeur du bien" />
            <NumberField label="Frais de revente" value={a.sellingFeesPct} step={0.5} suffix="%" onChange={(v) => set("sellingFeesPct", v)} />
            <NumberField label="Valorisation du bien" value={a.propertyAppreciation} step={0.1} suffix="%/an" onChange={(v) => set("propertyAppreciation", v)} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Row
              label="Coût locatif mensuel total"
              value={eurMonth(a.currentRent + a.currentRentCharges)}
              strong
            />
            <Row
              label="Coût mensuel en cas d'achat"
              value={eurMonth(
                d.monthlyPayment + (a.propertyTax + a.condoCharges + a.landlordInsurance) / 12,
              )}
              strong
            />
          </div>
        </Card>
      )}

      {/* ---------------- Exploitation locative ---------------- */}
      <Card>
        <CardTitle
          hint={
            isResidence
              ? "Utilisé pour le scénario « acheter et conserver », et si vous louez plus tard"
              : "Loyer, vacance et charges annuelles"
          }
          right={
            <button
              onClick={() => set("monthlyRent", comps.suggestedRent)}
              className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition hover:bg-navy-100"
            >
              Loyer suggéré : {eur(comps.suggestedRent)}
            </button>
          }
        >
          Exploitation locative
        </CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Loyer mensuel" value={a.monthlyRent} step={10} suffix="€" onChange={(v) => set("monthlyRent", v)} hint={`${pct(comps.rentVsComps)} vs suggéré`} />
          <NumberField label="Vacance locative" value={a.vacancyRate} step={0.5} suffix="%" onChange={(v) => set("vacancyRate", v)} />
          <NumberField label="Taxe foncière" value={a.propertyTax} step={50} suffix="€/an" onChange={(v) => set("propertyTax", v)} />
          <NumberField label="Charges de copropriété" value={a.condoCharges} step={50} suffix="€/an" onChange={(v) => set("condoCharges", v)} />
          <NumberField label="Assurance PNO" value={a.landlordInsurance} step={10} suffix="€/an" onChange={(v) => set("landlordInsurance", v)} />
          <NumberField label="Assurance loyers impayés" value={a.unpaidRentInsurancePct} step={0.1} suffix="%" onChange={(v) => set("unpaidRentInsurancePct", v)} />
          <NumberField label="Frais de gestion" value={a.managementFeePct} step={0.5} suffix="%" onChange={(v) => set("managementFeePct", v)} hint="0 % si gestion directe" />
          <NumberField label="Entretien" value={a.maintenancePct} step={0.5} suffix="%" onChange={(v) => set("maintenancePct", v)} />
          <NumberField label="Provision travaux (CAPEX)" value={a.capexPct} step={0.5} suffix="%" onChange={(v) => set("capexPct", v)} />
          <NumberField label="Autres charges" value={a.otherCosts} step={10} suffix="€/an" onChange={(v) => set("otherCosts", v)} />
        </div>
        <div className="mt-4 border-t border-line pt-3 sm:grid sm:grid-cols-2 sm:gap-x-8">
          <Row label="Loyer encaissé" hint="après vacance" value={eur(d.collectedRent)} />
          <Row label="Total des charges" value={eur(d.totalOpex)} />
          <Row label="Résultat net d'exploitation" value={eur(d.noi)} strong />
          <Row
            label="Cash-flow mensuel"
            value={eurMonth(d.monthlyCashFlow)}
            strong
            tone={d.monthlyCashFlow >= 0 ? "pos" : "neg"}
          />
        </div>
      </Card>

      {/* ---------------- Projection ---------------- */}
      <Card>
        <CardTitle hint="Hypothèses de long terme communes à toutes les projections">
          Projection
        </CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Hausse des loyers" value={a.rentGrowth} step={0.1} suffix="%/an" onChange={(v) => set("rentGrowth", v)} />
          <NumberField label="Inflation des charges" value={a.expenseGrowth} step={0.1} suffix="%/an" onChange={(v) => set("expenseGrowth", v)} />
          <NumberField label="Valorisation du bien" value={a.propertyAppreciation} step={0.1} suffix="%/an" onChange={(v) => set("propertyAppreciation", v)} />
          <NumberField label="Frais de revente" value={a.sellingFeesPct} step={0.5} suffix="%" onChange={(v) => set("sellingFeesPct", v)} />
        </div>
        <div className="mt-4">
          <Insight>
            Ces valeurs sont partagées par tous les onglets. Changez le taux d&apos;intérêt une
            fois et la mensualité, le cash-flow, le DSCR, la sensibilité, le verdict et le calcul
            acheter/louer se recalculent ensemble.
          </Insight>
        </div>
      </Card>
    </div>
  );
}
