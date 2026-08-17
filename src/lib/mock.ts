import type { Assumptions, MarketData, Property } from "./types";

/* Dummy data — stands in for the scraping + DVF + INSEE + rental APIs. */

export const PROPERTY: Property = {
  url: "https://www.leboncoin.fr/ventes_immobilieres/2481093746.htm",
  title: "Appartement 3 pièces — 65 m²",
  address: "14 rue de la Barillerie",
  city: "Le Mans",
  postalCode: "72000",
  askingPrice: 92000,
  surface: 65,
  rooms: 3,
  bedrooms: 2,
  type: "Appartement",
  dpe: "E",
  ges: "D",
  floor: "2e étage sur 4 — sans ascenseur",
  year: "1974",
  description:
    "Appartement traversant de 65 m² situé à proximité immédiate du tramway et des commerces. Séjour lumineux exposé sud, cuisine séparée, deux chambres, salle de bain à rafraîchir. Double vitrage posé en 2016, chauffage individuel gaz. Copropriété de 32 lots, sans procédure en cours. Travaux de rafraîchissement à prévoir, potentiel locatif intéressant compte tenu du secteur.",
  photo: "",
  features: ["Double vitrage", "Cave", "Cuisine séparée"],
  energy: {
    condition: "À rafraîchir",
    heatingSystem: "Chauffage individuel",
    energySource: "Gaz",
  },
  scrapedOn: "2026-08-05",
};

export const DEFAULTS: Assumptions = {
  // Le bien
  purchasePrice: 92000,
  surface: 65,
  agencyFees: 3500,
  notaryRatePct: 7.5,
  renovationBudget: 18000,

  // Financement
  usesLoan: true,
  downPayment: 35000,
  interestRate: 3.55,
  loanYears: 25,
  insuranceRate: 0.25,
  financeRenovation: true,

  // Exploitation
  monthlyRent: 745,
  vacancyRate: 8,
  managementFeePct: 7,
  propertyTax: 850,
  condoCharges: 700,
  landlordInsurance: 150,
  unpaidRentInsurancePct: 2.5,
  maintenancePct: 5,
  capexPct: 3,
  otherCosts: 100,

  // Projection
  rentGrowth: 1.8,
  expenseGrowth: 2.2,
  propertyAppreciation: 1.5,

  // Acheter ou louer
  currentRent: 560,
  currentRentCharges: 60,
  currentRentGrowth: 2,
  investmentReturn: 4,
  sellingFeesPct: 6,
  plannedStayYears: 8,
  ownerMaintenancePct: 0.8,
};

