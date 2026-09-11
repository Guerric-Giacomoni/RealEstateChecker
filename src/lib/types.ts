export type Verdict = "GOOD" | "BORDERLINE" | "BAD";

/** What the user wants to do with the property — drives which tabs matter. */
export type Profile = "residence" | "locatif";

/** Everything the user can tweak. Single source of truth shared by all tabs. */
export type Assumptions = {
  // --- Le bien ---
  purchasePrice: number;
  surface: number;
  agencyFees: number;
  notaryRatePct: number;
  /** Single all-in renovation budget (0 when no work is planned). */
  renovationBudget: number;

  // --- Financement ---
  /** false = achat comptant : pas de prêt, tout le projet sort de la poche. */
  usesLoan: boolean;
  downPayment: number;
  interestRate: number; // annual nominal %
  loanYears: number;
  insuranceRate: number; // % of initial capital, per year
  financeRenovation: boolean;

  // --- Exploitation locative ---
  monthlyRent: number;
  vacancyRate: number; // %
  managementFeePct: number; // % of collected rent
  propertyTax: number; // annual
  condoCharges: number; // annual, owner share
  landlordInsurance: number; // annual
  unpaidRentInsurancePct: number; // % of collected rent
  maintenancePct: number; // % of collected rent
  capexPct: number; // % of collected rent
  otherCosts: number; // annual

  // --- Projection ---
  rentGrowth: number; // %/yr
  expenseGrowth: number; // %/yr
  propertyAppreciation: number; // %/yr

  // --- Acheter ou louer ---
  currentRent: number;
  currentRentCharges: number;
  currentRentGrowth: number; // %/yr
  investmentReturn: number; // %/yr on capital kept invested
  sellingFeesPct: number;
  plannedStayYears: number;
  ownerMaintenancePct: number; // %/yr of property value, owner-occupier upkeep
};

/** A property currently listed for sale, from the SeLoger comparables search. */
export type Comparable = {
  id: string;
  url: string;
  address: string | null; // "district, city (zip)"
  price: number;
  surface: number; // living area, m²
  pricePerM2: number; // €/m²
  dpe: string | null;
  rooms: number | null;
};

/** A past sold transaction from DVF (Demandes de Valeurs Foncières). */
export type DvfComp = {
  id: string;
  soldOn: string; // ISO-ish "2025-MM-01"
  address: string; // "12 rue X, Ville" (may be empty)
  price: number;
  surface: number;
  pricePerM2: number;
  rooms: number | null;
  type: string; // "Appartement" | "Maison"
};

export type SaleComp = {
  id: string;
  date: string;
  price: number;
  surface: number;
  rooms: number;
  dpe: string | null;
  distance: number;
  type: string;
};

export type RentComp = {
  id: string;
  rent: number;
  surface: number;
  rooms: number;
  distance: number;
  listedOn: string;
  type: string;
};

export type Series = { label: string; value: number }[];

/** Energy characteristics read from the listing's DPE/GES block. */
export type PropertyEnergy = {
  condition: string | null; // e.g. "Entretenu"
  heatingSystem: string | null; // e.g. "Chauffage central"
  energySource: string | null; // e.g. "Gaz"
};

export type Property = {
  url: string;
  title: string;
  address: string;
  city: string;
  postalCode: string;
  askingPrice: number;
  surface: number;
  rooms: number;
  bedrooms: number;
  type: string;
  dpe: string;
  ges: string;
  floor: string;
  year: string;
  description: string;
  photo: string;
  /** Ad-declared features only (e.g. "Cave", "Balcon") — used for comparables. */
  features: string[];
  energy: PropertyEnergy;
  /**
   * SeLoger district geo code (e.g. "AD08FR4602"). Not displayed — used as the
   * location parameter when building comparable search URLs. Null when the
   * source doesn't provide it.
   */
  districtGeoId: string | null;
  /** INSEE commune code (e.g. "75056") — key for local INSEE statistics. */
  codeInsee: string | null;
  /** WGS84 coordinates — used for point-based Géorisques queries. */
  latitude: number | null;
  longitude: number | null;
  scrapedOn: string;
};

/** Natural-risk summary for a commune / location, from Géorisques (V1). */
export type GeoRisks = {
  communeRisks: string[];
  catnat: {
    total: number;
    byType: { label: string; count: number }[];
    events: { label: string; start: string; end: string; published: string }[];
  };
  flood: { communeRisk: boolean; catnatCount: number; atlasNearby: boolean };
  clay: { level: string | null };
  seismic: { level: string | null };
  reportUrl: string | null;
};

/** Delinquency statistics for a commune, from SSMSI (data.gouv). */
export type CrimeStats = {
  year: number;
  /** Composite "faits pour 1 000 habitants" — sum of the shown categories. */
  index: { commune: number; dept: number; france: number };
  /** Commune composite index per year. */
  history: { label: string; value: number }[];
  categories: {
    label: string;
    value: number; // commune rate /1000
    dept: number;
    france: number;
    trend: number; // commune YoY change, %
  }[];
};

/** Local INSEE (Melodi) statistics for a commune. */
export type MarketStats = {
  codeInsee: string;
  population: {
    latest: number;
    year: number;
    change5y: number | null;
    change10y: number | null;
    history: { label: string; value: number }[];
  };
  income: {
    median: number | null;
    year: number | null;
    france: number | null;
    vsFrancePct: number | null;
  };
  unemployment: { rate: number | null; year: number | null };
  housing: { vacancyRate: number | null; year: number | null };
  ageBands: { label: string; share: number }[];
};

export type MarketData = {
  saleComps: SaleComp[];
  rentComps: RentComp[];
  pricePerM2History: Series;
  rentPerM2History: Series;
  vacancyHistory: Series;
  populationHistory: Series;
  medianIncome: number;
  medianIncomeDept: number;
  unemployment: number;
  unemploymentDept: number;
  unemploymentFrance: number;
  population: number;
  populationGrowth5y: number;
  tenantShare: number;
  households: number;
  householdGrowth: number;
  transactionVolume: number;
  crime: {
    index: number;
    dept: number;
    france: number;
    categories: { label: string; value: number; dept: number; trend: number }[];
    history: Series;
  };
  amenities: { label: string; icon: string; within500: number; within1000: number }[];
  rentalDemand: { label: string; value: string; tone: "good" | "warn" | "bad" }[];
};
