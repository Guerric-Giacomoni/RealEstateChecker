"use client";

import { useDeferredValue, useMemo } from "react";
import { useApp } from "@/lib/store";
import {
  LEVERS,
  makeItWork,
  projection,
  sensitivityTable,
  solveThreshold,
} from "@/lib/finance";
import {
  dist,
  eur,
  eurMonth,
  eurMonthSigned,
  int,
  monthYear,
  num,
  pct,
} from "@/lib/format";
import {
  Badge,
  Bar,
  Card,
  CardTitle,
  Insight,
  Row,
  SectionHeading,
  Stat,
  Table,
  Td,
  pctWidth,
} from "../ui";
import { BarChart, Gauge, LineChart, ScatterStrip } from "../charts";
import { sparkFor } from "@/lib/mock";

/* ================================================================== */

export function TabRentabilite() {
  const { d, market } = useApp();

  const localVacancy = market.vacancyHistory[market.vacancyHistory.length - 1].value;

  return (
    <div className="space-y-4">
      <Verdict />

      {/* ---------------- KPI strip ---------------- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Cash-flow"
          value={eurMonth(d.monthlyCashFlow)}
          sub="après toutes charges"
          tone={d.monthlyCashFlow >= 0 ? "good" : "bad"}
          spark={sparkFor(3)}
        />
        <Stat
          label="Rendement brut"
          value={pct(d.grossYield)}
          sub="sur coût total"
          tone="neutral"
          spark={sparkFor(7)}
        />
        <Stat
          label="Rendement net"
          value={pct(d.netYield)}
          sub="après charges"
          tone={d.netYield >= 4.5 ? "good" : d.netYield >= 3 ? "warn" : "bad"}
          spark={sparkFor(11)}
        />
        <Stat
          label="Cash-on-cash"
          value={pct(d.cashOnCash)}
          sub={`sur ${eur(d.cashInvested)} investis`}
          tone={d.cashOnCash >= 3 ? "good" : d.cashOnCash >= 0 ? "warn" : "bad"}
          spark={sparkFor(17)}
        />
        <Stat
          label="DSCR"
          value={num(d.dscr)}
          sub="revenus / dette"
          tone={d.dscr >= 1.1 ? "good" : d.dscr >= 0.9 ? "warn" : "bad"}
          spark={sparkFor(23)}
        />
        <Stat
          label="Point mort"
          value={d.breakEvenOccupancy > 100 ? "> 100 %" : pct(d.breakEvenOccupancy, 0)}
          sub={`vacance locale ${pct(localVacancy)}`}
          tone={d.breakEvenOccupancy <= 90 ? "good" : d.breakEvenOccupancy <= 100 ? "warn" : "bad"}
          spark={sparkFor(29)}
        />
      </div>

      {/* ---------------- Cash flow / simulateur / facteurs ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_minmax(0,0.85fr)]">
        <CashFlowBreakdown />
        <Simulator />
        <DealFactors />
      </div>

      {/* ---------------- Seuils de viabilité ---------------- */}
      <Thresholds />

      {/* ---------------- Sensibilité ---------------- */}
      <Sensitivity />

      {/* ---------------- Loyers comparables ---------------- */}
      <RentComps />

      {/* ---------------- Marché locatif ---------------- */}
      <RentalMarket />

      {/* ---------------- Charges ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <OperatingExpenses />
        <FinancingRecap />
      </div>

      {/* ---------------- Projection ---------------- */}
      <Projection />
    </div>
  );
}

/* ================================================================== */

