"use client";

import { useDeferredValue, useMemo } from "react";
import { useApp } from "@/lib/store";
import { BR_LEVERS, brSensitivityTable, buyVsRent, solveBrThreshold } from "@/lib/finance";
import { eur, eurMonth, num, pct, years as fmtYears } from "@/lib/format";
import { Card, CardTitle } from "../ui";
import type { Assumptions } from "@/lib/types";

const NEVER = 99;

function fmtBreakEven(v: number) {
  return v >= NEVER ? "jamais" : fmtYears(v);
}

function leverFormat(unit: "eur" | "pct" | "eurMonth", step: number) {
  if (unit === "pct") return (v: number) => pct(v, step < 0.5 ? 2 : 1);
  if (unit === "eurMonth") return (v: number) => eurMonth(v);
  return (v: number) => eur(v);
}

/** Percentage widths must be rounded before reaching the DOM (hydration). */
const w2 = (v: number) => Math.round(v * 100) / 100;

/* ================================================================== */

const SIM_LEVERS: {
  key: keyof Assumptions;
  label: string;
  unit: "eur" | "pct" | "eurMonth";
  min: number;
  max: number;
  step: number;
  asYears?: boolean;
}[] = [
  { key: "purchasePrice", label: "Prix d'achat", unit: "eur", min: 40000, max: 400000, step: 1000 },
  { key: "downPayment", label: "Apport", unit: "eur", min: 0, max: 250000, step: 1000 },
  { key: "interestRate", label: "Taux d'intérêt", unit: "pct", min: 0.5, max: 8, step: 0.05 },
  { key: "loanYears", label: "Durée du prêt", unit: "pct", min: 5, max: 30, step: 1, asYears: true },
  { key: "currentRent", label: "Loyer actuel", unit: "eurMonth", min: 200, max: 3000, step: 10 },
  { key: "propertyAppreciation", label: "Valorisation du bien", unit: "pct", min: -2, max: 8, step: 0.1 },
  { key: "investmentReturn", label: "Rendement des placements", unit: "pct", min: 0, max: 12, step: 0.1 },
  { key: "plannedStayYears", label: "Durée envisagée sur place", unit: "pct", min: 1, max: 30, step: 1, asYears: true },
  { key: "sellingFeesPct", label: "Frais de revente", unit: "pct", min: 0, max: 12, step: 0.5 },
];

