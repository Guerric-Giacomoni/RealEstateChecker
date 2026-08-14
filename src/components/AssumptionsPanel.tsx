"use client";

import { useApp } from "@/lib/store";
import { eur, eurM2, eurMonth, pct } from "@/lib/format";
import { Badge, Card, Row } from "./ui";

export function PropertyCard() {
  const { property, a, d, comps } = useApp();
  return (
    <Card pad={false} className="overflow-hidden">
      <div className="relative h-[132px] bg-gradient-to-br from-navy-700 via-navy-600 to-navy-800">
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-medium text-white backdrop-blur">
          🛡 Analysé le 5 août 2026
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[11px] font-medium text-navy-100">{property.type}</div>
          <div className="text-[15px] font-semibold leading-tight text-white">
            {property.address}
          </div>
          <div className="text-[12px] text-navy-100">
            {property.postalCode} {property.city}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <span>🛏 {property.bedrooms} ch.</span>
          <span>🚪 {property.rooms} pièces</span>
          <span>📐 {a.surface} m²</span>
          <Badge tone={property.dpe <= "D" ? "good" : property.dpe <= "E" ? "warn" : "bad"}>
            DPE {property.dpe}
          </Badge>
        </div>

        <Row label="Prix affiché" value={eur(a.purchasePrice)} strong />
        <Row label="Prix au m²" value={eurM2(d.pricePerM2)} />
        <Row
          label="vs comparables"
          value={`${comps.priceVsComps > 0 ? "+" : ""}${pct(comps.priceVsComps)}`}
          tone={comps.priceVsComps > 3 ? "neg" : comps.priceVsComps < -3 ? "pos" : undefined}
        />
        <Row label="Coût total du projet" value={eur(d.totalProject)} strong divider />
        <Row label="Coût de revient" value={eurM2(d.allInPerM2)} />

        <a
          href={property.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block truncate rounded-lg border border-line px-3 py-2 text-center text-[12px] font-medium text-navy-600 transition hover:bg-navy-50"
        >
          Voir l&apos;annonce d&apos;origine ↗
        </a>
      </div>
    </Card>
  );
}

/**
 * Read-only digest of the shared assumptions. Editing happens in the
 * "Hypothèses du projet" tab so the sidebar stays scannable.
 */
export function AssumptionsRecap({ onEdit }: { onEdit: () => void }) {
  const { a, d, profile, dirty } = useApp();

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Vos hypothèses</h3>
          <p className="text-[11px] text-muted">Partagées par tous les onglets</p>
        </div>
        {dirty && <Badge tone="info">Modifiées</Badge>}
      </div>

      {a.usesLoan ? (
        <div className="rounded-lg bg-navy-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-medium text-navy-600">Mensualité de crédit</span>
            <span className="tnum text-[15px] font-semibold text-navy-700">
              {eur(d.monthlyPayment)}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-navy-500">
            <span>Emprunt {eur(d.loanAmount)}</span>
            <span>Apport {eur(a.downPayment)}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-navy-50 px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-medium text-navy-600">Achat comptant</span>
            <span className="tnum text-[15px] font-semibold text-navy-700">
              {eur(d.totalProject)}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-navy-500">Aucune mensualité de crédit</div>
        </div>
      )}

      <div className="mt-2">
        {a.usesLoan && (
          <>
            <Row label="Taux d'intérêt" value={pct(a.interestRate, 2)} />
            <Row label="Durée du prêt" value={`${a.loanYears} ans`} />
            <Row label="Assurance" value={pct(a.insuranceRate, 2)} />
          </>
        )}
        <Row label="Travaux" value={eur(d.renovation)} />

        {profile === "residence" ? (
          <>
            <Row
              label="Loyer actuel"
              value={eurMonth(a.currentRent + a.currentRentCharges)}
              divider
            />
            <Row label="Durée envisagée" value={`${a.plannedStayYears} ans`} />
            <Row label="Rendement placements" value={pct(a.investmentReturn)} />
            <Row label="Valorisation du bien" value={pct(a.propertyAppreciation)} />
          </>
        ) : (
          <>
            <Row label="Loyer visé" value={eurMonth(a.monthlyRent)} divider />
            <Row label="Vacance" value={pct(a.vacancyRate)} />
            <Row label="Taxe foncière" value={eur(a.propertyTax)} />
            <Row label="Charges copro" value={eur(a.condoCharges)} />
            <Row label="Frais de gestion" value={pct(a.managementFeePct)} />
          </>
        )}
      </div>

      <button
        onClick={onEdit}
        className="mt-3 block w-full rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-center text-[12.5px] font-semibold text-navy-600 transition hover:bg-navy-100"
      >
        Modifier les hypothèses
      </button>
    </Card>
  );
}
