// Manual formatters (not Intl) so server and client render byte-identical strings.

const NBSP = " "; // narrow no-break space, French thousands separator

function group(n: number): string {
  const s = Math.abs(Math.round(n)).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (n < 0 ? "-" : "") + grouped;
}

/** 95 000 € */
export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${group(n)}${NBSP}€`;
}

/** +95 000 € / -1 200 € */
export function eurSigned(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${group(n)}${NBSP}€`;
}

/** 1 462 €/m² */
export function eurM2(n: number): string {
  if (!isFinite(n)) return "—";
  return `${group(n)}${NBSP}€/m²`;
}

/** 844 €/mois */
export function eurMonth(n: number): string {
  if (!isFinite(n)) return "—";
  return `${group(n)}${NBSP}€/mois`;
}

export function eurMonthSigned(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${group(n)}${NBSP}€/mois`;
}

/** 7,2 % */
export function pct(n: number, decimals = 1): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(decimals).replace(".", ",")}${NBSP}%`;
}

export function pctSigned(n: number, decimals = 1): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals).replace(".", ",")}${NBSP}%`;
}

/** 0,89 */
export function num(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(decimals).replace(".", ",");
}

/** 1 234 */
export function int(n: number): string {
  if (!isFinite(n)) return "—";
  return group(n);
}

/** 320 m / 1,2 km */
export function dist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}${NBSP}m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")}${NBSP}km`;
}

/** 7 ans et 8 mois */
export function years(value: number): string {
  if (!isFinite(value) || value <= 0) return "—";
  const y = Math.floor(value);
  const m = Math.round((value - y) * 12);
  if (m === 0) return `${y} ans`;
  if (m === 12) return `${y + 1} ans`;
  return `${y} ans et ${m} mois`;
}

const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** 2024-03-14 -> mars 2024 */
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** 2024-03-14 -> 14 mars 2024 */
export function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