export function BrSimulator() {
  const { a, set, reset, dirty } = useApp();
  const model = useMemo(() => buyVsRent(a, 30), [a]);
  const be = model.breakEvenYears;
  const stay = Math.min(Math.max(1, Math.round(a.plannedStayYears)), 30);
  const at = model.rows[stay - 1];
  const gap = at.buyWealth - at.rentWealth;

  return (
    <Card>
      <CardTitle
        hint="Déplacez les curseurs : le point d'équilibre se recalcule en direct"
        right={
          dirty ? (
            <button
              onClick={reset}
              className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-navy-600 transition hover:bg-navy-50"
            >
              Réinitialiser
            </button>
          ) : undefined
        }
      >
        Que changerait ce projet ?
      </CardTitle>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Point d&apos;équilibre</div>
          <div className="tnum text-[15px] font-semibold text-navy-600">
            {be === null ? "> 30 ans" : fmtYears(be)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Écart à {stay} ans</div>
          <div className={`tnum text-[15px] font-semibold ${gap >= 0 ? "text-pos" : "text-bad"}`}>
            {gap >= 0 ? "+" : ""}
            {eur(gap)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
          <div className="text-[10.5px] text-muted">Décision</div>
          <div
            className={`text-[15px] font-semibold ${
              be !== null && be <= stay ? "text-pos" : "text-warn"
            }`}
          >
            {be !== null && be <= stay ? "Acheter" : "Louer"}
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {SIM_LEVERS.map((l) => {
          const value = a[l.key] as number;
          const fmt = l.asYears ? (v: number) => `${v} ans` : leverFormat(l.unit, l.step);
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

export function BrSensitivity() {
  const { a: live } = useApp();
  // Solving every lever is expensive; let it lag a frame behind the sliders
  // rather than blocking them.
  const a = useDeferredValue(live);
  const rows = useMemo(() => brSensitivityTable(a), [a]);
  const base = useMemo(() => buyVsRent(a, 30, { breakEvenOnly: true }).breakEvenYears ?? NEVER, [a]);
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));
  const maxDelta = Math.max(...rows.map((r) => Math.abs(clamp(r.delta))), 1);

  return (
    <Card>
      <CardTitle hint="Effet isolé de chaque variation sur le point d'équilibre">
        Analyse de sensibilité
      </CardTitle>

      <div className="mb-2 text-[12.5px] text-muted">
        Point d&apos;équilibre actuel :{" "}
        <span className="tnum font-semibold text-ink">{fmtBreakEven(base)}</span>
      </div>

      <div>
        {rows.map((r) => {
          const shown = clamp(r.delta);
          const width = w2((Math.abs(shown) / maxDelta) * 50);
          return (
            <div key={r.label} className="flex items-center gap-3 py-1.5">
              <span className="w-[150px] shrink-0 text-[12.5px] text-slate-600">{r.label}</span>
              <div className="relative h-4 flex-1">
                <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                <div
                  className={`absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full ${
                    shown <= 0 ? "bg-pos" : "bg-bad"
                  }`}
                  style={
                    shown <= 0
                      ? { right: "50%", width: `${width}%` }
                      : { left: "50%", width: `${width}%` }
                  }
                />
              </div>
              <span
                className={`tnum w-[70px] shrink-0 text-right text-[12.5px] font-semibold ${
                  r.delta <= 0 ? "text-pos" : "text-bad"
                }`}
              >
                {Math.abs(r.delta) < 0.05
                  ? "—"
                  : `${r.delta > 0 ? "+" : "−"}${num(Math.abs(shown), 1)} an`}
              </span>
              <span className="tnum w-[110px] shrink-0 text-right text-[12.5px] text-slate-600">
                {fmtBreakEven(r.breakEven)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-end gap-3 border-t border-line pt-2 text-[10.5px] uppercase tracking-wide text-faint">
        <span className="w-[70px] text-right">Écart</span>
        <span className="w-[110px] text-right">Nouveau seuil</span>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        Une barre verte raccourcit le délai avant que l&apos;achat devienne gagnant, une barre
        rouge l&apos;allonge. « Jamais » signifie que l&apos;achat ne rattrape pas la location
        sur 30 ans.
      </p>
    </Card>
  );
}

/* ================================================================== */

export function BrThresholds() {
  const { a: live } = useApp();
  const a = useDeferredValue(live);
  const model = useMemo(() => buyVsRent(a, 30, { breakEvenOnly: true }), [a]);
  const stay = Math.round(a.plannedStayYears);
  const be = model.breakEvenYears;
  const favourable = be !== null && be <= stay;

  const rows = useMemo(() => {
    return BR_LEVERS.map((l) => {
      const target = solveBrThreshold(a, l);
      if (target === null) return null;
      return {
        lever: l,
        target,
        current: a[l.key] as number,
        fmt: leverFormat(l.unit, l.step),
      };
    }).filter(Boolean) as {
      lever: (typeof BR_LEVERS)[number];
      target: number;
      current: number;
      fmt: (v: number) => string;
    }[];
  }, [a]);

  return (
    <Card>
      <CardTitle
        hint={
          favourable
            ? "Chaque ligne est une limite : au-delà, la location redevient préférable"
            : `Chaque ligne suffit, seule, à faire basculer la décision dans vos ${stay} ans`
        }
      >
        {favourable
          ? `Jusqu'où l'achat reste-t-il gagnant sur ${stay} ans ?`
          : `Que faudrait-il pour que l'achat soit gagnant en ${stay} ans ?`}
      </CardTitle>

      <div
        className={`mb-4 rounded-xl border px-4 py-3 ${
          favourable ? "border-pos/20 bg-pos-soft" : "border-warn/20 bg-warn-soft"
        }`}
      >
        <span className="text-[13px] text-slate-600">Point d&apos;équilibre actuel</span>
        <span
          className={`tnum ml-2 text-[20px] font-semibold ${favourable ? "text-pos" : "text-warn"}`}
        >
          {be === null ? "> 30 ans" : fmtYears(be)}
        </span>
        <span className="ml-3 text-[13px] text-slate-500">
          {favourable
            ? `soit ${fmtYears(Math.max(0.01, stay - be))} de marge sur votre horizon de ${stay} ans`
            : `vous prévoyez de rester ${stay} ans`}
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
            <div className="mt-1 text-[11.5px] text-faint">actuellement {r.fmt(r.current)}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-[13px] text-muted">
            Aucun levier isolé ne fait basculer la décision dans des plages réalistes.
          </p>
        )}
      </div>
    </Card>
  );
}
