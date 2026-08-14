"use client";

import { useRef, useState } from "react";

const W = 820;

type Point = { label: string } & Record<string, number | string>;

export type SeriesDef = {
  key: string;
  label: string;
  color: string;
  area?: boolean;
  dashed?: boolean;
};

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

function useHover(length: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [idx, setIdx] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((x - PAD.l) / (W - PAD.l - PAD.r)) * (length - 1));
    setIdx(Math.max(0, Math.min(length - 1, i)));
  };
  return { ref, idx, onMove, onLeave: () => setIdx(null) };
}

const PAD = { l: 58, r: 16, t: 14, b: 28 };

/**
 * Round every coordinate before it reaches the DOM. Math.pow is not
 * correctly-rounded and Node and the browser can disagree in the last bits,
 * which React reports as a hydration mismatch.
 */
const r2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ */

export function LineChart({
  data,
  series,
  height = 230,
  yFormat = (v: number) => String(Math.round(v)),
  zeroLine = false,
  yMinOverride,
  markerX,
  markerLabel,
  legend = true,
}: {
  data: Point[];
  series: SeriesDef[];
  height?: number;
  yFormat?: (v: number) => string;
  zeroLine?: boolean;
  yMinOverride?: number;
  markerX?: number | null;
  markerLabel?: string;
  legend?: boolean;
}) {
  const H = height;
  const { ref, idx, onMove, onLeave } = useHover(data.length);

  const all = series.flatMap((s) => data.map((d) => Number(d[s.key])));
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (zeroLine) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (yMinOverride !== undefined) min = Math.min(min, yMinOverride);
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;
  const ticks = niceTicks(min, max, 4).map(r2);
  min = Math.min(min, ticks[0]);
  max = Math.max(max, ticks[ticks.length - 1]);

  const px = (i: number) => r2(PAD.l + (i / Math.max(1, data.length - 1)) * (W - PAD.l - PAD.r));
  const py = (v: number) => r2(PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b));

  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={py(t)}
              y2={py(t)}
              stroke={Math.abs(t) < 1e-9 && zeroLine ? "#cbd5e1" : "#eef1f6"}
              strokeWidth={Math.abs(t) < 1e-9 && zeroLine ? 1.2 : 1}
            />
            <text
              x={PAD.l - 8}
              y={py(t) + 3.5}
              textAnchor="end"
              className="fill-faint"
              style={{ fontSize: 10.5 }}
            >
              {yFormat(t)}
            </text>
          </g>
        ))}

        {/* areas */}
        {series
          .filter((s) => s.area)
          .map((s) => {
            const d =
              `M ${px(0)} ${py(Number(data[0][s.key]))} ` +
              data.map((p, i) => `L ${px(i)} ${py(Number(p[s.key]))}`).join(" ") +
              ` L ${px(data.length - 1)} ${py(Math.max(min, 0))} L ${px(0)} ${py(Math.max(min, 0))} Z`;
            return <path key={s.key} d={d} fill={s.color} opacity={0.1} />;
          })}

        {/* lines */}
        {series.map((s) => {
          const d = data
            .map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(Number(p[s.key]))}`)
            .join(" ");
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
          );
        })}

        {/* break-even marker */}
        {markerX != null && markerX >= 0 && (
          <g>
            <line
              x1={px(markerX)}
              x2={px(markerX)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="#1d4477"
              strokeWidth={1.2}
              strokeDasharray="4 4"
            />
            <circle cx={px(markerX)} cy={PAD.t + 6} r={3} fill="#1d4477" />
            {markerLabel && (
              <text
                x={px(markerX) + 6}
                y={PAD.t + 10}
                className="fill-navy-600"
                style={{ fontSize: 10.5, fontWeight: 600 }}
              >
                {markerLabel}
              </text>
            )}
          </g>
        )}

        {/* x labels */}
        {data.map((p, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={i}
              x={px(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-faint"
              style={{ fontSize: 10.5 }}
            >
              {p.label}
            </text>
          ) : null,
        )}

        {/* hover */}
        {idx !== null && (
          <g>
            <line
              x1={px(idx)}
              x2={px(idx)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            {series.map((s) => (
              <circle
                key={s.key}
                cx={px(idx)}
                cy={py(Number(data[idx][s.key]))}
                r={3.5}
                fill="#fff"
                stroke={s.color}
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>

      {idx !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur"
          style={{
            left: `${r2((px(idx) / W) * 100)}%`,
            transform: `translateX(${idx > data.length / 2 ? "-108%" : "8%"})`,
          }}
        >
          <div className="mb-1 font-semibold text-ink">{data[idx].label}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-muted">{s.label}</span>
              <span className="tnum ml-auto font-semibold text-ink">
                {yFormat(Number(data[idx][s.key]))}
              </span>
            </div>
          ))}
        </div>
      )}

      {legend && series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span
                className="h-[2px] w-4 rounded-full"
                style={{
                  background: s.dashed
                    ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)`
                    : s.color,
                }}
              />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function BarChart({
  data,
  series,
  height = 230,
  yFormat = (v: number) => String(Math.round(v)),
  lineSeries,
}: {
  data: Point[];
  series: SeriesDef[];
  height?: number;
  yFormat?: (v: number) => string;
  lineSeries?: SeriesDef;
}) {
  const H = height;
  const { ref, idx, onMove, onLeave } = useHover(data.length);

  const keys = [...series.map((s) => s.key), ...(lineSeries ? [lineSeries.key] : [])];
  const all = keys.flatMap((k) => data.map((d) => Number(d[k])));
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;
  const ticks = niceTicks(min, max, 4).map(r2);
  min = Math.min(min, ticks[0]);
  max = Math.max(max, ticks[ticks.length - 1]);

  const innerW = W - PAD.l - PAD.r;
  const slot = innerW / data.length;
  const groupW = slot * 0.62;
  const barW = groupW / series.length;
  const px = (i: number) => r2(PAD.l + slot * i + slot / 2);
  const py = (v: number) => r2(PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b));

  const allSeries = lineSeries ? [...series, lineSeries] : series;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={py(t)}
              y2={py(t)}
              stroke={Math.abs(t) < 1e-9 ? "#cbd5e1" : "#eef1f6"}
            />
            <text
              x={PAD.l - 8}
              y={py(t) + 3.5}
              textAnchor="end"
              className="fill-faint"
              style={{ fontSize: 10.5 }}
            >
              {yFormat(t)}
            </text>
          </g>
        ))}

        {data.map((p, i) => (
          <g key={i}>
            {idx === i && (
              <rect
                x={r2(PAD.l + slot * i)}
                y={PAD.t}
                width={r2(slot)}
                height={H - PAD.t - PAD.b}
                fill="#0f172a"
                opacity={0.03}
              />
            )}
            {series.map((s, si) => {
              const v = Number(p[s.key]);
              const y0 = py(0);
              const y1 = py(v);
              return (
                <rect
                  key={s.key}
                  x={r2(px(i) - groupW / 2 + si * barW)}
                  y={r2(Math.min(y0, y1))}
                  width={r2(Math.max(1, barW - 1.5))}
                  height={r2(Math.max(1, Math.abs(y1 - y0)))}
                  rx={2}
                  fill={s.color}
                  opacity={v < 0 ? 0.85 : 1}
                />
              );
            })}
          </g>
        ))}

        {lineSeries && (
          <path
            d={data
              .map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(Number(p[lineSeries.key]))}`)
              .join(" ")}
            fill="none"
            stroke={lineSeries.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {data.map((p, i) => (
          <text
            key={`x${i}`}
            x={px(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-faint"
            style={{ fontSize: 10.5 }}
          >
            {p.label}
          </text>
        ))}
      </svg>

      {idx !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur"
          style={{
            left: `${r2((px(idx) / W) * 100)}%`,
            transform: `translateX(${idx > data.length / 2 ? "-108%" : "8%"})`,
          }}
        >
          <div className="mb-1 font-semibold text-ink">{data[idx].label}</div>
          {allSeries.map((s) => (
            <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted">{s.label}</span>
              <span className="tnum ml-auto font-semibold text-ink">
                {yFormat(Number(data[idx][s.key]))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {allSeries.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Horizontal distribution of comparables with the subject marked. */
export function ScatterStrip({
  values,
  subject,
  median,
  format,
}: {
  values: number[];
  subject: number;
  median: number;
  format: (v: number) => string;
}) {
  const min = Math.min(...values, subject);
  const max = Math.max(...values, subject);
  const span = max - min || 1;
  const pos = (v: number) => Math.round(((v - min) / span) * 10000) / 100;
  return (
    <div className="pb-6 pt-8">
      <div className="relative h-1.5 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full bg-navy-100"
          style={{
            left: `${pos(Math.min(...values))}%`,
            width: `${pos(Math.max(...values)) - pos(Math.min(...values))}%`,
          }}
        />
        {values.map((v, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy-300"
            style={{ left: `${pos(v)}%` }}
          />
        ))}
        {/* median */}
        <span
          className="absolute -top-1 h-[14px] w-[2px] -translate-x-1/2 rounded bg-navy-400"
          style={{ left: `${pos(median)}%` }}
        />
        <span
          className="absolute -top-7 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium text-navy-500"
          style={{ left: `${pos(median)}%` }}
        >
          Médiane {format(median)}
        </span>
        {/* subject */}
        <span
          className="absolute -top-[5px] h-[22px] w-[3px] -translate-x-1/2 rounded bg-navy-700"
          style={{ left: `${pos(subject)}%` }}
        />
        <span
          className="absolute top-5 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy-700 px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
          style={{ left: `${pos(subject)}%` }}
        >
          Ce bien {format(subject)}
        </span>
      </div>
    </div>
  );
}

/** Semi-circular gauge for the confidence / deal score. */
export function Gauge({
  value,
  max = 100,
  tone = "#1d4477",
  size = 150,
}: {
  value: number;
  max?: number;
  tone?: string;
  size?: number;
}) {
  const r = 60;
  const cx = 75;
  const cy = 72;
  const circ = Math.PI * r;
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <svg viewBox="0 0 150 86" style={{ width: size }} className="overflow-visible">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#eef1f6"
        strokeWidth={11}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={tone}
        strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray={`${circ * ratio} ${circ}`}
      />
    </svg>
  );
}
