"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { COMPARABLES, DEFAULTS, MARKET, PROPERTY, RENT_COMPARABLES } from "./mock";
import { derive, scoreDeal, stats } from "./finance";
import { startScrapeClient, pollScrapeClient, ScrapeClientError } from "./scrape-client";
import type {
  Assumptions,
  Comparable,
  CrimeStats,
  DvfComp,
  GeoRisks,
  MarketStats,
  PriceHistory,
  Profile,
  Property,
} from "./types";

type Commune = { code: string; lat: number | null; lon: number | null };

/** Resolve INSEE code + centroid from a postal code (+ city, to disambiguate). */
async function resolveCommune(postalCode: string, city: string): Promise<Commune | null> {
  try {
    const res = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,code,centre&limit=20`,
    );
    if (!res.ok) return null;
    const communes: { nom: string; code: string; centre?: { coordinates: [number, number] } }[] =
      await res.json();
    if (communes.length === 0) return null;
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const c = communes.find((x) => norm(x.nom) === norm(city)) ?? communes[0];
    const [lon, lat] = c.centre?.coordinates ?? [null, null];
    return { code: c.code, lat, lon };
  } catch {
    return null;
  }
}

async function resolveCodeInsee(postalCode: string, city: string): Promise<string | null> {
  return (await resolveCommune(postalCode, city))?.code ?? null;
}

/** Fetch Géorisques natural-risk summary for a commune + point. */
async function fetchRisks(code: string, lat: number, lon: number): Promise<GeoRisks | null> {
  try {
    const res = await fetch(`/api/georisques?codeInsee=${code}&lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch INSEE market statistics for a commune code. */
async function fetchMarketStats(code: string): Promise<MarketStats | null> {
  try {
    const res = await fetch(`/api/insee/${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch SSMSI delinquency statistics for a commune code. */
async function fetchCrime(code: string): Promise<CrimeStats | null> {
  try {
    const res = await fetch(`/api/crime/${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch yearly average €/m² (DVF indicators) for a commune code. */
async function fetchPriceHistory(code: string): Promise<PriceHistory | null> {
  try {
    const res = await fetch(`/api/prices/${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch real past-sold comparables (DVF) — by radius around a point if given,
 *  else across the whole postal code. */
async function fetchDvfComps(
  cp: string,
  type: string,
  surface: number,
  point?: { lat: number; lon: number; radiusKm: number },
): Promise<DvfComp[]> {
  try {
    const qs = point
      ? `lat=${point.lat}&lon=${point.lon}&radius=${point.radiusKm}&type=${encodeURIComponent(type)}`
      : `cp=${cp}&type=${encodeURIComponent(type)}&surface=${surface}`;
    const res = await fetch(`/api/dvf/comparables?${qs}`);
    if (!res.ok) return [];
    return (await res.json()).comps ?? [];
  } catch {
    return [];
  }
}

/** Geocode a free-text address via the Base Adresse Nationale (keyless, CORS). */
async function geocodeAddress(
  query: string,
): Promise<{ label: string; lat: number; lon: number; postcode?: string; city?: string } | null> {
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`,
    );
    if (!res.ok) return null;
    const f = (await res.json()).features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    return {
      label: f.properties.label,
      lat,
      lon,
      postcode: f.properties.postcode,
      city: f.properties.city,
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_DEADLINE_MS = 240_000; // give up after ~4 min

/** Broad house detection — villa, chalet, mas… count as houses, not flats. */
const isHouseType = (type: string) =>
  /maison|villa|ch[aâ]let|\bmas\b|ferme|propri[ée]t[ée]|pavillon|long[èe]re|manoir|b[aâ]tisse/i.test(
    type || "",
  );

/** Fields the user types in when the URL import can't be used. */
export type ManualEntry = {
  type: string; // "Appartement" | "Maison"
  price: number; // asking price, FAI or hors honoraires per feesIncluded
  feesIncluded: boolean; // true = frais d'agence inclus
  surface: number;
  city: string;
  postalCode: string;
  department?: string;
  codeInsee?: string;
  rooms?: number;
};

type Ctx = {
  a: Assumptions;
  set: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
  patch: (p: Partial<Assumptions>) => void;
  reset: () => void;
  dirty: boolean;
  d: ReturnType<typeof derive>;

  /** Onboarding */
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  onboarded: boolean;
  finishOnboarding: (p: Profile, patch: Partial<Assumptions>) => void;
  restartOnboarding: () => void;
  /** The user asked to also see the analysis for the other profile. */
  showOther: boolean;
  setShowOther: (v: boolean) => void;

  market: typeof MARKET;
  property: Property;
  /** Currently-listed comparable properties (SeLoger). */
  comparables: Comparable[];
  /** True while the comparables search is still running in the background. */
  comparablesLoading: boolean;
  /** Currently-listed rental comparables (SeLoger). */
  rentComparables: Comparable[];
  /** True while the rent comparables search is still running. */
  rentComparablesLoading: boolean;
  /** Past sold comparables (DVF) for the property's postal code / radius. */
  saleComps: DvfComp[];
  /** True while the DVF lookup is in flight. */
  saleCompsLoading: boolean;
  /** Radius (km) around the exact address for DVF comps; null = whole postal code. */
  radiusKm: number | null;
  setRadiusKm: (v: number | null) => void;
  /** Geocode + set the exact address (adds the subject pin, enables radius). */
  setExactAddress: (query: string) => Promise<{ lat: number; lon: number } | null>;
  /** Local INSEE statistics (population, income…) for the commune; null until loaded. */
  marketStats: MarketStats | null;
  /** True while the INSEE lookup is in flight. */
  marketLoading: boolean;
  /** SSMSI delinquency statistics for the commune; null until loaded / unavailable. */
  crime: CrimeStats | null;
  /** True while the SSMSI lookup is in flight. */
  crimeLoading: boolean;
  /** Yearly average €/m² (DVF indicators) for the commune; null until loaded. */
  priceHistory: PriceHistory | null;
  /** True while the price-history lookup is in flight. */
  priceLoading: boolean;
  /** Géorisques natural-risk summary for the property; null until loaded. */
  risks: GeoRisks | null;
  /** True while the Géorisques lookup is in flight. */
  risksLoading: boolean;
  /**
   * Start scraping a listing URL. Resolves once the subject property is ready
   * (so the UI can advance); comparables keep loading in the background.
   */
  startScrape: (url: string) => Promise<void>;
  /** Populate the analysis from manually-typed data (no scrape, no comparables). */
  applyManualEntry: (entry: ManualEntry) => void;
  comps: {
    salePerM2: ReturnType<typeof stats>;
    salePrices: ReturnType<typeof stats>;
    rentPerM2: ReturnType<typeof stats>;
    suggestedRent: number;
    priceVsComps: number;
    rentVsComps: number;
  };
  scoring: ReturnType<typeof scoreDeal>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [a, setA] = useState<Assumptions>(DEFAULTS);
  // Snapshot of the assumptions as first established (onboarding + the loaded
  // listing). "Réinitialiser" restores this, not the demo defaults.
  const [baseline, setBaseline] = useState<Assumptions>(DEFAULTS);
  const [property, setProperty] = useState<Property>(PROPERTY);
  const [comparables, setComparables] = useState<Comparable[]>(COMPARABLES);
  const [comparablesLoading, setComparablesLoading] = useState(false);
  const [rentComparables, setRentComparables] = useState<Comparable[]>(RENT_COMPARABLES);
  const [rentComparablesLoading, setRentComparablesLoading] = useState(false);
  const [saleComps, setSaleComps] = useState<DvfComp[]>([]);
  const [saleCompsLoading, setSaleCompsLoading] = useState(false);
  // null = whole postal code; a number = radius (km) around the exact address.
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [crime, setCrime] = useState<CrimeStats | null>(null);
  const [crimeLoading, setCrimeLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [risks, setRisks] = useState<GeoRisks | null>(null);
  const [risksLoading, setRisksLoading] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const set = useCallback(
    <K extends keyof Assumptions>(key: K, value: Assumptions[K]) =>
      setA((prev) => ({ ...prev, [key]: value })),
    [],
  );
  const patch = useCallback((p: Partial<Assumptions>) => setA((prev) => ({ ...prev, ...p })), []);
  const reset = useCallback(() => setA(baseline), [baseline]);

  // Geocode a free-text address (Base Adresse Nationale) and set it as the
  // subject location — adds the map pin and enables radius-based comparables.
  const setExactAddress = useCallback(async (query: string) => {
    const g = await geocodeAddress(query);
    if (!g) return null;
    setProperty((prev) => ({ ...prev, address: g.label, latitude: g.lat, longitude: g.lon }));
    return { lat: g.lat, lon: g.lon };
  }, []);

  const startScrape = useCallback((rawUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      let subjectApplied = false;
      let settled = false;

      const applySubject = (p: Property, assumptions: Partial<Assumptions>) => {
        subjectApplied = true;
        setProperty(p);
        const applied = { ...assumptions, isHouse: isHouseType(p.type) };
        setA((prev) => ({ ...prev, ...applied }));
        setBaseline((prev) => ({ ...prev, ...applied })); // this is the reset target
        if (!settled) {
          settled = true;
          resolve(); // subject is ready — the UI can advance
        }
      };
      const stopLoading = () => {
        setComparablesLoading(false);
        setRentComparablesLoading(false);
      };
      const fail = (e: unknown) => {
        stopLoading();
        if (!settled) {
          settled = true;
          reject(e);
        }
      };

      (async () => {
        setComparables([]); // clear any stale/demo comparables
        setRentComparables([]);
        try {
          const { runId, datasetId, source } = await startScrapeClient(rawUrl);
          setComparablesLoading(source === "seloger");
          setRentComparablesLoading(source === "seloger");
          const deadline = Date.now() + POLL_DEADLINE_MS;

          // The run pushes records in order: subject → sale comps → rent comps.
          // Apply the subject immediately, then keep polling until the run ends
          // so both comparable sets fill in.
          for (;;) {
            const poll = await pollScrapeClient(runId, datasetId, source, rawUrl).catch((e) => {
              // Tolerate a transient poll hiccup unless we're out of time.
              if (Date.now() > deadline) throw e;
              return null;
            });

            if (poll) {
              if (poll.property && !subjectApplied) applySubject(poll.property, poll.assumptions ?? {});
              if (poll.comparables.length) {
                setComparables(poll.comparables);
                setComparablesLoading(false);
              }
              if (poll.rentComparables.length) {
                setRentComparables(poll.rentComparables);
                setRentComparablesLoading(false);
              }
              if (poll.done) {
                setComparables(poll.comparables);
                setRentComparables(poll.rentComparables);
                stopLoading();
                if (!subjectApplied) {
                  throw new ScrapeClientError(
                    "L'annonce n'a pas pu être récupérée (protégée ou indisponible).",
                  );
                }
                return; // run finished
              }
            }

            if (Date.now() > deadline) {
              stopLoading();
              if (!subjectApplied) {
                throw new ScrapeClientError("Le scraping a dépassé le délai d'attente. Réessayez.");
              }
              return; // subject is shown; give up waiting on comparables
            }
            await sleep(POLL_INTERVAL_MS);
          }
        } catch (e) {
          fail(e);
        }
      })();
    });
  }, []);

  const applyManualEntry = useCallback((entry: ManualEntry) => {
    setProperty({
      url: "",
      title: `${entry.type} — ${entry.surface} m²`,
      address: "",
      city: entry.city,
      postalCode: entry.postalCode,
      askingPrice: entry.price,
      surface: entry.surface,
      rooms: entry.rooms ?? 0,
      bedrooms: 0,
      type: entry.type,
      dpe: "—",
      ges: "—",
      floor: "",
      year: "",
      description: "",
      photo: "",
      features: [],
      energy: { condition: null, heatingSystem: null, energySource: null },
      districtGeoId: null,
      codeInsee: entry.codeInsee ?? null,
      latitude: null,
      longitude: null,
      scrapedOn: new Date().toISOString().slice(0, 10),
    });
    // No comparables for a manual entry — clear the demo rows so the tables
    // show their honest empty state rather than mismatched listings.
    setComparables([]);
    setRentComparables([]);
    setComparablesLoading(false);
    setRentComparablesLoading(false);
    // Frais d'agence inclus → fees already in the price; hors honoraires → add
    // a ~5% estimate the user can adjust in Hypothèses.
    const agencyFees = entry.feesIncluded ? 0 : Math.round(entry.price * 0.05);
    const entryValues = {
      purchasePrice: entry.price,
      surface: entry.surface,
      agencyFees,
      isHouse: isHouseType(entry.type),
    };
    setA((prev) => ({ ...prev, ...entryValues }));
    setBaseline((prev) => ({ ...prev, ...entryValues })); // reset target
  }, []);

  const finishOnboarding = useCallback((p: Profile, values: Partial<Assumptions>) => {
    setProfileState(p);
    setA((prev) => ({ ...prev, ...values }));
    setBaseline((prev) => ({ ...prev, ...values })); // fold into the reset target
    setOnboarded(true);
  }, []);

  const restartOnboarding = useCallback(() => {
    setOnboarded(false);
    setShowOther(false);
  }, []);

  const dirty = useMemo(
    () => (Object.keys(baseline) as (keyof Assumptions)[]).some((k) => a[k] !== baseline[k]),
    [a, baseline],
  );

  const d = useMemo(() => derive(a), [a]);

  // Pull real DVF sold comparables. Radius mode (around the exact address) when
  // a radius + coordinates are set, otherwise the whole postal code.
  useEffect(() => {
    const cp = property.postalCode;
    const lat = property.latitude;
    const lon = property.longitude;
    const useRadius = radiusKm != null && lat != null && lon != null;
    const t = setTimeout(() => {
      if (!useRadius && !/^\d{5}$/.test(cp || "")) {
        setSaleComps([]);
        setSaleCompsLoading(false);
        return;
      }
      setSaleCompsLoading(true);
      const point = useRadius ? { lat: lat!, lon: lon!, radiusKm: radiusKm! } : undefined;
      fetchDvfComps(cp, property.type, a.surface, point).then((rows) => {
        setSaleComps(rows);
        setSaleCompsLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [property.postalCode, property.type, a.surface, property.latitude, property.longitude, radiusKm]);

  // Local INSEE stats: resolve the commune's INSEE code (from the property or
  // its postal code + city) then fetch population + income.
  useEffect(() => {
    let cancelled = false;
    const codeInsee = property.codeInsee;
    const postalCode = property.postalCode;
    const city = property.city;
    (async () => {
      const code = codeInsee ?? (postalCode ? await resolveCodeInsee(postalCode, city) : null);
      if (cancelled) return;
      if (!code) {
        setMarketStats(null);
        setMarketLoading(false);
        setCrime(null);
        setCrimeLoading(false);
        setPriceHistory(null);
        setPriceLoading(false);
        return;
      }
      setMarketLoading(true);
      setCrimeLoading(true);
      setPriceLoading(true);
      fetchMarketStats(code).then((stats) => {
        if (cancelled) return;
        setMarketStats(stats);
        setMarketLoading(false);
      });
      fetchCrime(code).then((c) => {
        if (cancelled) return;
        setCrime(c);
        setCrimeLoading(false);
      });
      fetchPriceHistory(code).then((p) => {
        if (cancelled) return;
        setPriceHistory(p);
        setPriceLoading(false);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [property.codeInsee, property.postalCode, property.city]);

  // Géorisques: resolve the commune code + a point (property coords, else the
  // commune centroid) then fetch the natural-risk summary.
  useEffect(() => {
    let cancelled = false;
    const codeInsee = property.codeInsee;
    const lat0 = property.latitude;
    const lon0 = property.longitude;
    const postalCode = property.postalCode;
    const city = property.city;
    (async () => {
      let code = codeInsee;
      let lat = lat0;
      let lon = lon0;
      if ((!code || lat == null || lon == null) && postalCode) {
        const c = await resolveCommune(postalCode, city);
        code = code ?? c?.code ?? null;
        lat = lat ?? c?.lat ?? null;
        lon = lon ?? c?.lon ?? null;
      }
      if (cancelled) return;
      if (!code || lat == null || lon == null) {
        setRisks(null);
        setRisksLoading(false);
        return;
      }
      setRisksLoading(true);
      const r = await fetchRisks(code, lat, lon);
      if (!cancelled) {
        setRisks(r);
        setRisksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [property.codeInsee, property.latitude, property.longitude, property.postalCode, property.city]);

  const comps = useMemo(() => {
    // Sale stats come from real DVF sold transactions when available, else mock.
    const saleSource =
      saleComps.length > 0
        ? saleComps.map((c) => ({ price: c.price, surface: c.surface }))
        : MARKET.saleComps;
    const salePerM2 = stats(saleSource.map((c) => c.price / c.surface));
    const salePrices = stats(saleSource.map((c) => c.price));
    // Rent stats come from scraped rental comparables when we have them
    // (price = monthly rent, pricePerM2 = rent/m²), else the mock market.
    const rentPerM2Values =
      rentComparables.length > 0
        ? rentComparables.map((c) => c.pricePerM2).filter((v) => v > 0)
        : MARKET.rentComps.map((c) => c.rent / c.surface);
    const rentPerM2 = stats(rentPerM2Values);
    const suggestedRent = Math.round((rentPerM2.median * a.surface) / 5) * 5;
    const priceVsComps =
      salePerM2.median > 0 ? (d.pricePerM2 / salePerM2.median - 1) * 100 : 0;
    const rentVsComps =
      suggestedRent > 0 ? (a.monthlyRent / suggestedRent - 1) * 100 : 0;
    return { salePerM2, salePrices, rentPerM2, suggestedRent, priceVsComps, rentVsComps };
  }, [a.surface, a.monthlyRent, d.pricePerM2, rentComparables, saleComps]);

  const scoring = useMemo(
    () =>
      scoreDeal(d, a, {
        priceVsComps: comps.priceVsComps,
        localVacancy: MARKET.vacancyHistory[MARKET.vacancyHistory.length - 1].value,
        marketHealth: 62, // composite of population growth / income / demand
      }),
    [d, a, comps.priceVsComps],
  );

  const value: Ctx = {
    a, set, patch, reset, dirty, d,
    profile,
    setProfile: setProfileState,
    onboarded,
    finishOnboarding,
    restartOnboarding,
    showOther,
    setShowOther,
    market: MARKET,
    property,
    comparables,
    comparablesLoading,
    rentComparables,
    rentComparablesLoading,
    saleComps,
    saleCompsLoading,
    radiusKm,
    setRadiusKm,
    setExactAddress,
    marketStats,
    marketLoading,
    crime,
    crimeLoading,
    priceHistory,
    priceLoading,
    risks,
    risksLoading,
    startScrape,
    applyManualEntry,
    comps,
    scoring,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
