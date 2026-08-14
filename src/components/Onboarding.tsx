"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { derive } from "@/lib/finance";
import { eur, eurM2, eurMonth, pct } from "@/lib/format";
import type { Assumptions, Profile } from "@/lib/types";
import { NumberField, Toggle } from "./ui";

/* ------------------------------------------------------------------ */

const STEP_LABELS = ["Votre projet", "Votre situation", "Travaux", "Financement"];
const LAST_STEP = STEP_LABELS.length - 1;

export function Onboarding() {
  const { a, property, comps, finishOnboarding } = useApp();

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasRenovation, setHasRenovation] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<Assumptions>({
    ...a,
    monthlyRent: comps.suggestedRent,
  });

  const upd = <K extends keyof Assumptions>(k: K, v: Assumptions[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const preview = useMemo(() => derive(draft), [draft]);

  const canContinue =
    step === 0 ? profile !== null : step === 2 ? hasRenovation !== null : true;

  const next = () => {
    if (step < LAST_STEP) setStep(step + 1);
    else finishOnboarding(profile!, draft);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center gap-2.5 px-6 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700 text-[15px] text-white">
            ⌂
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Immo<span className="text-navy-600">Check</span>
            </div>
            <div className="text-[10.5px] text-faint">Analyse d&apos;annonces immobilières</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-8">
        {/* Annonce analysée */}
        <div className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[14px] border border-line bg-white px-5 py-3.5">
          <span className="rounded-full bg-pos-soft px-2.5 py-1 text-[11px] font-semibold text-pos">
            ✓ Annonce analysée
          </span>
          <div className="text-[14px] font-semibold text-ink">
            {property.type} {property.rooms} pièces — {property.surface} m²
          </div>
          <div className="text-[13px] text-muted">
            {property.address}, {property.postalCode} {property.city}
          </div>
          <div className="ml-auto flex items-baseline gap-3">
            <span className="tnum text-[18px] font-semibold text-ink">
              {eur(property.askingPrice)}
            </span>
            <span className="tnum text-[13px] text-muted">
              {eurM2(property.askingPrice / property.surface)}
            </span>
          </div>
        </div>

        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                    done
                      ? "bg-pos text-white"
                      : active
                        ? "bg-navy-600 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[12.5px] font-medium ${
                    active ? "text-ink" : "text-faint"
                  }`}
                >
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <span
                    className={`h-px flex-1 ${done ? "bg-pos/40" : "bg-line"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* ---------------- Step 0 : profil ---------------- */}
        {step === 0 && (
          <Section
            title="Quel est votre projet pour ce bien ?"
            subtitle="Nous n'afficherons que les analyses qui vous concernent."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ChoiceCard
                icon="🔑"
                title="J'achète pour y habiter"
                lead="Je suis non propriétaire et j'envisage ce bien comme résidence principale."
                bullets={[
                  "Comparaison acheter vs continuer à louer",
                  "Au bout de combien d'années l'achat devient gagnant",
                  "Coût réel de la propriété sur votre horizon",
                ]}
                selected={profile === "residence"}
                onSelect={() => setProfile("residence")}
              />
              <ChoiceCard
                icon="📈"
                title="J'investis pour louer"
                lead="Je souhaite acheter ce bien pour le mettre en location."
                bullets={[
                  "Cash-flow, rendement net, DSCR et verdict",
                  "Ce qu'il faudrait changer pour que le deal passe",
                  "Projection sur 10 ans",
                ]}
                selected={profile === "locatif"}
                onSelect={() => setProfile("locatif")}
              />
            </div>
          </Section>
        )}

        {/* ---------------- Step 1 : situation ---------------- */}
        {step === 1 && profile === "residence" && (
          <Section
            title="Votre situation locative actuelle"
            subtitle="C'est la base de comparaison : ce que vous payez aujourd'hui pour vous loger."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Loyer mensuel actuel"
                value={draft.currentRent}
                step={10}
                suffix="€"
                onChange={(v) => upd("currentRent", v)}
                hint="hors charges"
              />
              <NumberField
                label="Charges mensuelles actuelles"
                value={draft.currentRentCharges}
                step={5}
                suffix="€"
                onChange={(v) => upd("currentRentCharges", v)}
              />
            </div>

            <Prefilled
              title="Le reste est pré-rempli"
              note="Valeurs moyennes du marché français. Modifiables ici ou à tout moment dans l'onglet « Hypothèses du projet »."
            >
              <NumberField compact label="Hausse annuelle du loyer" value={draft.currentRentGrowth} step={0.1} suffix="%/an" onChange={(v) => upd("currentRentGrowth", v)} />
              <NumberField compact label="Rendement des placements" value={draft.investmentReturn} step={0.1} suffix="%/an" onChange={(v) => upd("investmentReturn", v)} />
              <NumberField compact label="Durée envisagée sur place" value={draft.plannedStayYears} step={1} suffix="ans" onChange={(v) => upd("plannedStayYears", v)} />
              <NumberField compact label="Entretien propriétaire" value={draft.ownerMaintenancePct} step={0.1} suffix="%/an" onChange={(v) => upd("ownerMaintenancePct", v)} />
            </Prefilled>

            <div className="mt-4 rounded-xl bg-navy-50 px-4 py-3 text-[13px] text-navy-700">
              Vous payez aujourd&apos;hui{" "}
              <strong className="tnum">
                {eurMonth(draft.currentRent + draft.currentRentCharges)}
              </strong>{" "}
              pour vous loger, soit{" "}
              <strong className="tnum">
                {eur((draft.currentRent + draft.currentRentCharges) * 12 * draft.plannedStayYears)}
              </strong>{" "}
              sur {draft.plannedStayYears} ans.
            </div>
          </Section>
        )}

        {step === 1 && profile === "locatif" && (
          <Section
            title="Vos hypothèses de location"
            subtitle="Le loyer est déduit des annonces comparables du quartier. Ajustez-le si vous avez une meilleure idée."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <NumberField
                  label="Loyer mensuel visé"
                  value={draft.monthlyRent}
                  step={10}
                  suffix="€"
                  onChange={(v) => upd("monthlyRent", v)}
                  hint={`suggéré ${eur(comps.suggestedRent)}`}
                />
                <input
                  type="range"
                  className="mt-3 w-full"
                  min={Math.round(comps.suggestedRent * 0.6)}
                  max={Math.round(comps.suggestedRent * 1.4)}
                  step={5}
                  value={draft.monthlyRent}
                  onChange={(e) => upd("monthlyRent", parseFloat(e.target.value))}
                />
              </div>
              <NumberField
                label="Vacance locative"
                value={draft.vacancyRate}
                step={0.5}
                suffix="%"
                onChange={(v) => upd("vacancyRate", v)}
                hint="7,6 % dans la commune"
              />
            </div>

            <Prefilled
              title="Le reste est pré-rempli"
              note="Charges typiques d'un appartement de cette taille. Modifiables ici ou à tout moment dans l'onglet « Hypothèses du projet »."
            >
              <NumberField compact label="Taxe foncière" value={draft.propertyTax} step={50} suffix="€/an" onChange={(v) => upd("propertyTax", v)} />
              <NumberField compact label="Charges de copropriété" value={draft.condoCharges} step={50} suffix="€/an" onChange={(v) => upd("condoCharges", v)} />
              <NumberField compact label="Frais de gestion" value={draft.managementFeePct} step={0.5} suffix="%" onChange={(v) => upd("managementFeePct", v)} />
              <NumberField compact label="Entretien + provision travaux" value={draft.maintenancePct + draft.capexPct} step={0.5} suffix="%" onChange={(v) => { upd("maintenancePct", v * 0.625); upd("capexPct", v * 0.375); }} />
            </Prefilled>

            <div className="mt-4 rounded-xl bg-navy-50 px-4 py-3 text-[13px] text-navy-700">
              À {eurMonth(draft.monthlyRent)}, le rendement brut ressort à{" "}
              <strong className="tnum">{pct(preview.grossYield)}</strong> du coût total du projet.
            </div>
          </Section>
        )}

        {/* ---------------- Step 2 : travaux ---------------- */}
        {step === 2 && (
          <Section
            title="Des travaux sont-ils à prévoir ?"
            subtitle="Ils s'ajoutent au prix et aux frais pour former le coût réel de l'opération."
          >
            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <ChoiceCard
                icon="🔨"
                title="Oui, des travaux sont prévus"
                lead="Rafraîchissement, rénovation, mise aux normes…"
                bullets={[]}
                selected={hasRenovation === true}
                onSelect={() => {
                  setHasRenovation(true);
                  if (draft.renovationBudget === 0) upd("renovationBudget", 18000);
                }}
                compact
              />
              <ChoiceCard
                icon="✨"
                title="Non, le bien est prêt à l'usage"
                lead="Aucun budget travaux à intégrer."
                bullets={[]}
                selected={hasRenovation === false}
                onSelect={() => {
                  setHasRenovation(false);
                  upd("renovationBudget", 0);
                }}
                compact
              />
            </div>

            {hasRenovation === true && (
              <>
                <div className="max-w-sm">
                  <NumberField
                    label="Montant des travaux"
                    value={draft.renovationBudget}
                    step={500}
                    suffix="€"
                    onChange={(v) => upd("renovationBudget", Math.max(0, v))}
                    hint="tous corps d'état"
                  />
                  <input
                    type="range"
                    className="mt-3 w-full"
                    min={0}
                    max={100000}
                    step={500}
                    value={draft.renovationBudget}
                    onChange={(e) => upd("renovationBudget", parseFloat(e.target.value))}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { l: "Travaux au m²", v: eurM2(preview.renovationPerM2) },
                    { l: "Prix + frais", v: eur(preview.acquisitionCost) },
                    { l: "Coût total du projet", v: eur(preview.totalProject) },
                    { l: "Coût de revient", v: eurM2(preview.allInPerM2) },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-navy-50 px-3.5 py-2.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-navy-500">
                        {s.l}
                      </div>
                      <div className="tnum mt-0.5 text-[16px] font-semibold text-navy-700">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  À {eurM2(preview.renovationPerM2)}, ce budget correspond à une rénovation{" "}
                  {preview.renovationPerM2 > 700
                    ? "lourde"
                    : preview.renovationPerM2 > 350
                      ? "intermédiaire"
                      : "légère"}
                  .
                </p>
              </>
            )}

            {hasRenovation === false && (
              <div className="rounded-xl bg-navy-50 px-4 py-3.5 text-[13px] text-navy-700">
                Aucun budget travaux. Le coût de l&apos;opération se limite au prix, aux frais de
                notaire et aux frais d&apos;agence, soit{" "}
                <strong className="tnum">{eur(preview.totalProject)}</strong>.
              </div>
            )}
          </Section>
        )}

        {/* ---------------- Step 3 : financement ---------------- */}
        {step === 3 && (
          <Section
            title="Allez-vous financer cet achat par un emprunt ?"
            subtitle="Le crédit pèse plus lourd que tout le reste dans le résultat final."
          >
            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <ChoiceCard
                icon="🏦"
                title="Oui, avec un prêt bancaire"
                lead="Le cas le plus courant."
                bullets={["Apport, taux, durée et assurance emprunteur"]}
                selected={draft.usesLoan}
                onSelect={() => upd("usesLoan", true)}
                compact
              />
              <ChoiceCard
                icon="💶"
                title="Non, achat comptant"
                lead="Je finance la totalité sur mes fonds propres."
                bullets={["Aucune mensualité de crédit"]}
                selected={!draft.usesLoan}
                onSelect={() => upd("usesLoan", false)}
                compact
              />
            </div>

            {draft.usesLoan ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <NumberField label="Apport" value={draft.downPayment} step={1000} suffix="€" onChange={(v) => upd("downPayment", Math.max(0, v))} />
                  <DerivedField
                    label="Montant emprunté"
                    value={eur(preview.loanAmount)}
                    hint="calculé"
                  />
                  <NumberField label="Taux d'intérêt" value={draft.interestRate} step={0.05} suffix="%" onChange={(v) => upd("interestRate", v)} hint="hors assurance" />
                  <NumberField label="Durée du prêt" value={draft.loanYears} step={1} suffix="ans" onChange={(v) => upd("loanYears", v)} />
                  <NumberField label="Assurance emprunteur" value={draft.insuranceRate} step={0.01} suffix="%" onChange={(v) => upd("insuranceRate", v)} hint="du capital / an" />
                </div>

                <p className="mt-2 text-[11.5px] text-faint">
                  Montant emprunté = coût total du projet ({eur(preview.totalProject)})
                  {draft.renovationBudget > 0 && !draft.financeRenovation
                    ? ` − travaux (${eur(preview.renovation)})`
                    : ""}{" "}
                  − apport ({eur(draft.downPayment)}).
                </p>

                {draft.renovationBudget > 0 && (
                  <div className="mt-4 rounded-xl border border-line px-4 py-3">
                    <Toggle
                      label="Les travaux sont financés par le prêt"
                      checked={draft.financeRenovation}
                      onChange={(v) => upd("financeRenovation", v)}
                    />
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                      {draft.financeRenovation
                        ? `Les ${eur(preview.renovation)} de travaux sont intégrés au montant emprunté.`
                        : `Les ${eur(preview.renovation)} de travaux sortent de votre poche en plus de l'apport.`}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { l: "Mensualité", v: eurMonth(preview.monthlyPayment) },
                    { l: "Coût du crédit", v: eur(preview.totalCreditCost) },
                    { l: "Effort de trésorerie", v: eur(preview.cashInvested) },
                    { l: "Coût total du projet", v: eur(preview.totalProject) },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-navy-50 px-3.5 py-2.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-navy-500">
                        {s.l}
                      </div>
                      <div className="tnum mt-0.5 text-[16px] font-semibold text-navy-700">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-navy-50 px-4 py-3.5 text-[13px] text-navy-700">
                Vous mobilisez{" "}
                <strong className="tnum">{eur(preview.totalProject)}</strong> de fonds propres
                (prix, frais de notaire, frais d&apos;agence et travaux). Aucune mensualité de
                crédit ne sera prise en compte.
              </div>
            )}
          </Section>
        )}

        {/* ---------------- Navigation ---------------- */}
        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted transition hover:bg-slate-100 ${
              step === 0 ? "invisible" : ""
            }`}
          >
            ← Retour
          </button>
          <button
            onClick={next}
            disabled={!canContinue}
            className="rounded-lg bg-navy-700 px-6 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {step === LAST_STEP ? "Voir mon analyse →" : "Continuer →"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11.5px] text-faint">
          Toutes ces valeurs restent modifiables à tout moment dans l&apos;onglet
          « Hypothèses du projet ».
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">{subtitle}</p>
      {children}
    </div>
  );
}

/** A read-only field that mirrors the shape of NumberField, for computed values. */
function DerivedField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mt-auto mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      <div className="flex items-center rounded-lg border border-navy-200 bg-navy-50 px-3 py-2">
        <span className="tnum w-full text-right text-sm font-semibold text-navy-700">
          {value}
        </span>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  lead,
  bullets,
  selected,
  onSelect,
  compact = false,
}: {
  icon: string;
  title: string;
  lead: string;
  bullets: string[];
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-[14px] border-2 bg-white p-5 text-left transition ${
        selected
          ? "border-navy-600 shadow-[0_2px_14px_rgba(29,68,119,0.14)]"
          : "border-line hover:border-navy-300"
      }`}
    >
      <span
        className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
          selected ? "border-navy-600 bg-navy-600 text-white" : "border-slate-300 text-transparent"
        }`}
      >
        ✓
      </span>
      <div className="text-[22px] leading-none">{icon}</div>
      <div className="mt-2.5 text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</div>
      <p className="mt-1 pr-6 text-[13px] leading-relaxed text-muted">{lead}</p>
      {!compact && bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2 text-[12.5px] text-slate-600">
              <span className="text-navy-400">›</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

function Prefilled({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-[14px] border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pos-soft text-[11px] text-pos">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">{title}</div>
          <div className="text-[11.5px] text-muted">{note}</div>
        </div>
        <span className="shrink-0 text-[12px] font-medium text-navy-600">
          {open ? "Masquer" : "Ajuster"}
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-line px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {children}
        </div>
      )}
    </div>
  );
}
