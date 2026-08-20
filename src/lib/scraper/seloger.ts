import type { Comparable, Property } from "../types";
import { ScrapeError, type ScrapeResult } from "./types";

/**
 * Map one dataset item from our SeLoger actor (seloger-listing-scraper) into the
 * app's Property. The actor returns a stable, rich shape — see
 * actors/seloger/sample-output.json — so this is mostly direct field picks.
 */
export function mapSelogerItem(raw: unknown, url: string): ScrapeResult {
  if (!raw || typeof raw !== "object") {
    throw new ScrapeError("Annonce SeLoger vide ou illisible.", "parse_failed");
  }
  const item = raw as SelogerItem;
  const warnings: string[] = [];
  const loc = item.locality ?? {};
  const eb = item.energyBalance ?? {};

  const need = <T>(value: T | undefined | null, label: string, fallback: T): T => {
    if (value === undefined || value === null || value === "") {
      warnings.push(label);
      return fallback;
    }
    return value;
  };

  const askingPrice = num(item.price ?? item.priceBlock?.price);
  const surface = num(item.livingArea);
  // Keep only features the ad actually declares; drop AI-inferred ones.
  const features = (item.features ?? [])
    .filter((f) => f?.source === "listing" && typeof f.value === "string")
    .map((f) => f.value as string);
  const energy = {
    condition: str(eb.condition) ?? null,
    heatingSystem: str(eb.heatingSystem) ?? null,
    energySource: str(eb.energySource) ?? null,
  };

  const property: Property = {
    url: str(item.permalink) ?? str(item.actorInputUrl) ?? url,
    title: need(str(item.title) ?? str(item.headline), "titre", "Annonce SeLoger"),
    address: str(loc.district) ?? "",
    city: need(str(item.city ?? loc.city), "ville", ""),
    postalCode: need(str(item.zipCode ?? loc.zipCode), "code postal", ""),
    askingPrice: need(askingPrice, "prix", 0),
    surface: need(surface, "surface", 0),
    rooms: num(item.rooms) ?? 0,
    bedrooms: num(item.bedrooms) ?? 0,
    type: str(item.realEstat) ?? "Bien",
    dpe: (str(item.dpe ?? eb.dpe?.rating) ?? "").toUpperCase() || "—",
    ges: (str(item.ges ?? eb.ges?.rating) ?? "").toUpperCase() || "—",
    floor: item.floor != null ? String(item.floor) : "",
    // Build year is optional on SeLoger (unlike DPE) — often null; that's fine.
    year: str(item.yearOfConstruction ?? item.energyBalance?.yearOfConstruction) ?? "",
    description: buildDescription(str(item.description), energy, features, eb.estimatedAnnualEnergyCost),
    photo: str(item.itemMainPicture) ?? firstString(item.photos) ?? "",
    features,
    energy,
    // Geo code for comparable search URLs; marketInsightsPlaceId mirrors it.
    districtGeoId: str(loc.districtGeoId ?? item.marketInsightsPlaceId) ?? null,
    scrapedOn: (str(item.scrapedAt) ?? new Date().toISOString()).slice(0, 10),
  };

  const assumptions: ScrapeResult["assumptions"] = {};
  if (property.askingPrice > 0) assumptions.purchasePrice = property.askingPrice;
  if (property.surface > 0) assumptions.surface = property.surface;

  return { source: "seloger", property, assumptions, comparables: [], warnings };
}

/**
 * Map the full dataset returned by the actor's `comparablesFor` mode: one
 * `subject` record + up to N `comparable` records (+ a summary we ignore here).
 */
