"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { COMPARABLES, DEFAULTS, MARKET, PROPERTY, RENT_COMPARABLES } from "./mock";
import { derive, scoreDeal, stats } from "./finance";
import { startScrapeClient, pollScrapeClient, ScrapeClientError } from "./scrape-client";
import type { Assumptions, Comparable, Profile, Property } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3000;
const POLL_DEADLINE_MS = 240_000; // give up after ~4 min

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
  /**
   * Start scraping a listing URL. Resolves once the subject property is ready
   * (so the UI can advance); comparables keep loading in the background.
   */
  startScrape: (url: string) => Promise<void>;
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

  const comps = useMemo(() => {
    const salePerM2 = stats(MARKET.saleComps.map((c) => c.price / c.surface));
    const salePrices = stats(MARKET.saleComps.map((c) => c.price));
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
  }, [a.surface, a.monthlyRent, d.pricePerM2, rentComparables]);

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
    startScrape,
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