function Verdict() {
  const { d, scoring } = useApp();
  const v = scoring.verdict;

  const style =
    v === "GOOD"
      ? { text: "Bonne affaire", color: "text-pos", ring: "bg-pos", tone: "#0f766e", icon: "✓" }
      : v === "BORDERLINE"
        ? { text: "À la limite", color: "text-warn", ring: "bg-warn", tone: "#b45309", icon: "!" }
        : { text: "Mauvaise affaire", color: "text-bad", ring: "bg-bad", tone: "#be123c", icon: "✕" };

  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-start gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${style.ring} text-2xl font-bold text-white`}
          >
            {style.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Verdict
            </div>
            <div className={`text-[28px] font-semibold leading-tight tracking-[-0.02em] ${style.color}`}>
              {style.text}
            </div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-slate-600">
              {scoring.explanation}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">🏠 Achat &amp; conservation</Badge>
              <Badge tone="info">📅 Location longue durée</Badge>
              <Badge tone={d.monthlyCashFlow >= 0 ? "good" : "bad"}>
                Cash-flow {eurMonthSigned(d.monthlyCashFlow)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center border-line lg:border-l lg:pl-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
            Score du deal
          </div>
          <div className="relative mt-1">
            <Gauge value={scoring.score} tone={style.tone} size={158} />
            <div className="absolute inset-x-0 bottom-1 text-center">
              <span className="tnum text-[34px] font-semibold leading-none text-ink">
                {scoring.score}
              </span>
              <span className="text-[13px] text-faint">/100</span>
            </div>
          </div>
          <div className={`mt-1 text-[12px] font-semibold ${style.color}`}>
            {scoring.score >= 68 ? "Solide" : scoring.score >= 45 ? "Fragile" : "Insuffisant"}
          </div>
          <div className="text-[11px] text-faint">8 critères pondérés</div>
        </div>
      </div>
    </Card>
  );
}

/* ================================================================== */

function CashFlowBreakdown() {
  const { a, d } = useApp();
  return (
    <Card>
      <CardTitle hint="Par mois">Détail du cash-flow</CardTitle>
      <Row label="Loyer facial" value={eur(a.monthlyRent)} />
      <Row label="Vacance" hint={pct(a.vacancyRate)} value={eur(-(d.annualRent - d.collectedRent) / 12)} tone="neg" />
      <Row label="Loyer encaissé" value={eur(d.collectedRent / 12)} strong divider />

      <div className="mt-2">
        {d.opexBreakdown.map((o) => (
          <Row key={o.label} label={o.label} value={eur(-o.value / 12)} tone="neg" />
        ))}
      </div>
      <Row label="Total charges" value={eur(-d.totalOpex / 12)} strong tone="neg" divider />
      <Row label="Résultat net d'exploitation" value={eur(d.noi / 12)} strong />
      <Row label="Mensualité de crédit" value={eur(-d.monthlyPayment)} tone="neg" />
      <Row
        label="Cash-flow mensuel"
        value={eurMonthSigned(d.monthlyCashFlow)}
        strong
        divider
        tone={d.monthlyCashFlow >= 0 ? "pos" : "neg"}
      />
      <Row
        label="Cash-flow annuel"
        value={eurMonthSigned(d.annualCashFlow).replace("/mois", "/an")}
        tone={d.annualCashFlow >= 0 ? "pos" : "neg"}
      />
    </Card>
  );
}

/* ================================================================== */

function Simulator() {
  const { a, d, set, reset, dirty, scoring } = useApp();

  return (
    <Card>
      <CardTitle
        hint="Déplacez les curseurs : tous les onglets se recalculent en direct"
        right={
          dirty && (
            <button
              onClick={reset}
              className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-navy-600 transition hover:bg-navy-50"
            >
              Réinitialiser
            </button>
          )
        }
      >
        Que changerait ce deal ?
      </CardTitle>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Cash-flow</div>
          <div
            className={`tnum text-[16px] font-semibold ${d.monthlyCashFlow >= 0 ? "text-pos" : "text-bad"}`}
          >
            {eurMonthSigned(d.monthlyCashFlow)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Rendement net</div>
          <div className="tnum text-[16px] font-semibold text-navy-600">{pct(d.netYield)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Score</div>
          <div
            className={`tnum text-[16px] font-semibold ${
              scoring.verdict === "GOOD"
                ? "text-pos"
                : scoring.verdict === "BORDERLINE"
                  ? "text-warn"
                  : "text-bad"
            }`}
          >
            {scoring.score}/100
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {LEVERS.map((l) => {
          const value = a[l.key] as number;
          const fmt =
            l.unit === "pct"
              ? (v: number) => pct(v, l.step < 0.5 ? 2 : 1)
              : l.unit === "eurMonth"
                ? (v: number) => eurMonth(v)
                : (v: number) => eur(v);
          return (
            <div key={l.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12px] font-medium text-slate-600">{l.label}</span>
                <span className="tnum text-[12.5px] font-semibold text-ink">{fmt(value)}</span>
              </div>
              <input
                type="range"
                className="w-full"
                min={l.min}
                max={l.max}
                step={l.step}
                value={value}
                onChange={(e) => set(l.key, parseFloat(e.target.value) as never)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ================================================================== */

function DealFactors() {
  const { scoring } = useApp();
  return (
    <Card>
      <CardTitle hint="Pondération dans le score">Facteurs clés</CardTitle>
      <div className="space-y-3">
        {scoring.factors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-slate-600">{f.label}</span>
              <Badge tone={f.tone}>
                {f.score >= 80
                  ? "Excellent"
                  : f.score >= 65
                    ? "Bon"
                    : f.score >= 45
                      ? "Moyen"
                      : f.score >= 25
                        ? "Faible"
                        : "Critique"}
              </Badge>
            </div>
            <Bar value={f.score} max={100} tone={f.tone} />
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
        Le score combine cash-flow (22 %), DSCR (14 %), rendement net (16 %), cash-on-cash
        (12 %), point mort (12 %), prix vs comparables (10 %), vacance locale (8 %) et
        fondamentaux du marché (6 %).
      </p>
    </Card>
  );
}

/* ================================================================== */

function Thresholds() {
  const { a: live, d } = useApp();
  // Bisecting nine levers is expensive; let it lag a frame behind the sliders.
  const a = useDeferredValue(live);
  const viable = d.monthlyCashFlow >= 0;

  const rows = useMemo(() => {
    return LEVERS.map((l) => {
      const target = solveThreshold(a, l);
      if (target === null) return null;
      const current = a[l.key] as number;
      const fmt =
        l.unit === "pct"
          ? (v: number) => pct(v, 2)
          : l.unit === "eurMonth"
            ? (v: number) => eurMonth(v)
            : (v: number) => eur(v);
      const delta = target - current;
      // Only meaningful when the move is in the improving direction.
      if (l.better === -1 && delta >= 0) return null;
      if (l.better === 1 && delta <= 0) return null;
      return { lever: l, target, current, fmt, delta };
    }).filter(Boolean) as {
      lever: (typeof LEVERS)[number];
      target: number;
      current: number;
      fmt: (v: number) => string;
      delta: number;
    }[];
  }, [a]);

  const scenarios = useMemo(() => makeItWork(a), [a]);

  if (viable) {
    return (
      <Card className="border-pos/25 bg-pos-soft/40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pos text-white">
              ✓
            </span>
            <div>
              <div className="text-[15px] font-semibold text-ink">Ce deal est déjà viable</div>
              <p className="text-[13px] text-slate-600">
                Cash-flow de {eurMonthSigned(d.monthlyCashFlow)} avec les hypothèses actuelles.
              </p>
            </div>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Marge de sécurité loyer", v: eurMonth(a.monthlyRent - d.breakEvenRent) },
              { l: "Loyer plancher", v: eurMonth(d.breakEvenRent) },
              { l: "Point mort", v: pct(d.breakEvenOccupancy, 0) },
              { l: "DSCR", v: num(d.dscr) },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-white px-3 py-2 text-center">
                <div className="text-[10.5px] text-muted">{s.l}</div>
                <div className="tnum text-[14px] font-semibold text-ink">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle hint="Chaque ligne suffit, seule, à ramener le cash-flow à zéro">
        Que faudrait-il pour rendre ce deal viable ?
      </CardTitle>

      <div className="mb-4 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3">
        <span className="text-[13px] text-slate-600">Cash-flow actuel</span>
        <span className="tnum ml-2 text-[20px] font-semibold text-bad">
          {eurMonthSigned(d.monthlyCashFlow)}
        </span>
        <span className="ml-3 text-[13px] text-slate-500">
          soit {eurMonthSigned(d.annualCashFlow).replace("/mois", "/an")}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r, i) => (
          <div
            key={r.lever.key}
            className="relative rounded-xl border border-line px-4 py-3 transition hover:border-navy-300 hover:shadow-sm"
          >
            {i > 0 && (
              <span className="absolute -left-[7px] top-1/2 hidden -translate-y-1/2 rounded bg-canvas px-1 text-[10px] font-semibold text-faint sm:block">
                OU
              </span>
            )}
            <div className="text-[12px] text-muted">{r.lever.label}</div>
            <div className="tnum mt-0.5 text-[19px] font-semibold text-navy-700">
              {r.lever.better === -1 ? "≤ " : "≥ "}
              {r.fmt(r.target)}
            </div>
            <div className="mt-1 text-[11.5px] text-faint">
              actuellement {r.fmt(r.current)} · {r.delta > 0 ? "+" : ""}
              {r.fmt(Math.abs(r.delta)).replace("-", "")} à {r.delta > 0 ? "ajouter" : "retrancher"}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-[13px] text-muted">
            Aucun levier isolé ne suffit à équilibrer l&apos;opération dans des plages réalistes.
          </p>
        )}
      </div>

      {scenarios.length > 0 && (
        <>
          <div className="mt-6">
            <SectionHeading hint="Combinaisons de leviers générées automatiquement">
              Rendre ce deal viable
            </SectionHeading>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {scenarios.map((s) => (
              <div
                key={s.title}
                className={`rounded-xl border px-4 py-3 ${
                  s.result >= 0 ? "border-pos/25 bg-pos-soft/50" : "border-line bg-slate-50/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{s.title}</span>
                  <Badge tone={s.result >= 0 ? "good" : "warn"}>
                    {s.result >= 0 ? "Viable" : "Insuffisant"}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {s.changes.map((c) => (
                    <div key={c.label} className="flex items-baseline justify-between text-[11.5px]">
                      <span className="text-muted">{c.label}</span>
                      <span className="tnum text-slate-700">
                        <span className="text-faint line-through">{c.from}</span> → {c.to}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 border-t border-line pt-2 text-right">
                  <span className="text-[11px] text-muted">Cash-flow </span>
                  <span
                    className={`tnum text-[15px] font-semibold ${
                      s.result >= 0 ? "text-pos" : "text-bad"
                    }`}
                  >
                    {eurMonthSigned(s.result)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ================================================================== */

function Sensitivity() {
  const { a: live } = useApp();
  const a = useDeferredValue(live);
  const rows = useMemo(() => sensitivityTable(a), [a]);
  const maxImpact = Math.max(...rows.map((r) => Math.abs(r.impact)), 1);

  return (
    <Card>
      <CardTitle hint="Impact isolé de chaque variation sur le cash-flow mensuel">
        Analyse de sensibilité
      </CardTitle>
      <div className="grid gap-x-8 gap-y-1 lg:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 py-1.5">
            <span className="w-[150px] shrink-0 text-[12.5px] text-slate-600">{r.label}</span>
            <div className="relative h-4 flex-1">
              <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
              <div
                className={`absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full ${
                  r.impact >= 0 ? "bg-pos left-1/2" : "bg-bad"
                }`}
                style={
                  r.impact >= 0
                    ? { width: `${pctWidth(Math.abs(r.impact), maxImpact * 2)}%` }
                    : {
                        right: "50%",
                        width: `${pctWidth(Math.abs(r.impact), maxImpact * 2)}%`,
                      }
                }
              />
            </div>
            <span
              className={`tnum w-[86px] shrink-0 text-right text-[12.5px] font-semibold ${
                r.impact >= 0 ? "text-pos" : "text-bad"
              }`}
            >
              {eurMonthSigned(r.impact).replace("/mois", "")}
            </span>
            <span
              className={`tnum w-[92px] shrink-0 text-right text-[12.5px] ${
                r.newCashFlow >= 0 ? "text-pos" : "text-bad"
              }`}
            >
              {eurMonthSigned(r.newCashFlow).replace("/mois", "")}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-3 border-t border-line pt-2 text-[10.5px] uppercase tracking-wide text-faint">
        <span className="w-[86px] text-right">Impact</span>
        <span className="w-[92px] text-right">Nouveau CF</span>
      </div>
    </Card>
  );
}

/* ================================================================== */

function RentComps() {
  const { a, set, market, comps, d } = useApp();
  const sorted = [...market.rentComps].sort((x, y) => x.distance - y.distance);
  const perM2 = market.rentComps.map((c) => c.rent / c.surface);
  const rentPerM2 = a.surface > 0 ? a.monthlyRent / a.surface : 0;

  return (
    <Card>
      <CardTitle
        hint={`${market.rentComps.length} annonces locatives dans un rayon de 550 m`}
        right={
          <button
            onClick={() => set("monthlyRent", comps.suggestedRent)}
            className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-[12px] font-semibold text-navy-600 transition hover:bg-navy-100"
          >
            Appliquer le loyer suggéré ({eur(comps.suggestedRent)})
          </button>
        }
      >
        Loyers comparables
      </CardTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Loyer médian /m²", v: `${num(comps.rentPerM2.median)} €` },
          { l: "Loyer moyen /m²", v: `${num(comps.rentPerM2.avg)} €` },
          { l: "Loyer suggéré", v: eurMonth(comps.suggestedRent) },
          { l: "Loyer retenu", v: eurMonth(a.monthlyRent) },
        ].map((s) => (
          <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-muted">{s.l}</div>
            <div className="tnum mt-0.5 text-[15px] font-semibold text-ink">{s.v}</div>
          </div>
        ))}
      </div>

      <ScatterStrip
        values={perM2}
        subject={rentPerM2}
        median={comps.rentPerM2.median}
        format={(v) => `${num(v)} €/m²`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-50/60 px-4 py-3">
        <span className="text-[13px] font-medium text-slate-600">Ajuster le loyer retenu</span>
        <input
          type="range"
          className="min-w-[200px] flex-1"
          min={Math.round(comps.suggestedRent * 0.6)}
          max={Math.round(comps.suggestedRent * 1.4)}
          step={5}
          value={a.monthlyRent}
          onChange={(e) => set("monthlyRent", parseFloat(e.target.value))}
        />
        <span className="tnum text-[16px] font-semibold text-navy-700">{eurMonth(a.monthlyRent)}</span>
        <Badge tone={Math.abs(comps.rentVsComps) < 5 ? "good" : comps.rentVsComps > 0 ? "warn" : "info"}>
          {comps.rentVsComps > 0 ? "+" : ""}
          {pct(comps.rentVsComps)} vs suggéré
        </Badge>
      </div>

      <Table
        head={["Loyer", "Surface", "€/m²", "Pièces", "Distance", "Mise en ligne"]}
        align={["right", "right", "right", "right", "right", "left"]}
      >
        {sorted.map((c) => (
          <tr key={c.id} className="transition hover:bg-slate-50/70">
            <Td right strong>{eurMonth(c.rent)}</Td>
            <Td right>{c.surface} m²</Td>
            <Td right className={c.rent / c.surface >= rentPerM2 ? "!text-pos" : "!text-bad"}>
              {num(c.rent / c.surface)} €
            </Td>
            <Td right>{c.rooms}</Td>
            <Td right>{dist(c.distance)}</Td>
            <Td>{monthYear(c.listedOn)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

/* ================================================================== */

function RentalMarket() {
  const { market } = useApp();
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardTitle hint="Loyer moyen au m² et taux de vacance">Marché locatif local</CardTitle>
        <LineChart
          data={market.rentPerM2History.map((p, i) => ({
            label: p.label,
            rent: p.value,
            vacancy: market.vacancyHistory[i]?.value ?? 0,
          }))}
          series={[
            { key: "rent", label: "Loyer €/m²", color: "#1d4477", area: true },
            { key: "vacancy", label: "Vacance %", color: "#b45309", dashed: true },
          ]}
          yFormat={(v) => num(v, 1)}
          height={210}
        />
      </Card>

      <Card>
        <CardTitle hint="Indicateurs de demande locative">Tension du marché</CardTitle>
        <div className="space-y-1">
          {market.rentalDemand.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-muted">{r.label}</span>
              <Badge tone={r.tone}>{r.value}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <Row label="Population" value={int(market.population)} />
          <Row label="Croissance 5 ans" value={pct(market.populationGrowth5y)} tone="pos" />
          <Row label="Revenu médian" value={eur(market.medianIncome)} />
          <Row label="Chômage" value={pct(market.unemployment)} tone="neg" />
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */

function OperatingExpenses() {
  const { d } = useApp();
  const max = Math.max(...d.opexBreakdown.map((o) => o.value));
  return (
    <Card>
      <CardTitle hint="Par an">Charges d&apos;exploitation</CardTitle>
      <div className="space-y-2.5">
        {d.opexBreakdown.map((o) => (
          <div key={o.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] text-slate-600">{o.label}</span>
              <span className="tnum text-[12.5px] font-medium text-ink">{eur(o.value)}</span>
            </div>
            <Bar value={o.value} max={max} tone="info" />
          </div>
        ))}
      </div>
      <Row label="Total des charges" value={eur(d.totalOpex)} strong divider />
      <Row
        label="Taux de charges"
        hint="sur loyer encaissé"
        value={pct((d.totalOpex / d.collectedRent) * 100)}
      />
    </Card>
  );
}

function FinancingRecap() {
  const { a, d } = useApp();
  return (
    <Card>
      <CardTitle hint="Hérité des hypothèses du projet">Financement</CardTitle>
      <Row label="Apport" value={eur(a.downPayment)} />
      <Row label="Montant emprunté" value={eur(d.loanAmount)} />
      <Row label="Taux d'intérêt" value={pct(a.interestRate, 2)} />
      <Row label="Durée" value={`${a.loanYears} ans`} />
      <Row label="Assurance emprunteur" value={pct(a.insuranceRate, 2)} />
      <Row label="Mensualité (capital + intérêts)" value={eur(d.monthlyPI)} />
      <Row label="Assurance mensuelle" value={eur(d.monthlyInsurance)} />
      <Row label="Mensualité totale" value={eurMonth(d.monthlyPayment)} strong divider />
      <Row label="Intérêts totaux" value={eur(d.totalInterest)} />
      <Row label="Coût total du crédit" value={eur(d.totalCreditCost)} strong />
      <div className="mt-3">
        {a.usesLoan ? (
          <Insight tone={d.dscr >= 1 ? "good" : "warn"}>
            Le DSCR de <strong>{num(d.dscr)}</strong> signifie que le résultat
            d&apos;exploitation couvre {pct(Math.min(d.dscr, 9.99) * 100, 0)} de
            l&apos;échéance de crédit.{" "}
            {d.dscr < 1
              ? "Un effort d'épargne mensuel est nécessaire."
              : "L'opération s'autofinance."}
          </Insight>
        ) : (
          <Insight tone="good">
            Achat comptant : aucune échéance de crédit, donc pas de risque de DSCR. En
            contrepartie, <strong>{eur(d.cashInvested)}</strong> de capital sont immobilisés et
            le rendement cash-on-cash est mécaniquement plus faible qu&apos;avec effet de levier.
          </Insight>
        )}
      </div>
    </Card>
  );
}

/* ================================================================== */

function Projection() {
  const { a } = useApp();
  // Default the horizon to the full length of the loan, or 25 years for a cash purchase.
  const years = a.usesLoan ? a.loanYears : 25;
  const rows = useMemo(() => projection(a, years), [a, years]);

  return (
    <Card>
      <CardTitle hint="Loyers indexés, charges inflatées, amortissement du prêt">
        Projection sur {years} ans
      </CardTitle>

      <BarChart
        data={rows.map((r) => ({
          label: `A${r.year}`,
          cashFlow: r.cashFlow,
          cumulative: r.cumulativeCashFlow,
        }))}
        series={[{ key: "cashFlow", label: "Cash-flow annuel", color: "#3765a5" }]}
        lineSeries={{ key: "cumulative", label: "Cash-flow cumulé", color: "#be123c" }}
        yFormat={(v) => eur(v)}
        height={230}
      />

      <div className="mt-5">
        <LineChart
          data={rows.map((r) => ({
            label: `A${r.year}`,
            equity: r.equity,
            value: r.propertyValue,
            loan: r.loanRemaining,
          }))}
          series={[
            { key: "value", label: "Valeur du bien", color: "#8daed9" },
            { key: "equity", label: "Capital accumulé", color: "#1d4477", area: true },
            { key: "loan", label: "Capital restant dû", color: "#b45309", dashed: true },
          ]}
          yFormat={(v) => eur(v)}
          height={220}
        />
      </div>

      <div className="mt-5">
        <Table
          head={[
            "Année",
            "Loyers",
            "Charges",
            "Crédit",
            "Cash-flow",
            "Cumulé",
            "Capital dû",
            "Valeur",
            "Patrimoine net",
          ]}
          align={["left", "right", "right", "right", "right", "right", "right", "right", "right"]}
        >
          {rows.map((r) => (
            <tr key={r.year} className="transition hover:bg-slate-50/70">
              <Td strong>Année {r.year}</Td>
              <Td right>{eur(r.rentalIncome)}</Td>
              <Td right>{eur(-r.expenses)}</Td>
              <Td right>{eur(-r.debtService)}</Td>
              <Td right className={r.cashFlow >= 0 ? "!text-pos" : "!text-bad"}>
                {eur(r.cashFlow)}
              </Td>
              <Td right className={r.cumulativeCashFlow >= 0 ? "!text-pos" : "!text-bad"}>
                {eur(r.cumulativeCashFlow)}
              </Td>
              <Td right>{eur(r.loanRemaining)}</Td>
              <Td right>{eur(r.propertyValue)}</Td>
              <Td right strong>{eur(r.equity + r.cumulativeCashFlow)}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </Card>
  );
}
