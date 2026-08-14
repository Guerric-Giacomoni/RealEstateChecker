import type { Property } from "../types";
import { ScrapeError, type ScrapeResult } from "./types";

/**
 * Map one dataset item from the SeLoger actor into our Property.
 *
 * The actor's output field names aren't documented, so we probe the common
 * spellings for each field (title/name, price, surface/area, city/zipCode,
 * energyClass/dpe…) and record a warning for anything we couldn't find. Once we
 * see a real payload this can be tightened to the exact keys.
 */
export function mapSelogerItem(raw: unknown, url: string): ScrapeResult {
  if (!raw || typeof raw !== "object") {
    throw new ScrapeError("Annonce SeLoger vide ou illisible.", "parse_failed");
  }
  const item = raw as Record<string, unknown>;
  const warnings: string[] = [];

  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = deepGet(item, k);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const need = <T>(value: T | undefined, label: string, fallback: T): T => {
    if (value === undefined) {
      warnings.push(label);
      return fallback;
    }
    return value;
  };

  const price = toNumber(pick("price", "priceValue", "prix", "sellingPrice"));
  const surface = toNumber(pick("surface", "surfaceArea", "livingArea", "area", "surfaceValue"));
  const rooms = toNumber(pick("rooms", "roomsCount", "nbRooms", "roomCount", "pieces"));
  const bedrooms = toNumber(pick("bedrooms", "bedroomsCount", "nbBedrooms", "chambres"));
  const city = toStr(pick("city", "cityLabel", "town", "ville", "cityName"));
  const postalCode = toStr(pick("zipCode", "postalCode", "zipcode", "cp"));
  const dpe = toStr(pick("dpe", "energyClass", "energyRate", "dpeLetter", "energy"));
  const ges = toStr(pick("ges", "gesClass", "gesRate", "greenhouseGasEmission", "gesLetter"));
  const type = toStr(pick("propertyType", "estateType", "type", "typeLabel", "propertySubType"));
  const floor = toStr(pick("floor", "floorNumber", "etage"));
  const year = toStr(pick("constructionYear", "buildYear", "yearBuilt", "anneeConstruction"));

  const property: Property = {
    url: toStr(pick("url", "link")) ?? url,
    title: need(toStr(pick("title", "name", "titre", "headline")), "titre", "Annonce SeLoger"),
    address: toStr(pick("address", "addressLabel", "adresse")) ?? "",
    city: need(city, "ville", ""),
    postalCode: need(postalCode, "code postal", ""),
    askingPrice: need(price, "prix", 0),
    surface: need(surface, "surface", 0),
    rooms: rooms ?? 0,
    bedrooms: bedrooms ?? 0,
    type: type ?? "Bien",
    dpe: (dpe ?? "").toUpperCase() || "—",
    ges: (ges ?? "").toUpperCase() || "—",
    floor: floor ?? "",
    year: year ?? "",
    description: toStr(pick("description", "body", "text")) ?? "",
    photo: firstImage(pick("images", "photos", "pictures", "media")) ?? "",
    scrapedOn: new Date().toISOString().slice(0, 10),
  };

  const assumptions: ScrapeResult["assumptions"] = {};
  if (property.askingPrice > 0) assumptions.purchasePrice = property.askingPrice;
  if (property.surface > 0) assumptions.surface = property.surface;

  return { source: "seloger", property, assumptions, warnings };
}

/* ------------------------------------------------------------------ */

/** Look up `key` at the top level, else one level down inside nested objects. */
function deepGet(obj: Record<string, unknown>, key: string): unknown {
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = (v as Record<string, unknown>)[key];
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function firstImage(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const first = v[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return toStr(o.url ?? o.src ?? o.href);
    }
  }
  return undefined;
}

function toStr(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