export const MARKET: MarketData = {
  saleComps: [
    { id: "s1", date: "2026-05-12", price: 92000, surface: 63, rooms: 3, dpe: "E", distance: 180, type: "Appartement" },
    { id: "s2", date: "2026-04-28", price: 78500, surface: 58, rooms: 3, dpe: "F", distance: 240, type: "Appartement" },
    { id: "s3", date: "2026-04-03", price: 104000, surface: 71, rooms: 4, dpe: "D", distance: 310, type: "Appartement" },
    { id: "s4", date: "2026-03-19", price: 86000, surface: 62, rooms: 3, dpe: "E", distance: 95, type: "Appartement" },
    { id: "s5", date: "2026-02-27", price: 118000, surface: 78, rooms: 4, dpe: "C", distance: 420, type: "Appartement" },
    { id: "s6", date: "2026-02-11", price: 71000, surface: 54, rooms: 2, dpe: "E", distance: 350, type: "Appartement" },
    { id: "s7", date: "2026-01-24", price: 97500, surface: 68, rooms: 3, dpe: "D", distance: 210, type: "Appartement" },
    { id: "s8", date: "2025-12-15", price: 83000, surface: 61, rooms: 3, dpe: null, distance: 480, type: "Appartement" },
    { id: "s9", date: "2025-11-30", price: 112000, surface: 74, rooms: 4, dpe: "D", distance: 530, type: "Appartement" },
    { id: "s10", date: "2025-11-08", price: 68000, surface: 51, rooms: 2, dpe: "F", distance: 160, type: "Appartement" },
    { id: "s11", date: "2025-10-21", price: 90000, surface: 66, rooms: 3, dpe: "E", distance: 290, type: "Appartement" },
    { id: "s12", date: "2025-09-17", price: 76000, surface: 57, rooms: 3, dpe: "E", distance: 610, type: "Appartement" },
    { id: "s13", date: "2025-08-29", price: 101000, surface: 70, rooms: 4, dpe: null, distance: 380, type: "Appartement" },
    { id: "s14", date: "2025-07-14", price: 64500, surface: 49, rooms: 2, dpe: "G", distance: 270, type: "Appartement" },
    { id: "s15", date: "2025-06-26", price: 95500, surface: 67, rooms: 3, dpe: "D", distance: 440, type: "Appartement" },
  ],

  rentComps: [
    { id: "r1", rent: 740, surface: 64, rooms: 3, distance: 140, listedOn: "2026-07-22", type: "Appartement" },
    { id: "r2", rent: 690, surface: 60, rooms: 3, distance: 220, listedOn: "2026-07-18", type: "Appartement" },
    { id: "r3", rent: 820, surface: 72, rooms: 4, distance: 310, listedOn: "2026-07-09", type: "Appartement" },
    { id: "r4", rent: 655, surface: 55, rooms: 2, distance: 190, listedOn: "2026-07-02", type: "Appartement" },
    { id: "r5", rent: 780, surface: 68, rooms: 3, distance: 260, listedOn: "2026-06-27", type: "Appartement" },
    { id: "r6", rent: 710, surface: 62, rooms: 3, distance: 90, listedOn: "2026-06-19", type: "Appartement" },
    { id: "r7", rent: 590, surface: 48, rooms: 2, distance: 340, listedOn: "2026-06-11", type: "Appartement" },
    { id: "r8", rent: 860, surface: 78, rooms: 4, distance: 470, listedOn: "2026-06-04", type: "Appartement" },
    { id: "r9", rent: 725, surface: 63, rooms: 3, distance: 200, listedOn: "2026-05-28", type: "Appartement" },
    { id: "r10", rent: 670, surface: 58, rooms: 3, distance: 520, listedOn: "2026-05-16", type: "Appartement" },
    { id: "r11", rent: 795, surface: 70, rooms: 3, distance: 380, listedOn: "2026-05-07", type: "Appartement" },
    { id: "r12", rent: 640, surface: 54, rooms: 2, distance: 240, listedOn: "2026-04-25", type: "Appartement" },
    { id: "r13", rent: 750, surface: 66, rooms: 3, distance: 160, listedOn: "2026-04-14", type: "Appartement" },
    { id: "r14", rent: 700, surface: 61, rooms: 3, distance: 430, listedOn: "2026-04-02", type: "Appartement" },
    { id: "r15", rent: 840, surface: 75, rooms: 4, distance: 290, listedOn: "2026-03-21", type: "Appartement" },
  ],

  pricePerM2History: [
    { label: "2016", value: 1140 },
    { label: "2017", value: 1180 },
    { label: "2018", value: 1215 },
    { label: "2019", value: 1260 },
    { label: "2020", value: 1305 },
    { label: "2021", value: 1420 },
    { label: "2022", value: 1495 },
    { label: "2023", value: 1470 },
    { label: "2024", value: 1425 },
    { label: "2025", value: 1398 },
    { label: "2026", value: 1385 },
  ],

  rentPerM2History: [
    { label: "2019", value: 9.9 },
    { label: "2020", value: 10.1 },
    { label: "2021", value: 10.4 },
    { label: "2022", value: 10.8 },
    { label: "2023", value: 11.2 },
    { label: "2024", value: 11.4 },
    { label: "2025", value: 11.6 },
    { label: "2026", value: 11.8 },
  ],

  vacancyHistory: [
    { label: "2019", value: 9.4 },
    { label: "2020", value: 9.1 },
    { label: "2021", value: 8.8 },
    { label: "2022", value: 8.4 },
    { label: "2023", value: 8.1 },
    { label: "2024", value: 7.9 },
    { label: "2025", value: 7.8 },
    { label: "2026", value: 7.6 },
  ],

  populationHistory: [
    { label: "2013", value: 143240 },
    { label: "2015", value: 143599 },
    { label: "2017", value: 143252 },
    { label: "2019", value: 143813 },
    { label: "2021", value: 145229 },
    { label: "2023", value: 146105 },
    { label: "2025", value: 146980 },
  ],

  medianIncome: 21340,
  medianIncomeDept: 22180,
  unemployment: 8.9,
  unemploymentDept: 7.4,
  unemploymentFrance: 7.3,
  population: 146980,
  populationGrowth5y: 2.2,
  tenantShare: 58,
  households: 74200,
  householdGrowth: 0.7,
  transactionVolume: 1842,

  crime: {
    index: 54,
    dept: 41,
    france: 46,
    categories: [
      { label: "Cambriolages", value: 6.1, dept: 4.2, trend: -3.4 },
      { label: "Vols sans violence", value: 14.8, dept: 9.6, trend: 1.9 },
      { label: "Coups et blessures", value: 8.2, dept: 6.4, trend: 4.1 },
      { label: "Vols de véhicules", value: 3.4, dept: 2.6, trend: -1.2 },
      { label: "Dégradations", value: 11.3, dept: 8.9, trend: 0.4 },
    ],
    history: [
      { label: "2021", value: 51 },
      { label: "2022", value: 53 },
      { label: "2023", value: 56 },
      { label: "2024", value: 55 },
      { label: "2025", value: 54 },
    ],
  },

  amenities: [
    { label: "Restaurants", icon: "🍽️", within500: 18, within1000: 47 },
    { label: "Cafés / bars", icon: "☕", within500: 11, within1000: 26 },
    { label: "Supermarchés", icon: "🛒", within500: 3, within1000: 7 },
    { label: "Boulangeries", icon: "🥖", within500: 5, within1000: 12 },
    { label: "Commerces", icon: "🏪", within500: 34, within1000: 88 },
    { label: "Écoles", icon: "🎓", within500: 4, within1000: 9 },
    { label: "Pharmacies", icon: "💊", within500: 2, within1000: 6 },
    { label: "Transports", icon: "🚊", within500: 6, within1000: 14 },
  ],

  rentalDemand: [
    { label: "Tension locative", value: "Élevée", tone: "good" },
    { label: "Délai moyen de relocation", value: "18 jours", tone: "good" },
    { label: "Candidats par annonce", value: "9,4", tone: "good" },
    { label: "Part de locataires", value: "58 %", tone: "good" },
    { label: "Population étudiante", value: "12 400", tone: "good" },
    { label: "Vacance structurelle", value: "7,6 %", tone: "warn" },
  ],
};

/** Rolling 12-month sparkline series used inside the KPI cards. */
export function sparkFor(seed: number, points = 14): number[] {
  const out: number[] = [];
  let v = 50;
  let s = seed;
  for (let i = 0; i < points; i++) {
    s = (s * 9301 + 49297) % 233280;
    v += (s / 233280 - 0.45) * 14;
    out.push(v);
  }
  return out;
}