export function mapSelogerDataset(items: unknown[], url: string): ScrapeResult {
  const records = items.filter(
    (r): r is Record<string, unknown> => !!r && typeof r === "object",
  );
  const subject =
    records.find((r) => r.recordType === "subject") ??
    records.find((r) => r.recordType === "listing") ??
    records.find(
      (r) =>
        !["comparable", "comparablesSummary", "error"].includes(r.recordType as string) &&
        r.is404 !== true,
    );
  if (!subject) {
    throw new ScrapeError(
      "Aucune donnée renvoyée pour cette annonce (lien expiré ou introuvable ?).",
      "not_found",
      404,
    );
  }
  const base = mapSelogerItem(subject, url);
  const comparables = records
    .filter((r) => r.recordType === "comparable")
    .map(mapComparable)
    .filter((c): c is Comparable => c !== null);
  return { ...base, comparables };
}

/** One `comparable` record → the flat shape the "Ventes en cours" table renders. */
function mapComparable(raw: Record<string, unknown>): Comparable | null {
  const url = str(raw.url);
  const price = num(raw.price);
  if (!url || price === undefined) return null;
  const surface = num(raw.livingArea) ?? 0;
  // The actor composes `address` ("district, city (zip)"); compose a fallback
  // from the parts if an older build didn't send it.
  const address =
    str(raw.address) ??
    (() => {
      const line = [str(raw.district), str(raw.city)].filter(Boolean).join(", ");
      const zip = str(raw.zipCode);
      return line ? (zip ? `${line} (${zip})` : line) : (zip ?? null);
    })();
  return {
    id: str(raw.publicId) ?? str(raw.id) ?? url,
    url,
    address,
    price,
    surface,
    pricePerM2: num(raw.squareMeterPrice) ?? (surface ? Math.round(price / surface) : 0),
    dpe: (str(raw.dpe) ?? "").toUpperCase() || null,
    rooms: num(raw.rooms) ?? null,
  };
}

/* ------------------------------------------------------------------ */

/** Raw listing description + an appended line of energy/features details. */
function buildDescription(
  base: string | undefined,
  energy: { condition: string | null; heatingSystem: string | null; energySource: string | null },
  features: string[],
  cost: EnergyCost | undefined,
): string {
  const bits: string[] = [];

  if (energy.heatingSystem) {
    bits.push(
      energy.energySource
        ? `${energy.heatingSystem} au ${energy.energySource.toLowerCase()}`
        : energy.heatingSystem,
    );
  } else if (energy.energySource) {
    bits.push(`Énergie : ${energy.energySource}`);
  }
  if (energy.condition) bits.push(`état : ${energy.condition.toLowerCase()}`);

  const costText =
    str(cost?.raw) ??
    (cost?.min != null && cost?.max != null ? `entre ${cost.min} et ${cost.max} €/an` : null);
  if (costText) bits.push(`coût énergétique estimé ${costText}`);

  if (features.length) bits.push(`caractéristiques : ${features.join(", ")}`);

  const extra = bits.map((b) => `${capitalize(b)}.`).join(" ");
  return [base?.trim(), extra].filter(Boolean).join("\n\n");
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ------------------------------- types ---------------------------------- */

type SelogerFeature = { value?: unknown; source?: string };
type EnergyCost = { min?: number; max?: number; raw?: string };
type SelogerItem = {
  permalink?: string;
  actorInputUrl?: string;
  title?: string;
  headline?: string;
  description?: string;
  price?: number;
  priceBlock?: { price?: number };
  livingArea?: number;
  rooms?: number;
  bedrooms?: number;
  realEstat?: string;
  dpe?: string;
  ges?: string;
  yearOfConstruction?: number | string | null;
  floor?: number | string | null;
  city?: string;
  zipCode?: string;
  itemMainPicture?: string;
  photos?: unknown;
  scrapedAt?: string;
  marketInsightsPlaceId?: string;
  features?: SelogerFeature[];
  locality?: { district?: string; districtGeoId?: string; city?: string; zipCode?: string };
  energyBalance?: {
    condition?: string;
    heatingSystem?: string;
    energySource?: string;
    yearOfConstruction?: number | string | null;
    dpe?: { rating?: string };
    ges?: { rating?: string };
    estimatedAnnualEnergyCost?: EnergyCost;
  };
};

/* ------------------------------ helpers --------------------------------- */

function firstString(v: unknown): string | undefined {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
