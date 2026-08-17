import type { Property } from "../types";
import { ScrapeError, type ScrapeResult } from "./types";

/**
 * Map one dataset item from the Scrapifier Leboncoin actor into our Property.
 * The item mirrors Leboncoin's own ad object: `subject`, `body`, `price`,
 * a typed `attributes[]` list, `location{}` and `images[]`.
 */
export function mapLeboncoinItem(raw: unknown, url: string): ScrapeResult {
  if (!raw || typeof raw !== "object") {
    throw new ScrapeError("Annonce Leboncoin vide ou illisible.", "parse_failed");
  }
  const ad = raw as Ad;
  const warnings: string[] = [];

  const attr = (key: string) => ad.attributes?.find((a) => a.key === key);
  const need = <T>(value: T | undefined | null, label: string, fallback: T): T => {
    if (value === undefined || value === null || value === "") {
      warnings.push(label);
      return fallback;
    }
    return value;
  };

  const price = firstNumber(ad.price);
  const surface = toNumber(attr("square")?.value);
  const rooms = toNumber(attr("rooms")?.value);
  const bedrooms = toNumber(attr("bedrooms")?.value);
  const type = attr("real_estate_type")?.value_label;
  const dpe = attr("energy_rate")?.value_label ?? attr("energy_rate")?.value;
  const ges = attr("ges")?.value_label ?? attr("ges")?.value;
  const floor = attr("floor_number")?.value_label;
  const year = attr("construction_year")?.value;
  const loc = ad.location;

  const property: Property = {
    url: ad.url ?? url,
    title: need(ad.subject, "titre", "Annonce Leboncoin"),
    address: loc?.address ?? "",
    city: need(loc?.city, "ville", ""),
    postalCode: need(loc?.zipcode, "code postal", ""),
    askingPrice: need(price, "prix", 0),
    surface: need(surface, "surface", 0),
    rooms: rooms ?? 0,
    bedrooms: bedrooms ?? 0,
    type: type ?? "Bien",
    dpe: (dpe ?? "").toString().toUpperCase() || "—",
    ges: (ges ?? "").toString().toUpperCase() || "—",
    floor: floor ?? "",
    year: (year ?? "").toString(),
    description: ad.body ?? "",
    photo: firstImage(ad) ?? "",
    features: [],
    energy: { condition: null, heatingSystem: null, energySource: null },
    scrapedOn: new Date().toISOString().slice(0, 10),
  };

  // Only listing-provided fields seed the assumptions; the rest keep DEFAULTS.
  const assumptions: ScrapeResult["assumptions"] = {};
  if (property.askingPrice > 0) assumptions.purchasePrice = property.askingPrice;
  if (property.surface > 0) assumptions.surface = property.surface;

  return { source: "leboncoin", property, assumptions, warnings };
}

/* ------------------------------------------------------------------ */

type Attribute = { key?: string; value?: string; value_label?: string };
type Ad = {
  url?: string;
  subject?: string;
  body?: string;
  price?: number | number[];
  attributes?: Attribute[];
  location?: { city?: string; zipcode?: string; address?: string };
  images?: string[] | { urls?: string[]; thumb_url?: string; url?: string };
};

function firstImage(ad: Ad): string | undefined {
  const img = ad.images;
  if (Array.isArray(img)) return img[0];
  return img?.urls?.[0] ?? img?.url ?? img?.thumb_url;
}

function firstNumber(v: number | number[] | undefined): number | undefined {
  if (Array.isArray(v)) return toNumber(v[0]);
  return toNumber(v);
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
