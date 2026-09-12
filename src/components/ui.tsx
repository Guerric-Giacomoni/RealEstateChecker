"use client";

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        pad ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  right,
  hint,
}: {
  children: ReactNode;
  right?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{children}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function SectionHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 mt-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-faint">
        {children}
      </h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & tones                                                      */
/* ------------------------------------------------------------------ */

export type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-pos-soft text-pos",
  info: "bg-navy-50 text-navy-600",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-slate-100 text-slate-600",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function toneForCashFlow(v: number): Tone {
  return v >= 50 ? "good" : v >= -50 ? "warn" : "bad";
}

export function valueColor(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-bad" : "text-ink";
}

/* ------------------------------------------------------------------ */
/* Stat tiles                                                          */
/* ------------------------------------------------------------------ */

/**
 * Small "i" affordance with a definition tooltip. Pure CSS: the tooltip shows
 * on hover and on click/tap (via focus-within), so it works on touch too.
 */
export function InfoDot({ text }: { text: string }) {
  return (
    <span className="group/info absolute right-2 top-2 z-10">
      <button
        type="button"
        aria-label={text}
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-navy-200 text-[9px] font-bold leading-none text-navy-400 transition hover:bg-navy-50 hover:text-navy-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[22px] z-20 w-52 rounded-lg border border-line bg-white px-3 py-2 text-left text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Inline "i" tooltip, for sitting next to a form-field label (not a corner). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/fi relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="flex h-[14px] w-[14px] items-center justify-center rounded-full border border-navy-200 text-[9px] font-bold leading-none text-navy-400 transition hover:bg-navy-50 hover:text-navy-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-[20px] z-30 w-56 rounded-lg border border-line bg-white px-3 py-2 text-left text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover/fi:opacity-100 group-focus-within/fi:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  spark,
  emphasis = false,
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  spark?: number[];
  emphasis?: boolean;
  info?: string;
}) {
  const color =
    tone === "good"
      ? "text-pos"
      : tone === "bad"
        ? "text-bad"
        : tone === "warn"
          ? "text-warn"
          : "text-navy-600";
  return (
    <Card className="relative flex flex-col">
      {info && <InfoDot text={info} />}
      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
          {label}
        </div>
        <div
          className={`tnum mt-2 font-semibold tracking-[-0.02em] ${color} ${
            emphasis ? "text-[30px]" : "text-[26px]"
          }`}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      </div>
      {spark && (
        <div className="mt-3">
          <Sparkline values={spark} tone={tone} />
        </div>
      )}
    </Card>
  );
}

