"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULTS, MARKET, PROPERTY } from "./mock";
import { derive, scoreDeal, stats } from "./finance";
import type { Assumptions, Profile, Property } from "./types";
import type { ScrapeResult } from "./scraper/types";

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
  /** Replace the analysed property + seed assumptions from a scraped listing. */
  applyScrape: (result: ScrapeResult) => void;
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

  const applyScrape = useCallback((result: ScrapeResult) => {
    setProperty(result.property);
    setA((prev) => ({ ...prev, ...result.assumptions }));
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
    const rentPerM2 = stats(MARKET.rentComps.map((c) => c.rent / c.surface));
    const suggestedRent = Math.round((rentPerM2.median * a.surface) / 5) * 5;
    const priceVsComps =
      salePerM2.median > 0 ? (d.pricePerM2 / salePerM2.median - 1) * 100 : 0;
    const rentVsComps =
      suggestedRent > 0 ? (a.monthlyRent / suggestedRent - 1) * 100 : 0;
    return { salePerM2, salePrices, rentPerM2, suggestedRent, priceVsComps, rentVsComps };
  }, [a.surface, a.monthlyRent, d.pricePerM2]);

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
    applyScrape,
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
