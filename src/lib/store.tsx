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
  DvfComp,
  GeoRisks,
  MarketStats,
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

/** Fetch real past-sold comparables (DVF) for a postal code + type + surface. */
async function fetchDvfComps(cp: string, type: string, surface: number): Promise<DvfComp[]> {
  try {
    const res = await fetch(
      `/api/dvf/comparables?cp=${cp}&type=${encodeURIComponent(type)}&surface=${surface}`,
    );
    if (!res.ok) return [];
    return (await res.json()).comps ?? [];
  } catch {
    return [];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_DEADLINE_MS = 240_000; // give up after ~4 min

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
  /** Past sold comparables (DVF) for the property's postal code. */
  saleComps: DvfComp[];
  /** True while the DVF lookup is in flight. */
  saleCompsLoading: boolean;
  /** Local INSEE statistics (population, income…) for the commune; null until loaded. */
  marketStats: MarketStats | null;
  /** True while the INSEE lookup is in flight. */
  marketLoading: boolean;
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
  const [property, setProperty] = useState<Property>(PROPERTY);
  const [comparables, setComparables] = useState<Comparable[]>(COMPARABLES);
  const [comparablesLoading, setComparablesLoading] = useState(false);
  const [rentComparables, setRentComparables] = useState<Comparable[]>(RENT_COMPARABLES);
  const [rentComparablesLoading, setRentComparablesLoading] = useState(false);
  const [saleComps, setSaleComps] = useState<DvfComp[]>([]);
  const [saleCompsLoading, setSaleCompsLoading] = useState(false);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
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
  const reset = useCallback(() => setA(DEFAULTS), []);

  const startScrape = useCallback((rawUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      let subjectApplied = false;
      let settled = false;

      const applySubject = (p: Property, assumptions: Partial<Assumptions>) => {
        subjectApplied = true;
        setProperty(p);
        setA((prev) => ({ ...prev, ...assumptions }));
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
    setA((prev) => ({
      ...prev,
      purchasePrice: entry.price,
      surface: entry.surface,
      agencyFees,
    }));
  }, []);

  const finishOnboarding = useCallback((p: Profile, values: Partial<Assumptions>) => {
    setProfileState(p);
    setA((prev) => ({ ...prev, ...values }));
    setOnboarded(true);
  }, []);

  const restartOnboarding = useCallback(() => {
    setOnboarded(false);
    setShowOther(false);
  }, []);

  const dirty = useMemo(
    () => (Object.keys(DEFAULTS) as (keyof Assumptions)[]).some((k) => a[k] !== DEFAULTS[k]),
    [a],
  );

  const d = useMemo(() => derive(a), [a]);

  // Pull real DVF sold comparables whenever the property's postal code / type
  // changes (also on surface edits — the query is a fast local SQLite lookup).
  useEffect(() => {
    const cp = property.postalCode;
    const t = setTimeout(() => {
      if (!/^\d{5}$/.test(cp || "")) {
        setSaleComps([]);
        setSaleCompsLoading(false);
        return;
      }
      setSaleCompsLoading(true);
      fetchDvfComps(cp, property.type, a.surface).then((rows) => {
        setSaleComps(rows);
        setSaleCompsLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [property.postalCode, property.type, a.surface]);

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
        return;
      }
      setMarketLoading(true);
      const stats = await fetchMarketStats(code);
      if (!cancelled) {
        setMarketStats(stats);
        setMarketLoading(false);
      }
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
    marketStats,
    marketLoading,
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