export function Sparkline({
  values,
  tone = "neutral",
  height = 30,
}: {
  values: number[];
  tone?: Tone;
  height?: number;
}) {
  const stroke =
    tone === "good"
      ? "#0f766e"
      : tone === "bad"
        ? "#be123c"
        : tone === "warn"
          ? "#b45309"
          : "#1d4477";
  const w = 200;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-[30px] w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.6" opacity="0.55" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Key/value rows                                                      */
/* ------------------------------------------------------------------ */

export function Row({
  label,
  value,
  hint,
  strong = false,
  tone,
  divider = false,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  strong?: boolean;
  tone?: "pos" | "neg";
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-[7px] ${
        divider ? "mt-1 border-t border-line pt-2.5" : ""
      }`}
    >
      <div className="min-w-0">
        <span
          className={`text-[13px] ${strong ? "font-semibold text-ink" : "text-muted"}`}
        >
          {label}
        </span>
        {hint && <span className="ml-1.5 text-[11px] text-faint">{hint}</span>}
      </div>
      <span
        className={`tnum shrink-0 text-[13px] tabular-nums ${
          strong ? "font-semibold" : "font-medium"
        } ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-bad" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min,
  max,
  hint,
  info,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  info?: string;
  compact?: boolean;
}) {
  return (
    <label className="flex h-full flex-col">
      {/* `mt-auto` pushes the label+input group to the bottom of a stretched
          grid cell, so inputs stay aligned when a neighbour's label wraps to
          two lines while the label still sits right above its box. */}
      <div className="mt-auto mb-1 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-[12px] font-medium text-muted">
          {label}
          {info && <InfoTip text={info} />}
        </span>
        {hint && <span className="shrink-0 text-[11px] text-faint">{hint}</span>}
      </div>
      {/* The suffix sits in normal flow rather than absolutely positioned, so a
          long one ("%/an") can never collide with the right-aligned value. */}
      <div
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-white transition focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 ${
          compact ? "px-2 py-1.5" : "px-3 py-2"
        }`}
      >
        <input
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isNaN(v) ? 0 : v);
          }}
          className={`tnum w-full min-w-0 flex-1 bg-transparent text-right font-medium text-ink outline-none ${
            compact ? "text-[13px]" : "text-sm"
          }`}
        />
        {suffix && (
          <span className="shrink-0 whitespace-nowrap text-[12px] leading-none text-faint">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <span className="tnum text-[13px] font-semibold text-ink">{format(value)}</span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span
        className={`relative h-[20px] w-[36px] shrink-0 rounded-full transition ${
          checked ? "bg-navy-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all ${
            checked ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function Table({
  head,
  children,
  align = [],
}: {
  head: string[];
  children: ReactNode;
  align?: ("left" | "right")[];
}) {
  return (
    <div className="thin-scroll -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h + i}
                className={`whitespace-nowrap border-b border-line px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-faint first:pl-1 last:pr-1 ${
                  (align[i] ?? "left") === "right" ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  right = false,
  strong = false,
  className = "",
}: {
  children: ReactNode;
  right?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`tnum whitespace-nowrap border-b border-line/70 px-3 py-2.5 first:pl-1 last:pr-1 ${
        right ? "text-right" : "text-left"
      } ${strong ? "font-semibold text-ink" : "text-slate-600"} ${className}`}
    >
      {children}
    </td>
  );
}

/** Colour-coded DPE letter, following the French energy label scale (A→G). */
const DPE_COLORS: Record<string, string> = {
  A: "bg-[#319834] text-white",
  B: "bg-[#4faa3a] text-white",
  C: "bg-[#a7c60e] text-ink",
  D: "bg-[#f5e50a] text-ink",
  E: "bg-[#f6a30b] text-white",
  F: "bg-[#ec6c1f] text-white",
  G: "bg-[#e30613] text-white",
};

export function DpeBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-faint">—</span>;
  const letter = value.toUpperCase();
  const cls = DPE_COLORS[letter] ?? "bg-slate-200 text-slate-600";
  return (
    <span
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1.5 text-[11px] font-bold ${cls}`}
    >
      {letter}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/**
 * CSS percentage widths must be rounded before they hit the DOM: Node and the
 * browser can disagree on the last bits of a float, which React flags as a
 * hydration mismatch.
 */
export function pctWidth(value: number, max: number): number {
  return Math.round(Math.max(0, Math.min(100, (value / max) * 100)) * 100) / 100;
}

export function Bar({
  value,
  max,
  tone = "info",
}: {
  value: number;
  max: number;
  tone?: Tone;
}) {
  const bg =
    tone === "good"
      ? "bg-pos"
      : tone === "bad"
        ? "bg-bad"
        : tone === "warn"
          ? "bg-warn"
          : "bg-navy-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${bg}`}
        style={{ width: `${pctWidth(value, max)}%` }}
      />
    </div>
  );
}

export function Insight({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  const border =
    tone === "bad"
      ? "border-bad/20 bg-bad-soft"
      : tone === "warn"
        ? "border-warn/20 bg-warn-soft"
        : tone === "good"
          ? "border-pos/20 bg-pos-soft"
          : "border-navy-200 bg-navy-50";
  return (
    <div className={`flex gap-2.5 rounded-xl border ${border} px-4 py-3`}>
      <span className="mt-[1px] text-sm">💡</span>
      <p className="text-[13px] leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

/**
 * Marks a value that is still placeholder/demo data (not yet wired to a real
 * source). Rendered in pink so it's obvious at a glance what isn't real yet.
 */
export function Mock({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-pink-500"
      title="Donnée d'exemple — pas encore reliée à une source réelle"
    >
      {children}
    </span>
  );
}

/** Pink "Exemple" pill for a whole card/chart that is still demo data. */
export function MockBadge() {
  return (
    <span
      className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-600"
      title="Contenu d'exemple — pas encore relié à une source réelle"
    >
      Exemple
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-faint">
      {children}
    </div>
  );
}
