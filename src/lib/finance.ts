import type { Assumptions, Verdict } from "./types";

/* ------------------------------------------------------------------ */
/* Loan maths                                                          */
/* ------------------------------------------------------------------ */

export function monthlyPrincipalInterest(
  principal: number,
  annualRatePct: number,
  years: number,
): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Outstanding capital after `months` payments. */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  years: number,
  months: number,
): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  const m = Math.min(months, n);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.max(0, principal * (1 - m / n));
  const pay = monthlyPrincipalInterest(principal, annualRatePct, years);
  const bal = principal * Math.pow(1 + r, m) - pay * ((Math.pow(1 + r, m) - 1) / r);
  return Math.max(0, bal);
}

/** Interest paid between two month indices. */
export function interestBetween(
  principal: number,
  annualRatePct: number,
  years: number,
  fromMonth: number,
  toMonth: number,
): number {
  const pay = monthlyPrincipalInterest(principal, annualRatePct, years);
  const n = Math.min(toMonth, years * 12) - fromMonth;
  if (n <= 0) return 0;
  const b0 = remainingBalance(principal, annualRatePct, years, fromMonth);
  const b1 = remainingBalance(principal, annualRatePct, years, toMonth);
  return pay * n - (b0 - b1);
}

/* ------------------------------------------------------------------ */
/* Full derivation from the shared assumptions                         */
/* ------------------------------------------------------------------ */

export type Derived = ReturnType<typeof derive>;

export function derive(a: Assumptions) {
  /* --- Acquisition --- */
  const notaryFees = a.purchasePrice * (a.notaryRatePct / 100);
  const renovation = a.renovationBudget;
  const renovationPerM2 = a.surface > 0 ? renovation / a.surface : 0;
  const acquisitionCost = a.purchasePrice + notaryFees + a.agencyFees;
  const totalProject = acquisitionCost + renovation;
  const pricePerM2 = a.surface > 0 ? a.purchasePrice / a.surface : 0;
  const allInPerM2 = a.surface > 0 ? totalProject / a.surface : 0;

  /* --- Financement --- */
  const financedBase = a.financeRenovation ? totalProject : acquisitionCost;
  const loanAmount = a.usesLoan ? Math.max(0, financedBase - a.downPayment) : 0;
  const monthlyPI = monthlyPrincipalInterest(loanAmount, a.interestRate, a.loanYears);
  const monthlyInsurance = (loanAmount * (a.insuranceRate / 100)) / 12;
  const monthlyPayment = monthlyPI + monthlyInsurance;
  const annualDebtService = monthlyPayment * 12;
  const totalPaid = monthlyPayment * a.loanYears * 12;
  const totalInterest = monthlyPI * a.loanYears * 12 - loanAmount;
  const totalInsurance = monthlyInsurance * a.loanYears * 12;
  const totalCreditCost = totalPaid - loanAmount;
  const cashInvested = Math.max(0, totalProject - loanAmount);

  /* --- Exploitation --- */
  const annualRent = a.monthlyRent * 12;
  const collectedRent = annualRent * (1 - a.vacancyRate / 100);

  const mgmtFees = collectedRent * (a.managementFeePct / 100);
  const unpaidRentInsurance = collectedRent * (a.unpaidRentInsurancePct / 100);
  const maintenance = collectedRent * (a.maintenancePct / 100);
  const capex = collectedRent * (a.capexPct / 100);

  const fixedOpex =
    a.propertyTax + a.condoCharges + a.landlordInsurance + a.otherCosts;
  const variableRate =
    (a.managementFeePct + a.unpaidRentInsurancePct + a.maintenancePct + a.capexPct) /
    100;
  const variableOpex = mgmtFees + unpaidRentInsurance + maintenance + capex;
  const totalOpex = fixedOpex + variableOpex;

  const noi = collectedRent - totalOpex;
  const annualCashFlow = noi - annualDebtService;
  const monthlyCashFlow = annualCashFlow / 12;

  const grossYield = totalProject > 0 ? (annualRent / totalProject) * 100 : 0;
  const grossYieldOnPrice = a.purchasePrice > 0 ? (annualRent / a.purchasePrice) * 100 : 0;
  const netYield = totalProject > 0 ? (noi / totalProject) * 100 : 0;
  const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;

  // Occupancy at which NOI exactly covers debt service.
  const breakEvenOccupancy =
    annualRent > 0
      ? ((fixedOpex + annualDebtService) / (annualRent * (1 - variableRate))) * 100
      : Infinity;

  // Rent at which cash flow is exactly zero, at the assumed occupancy.
  const breakEvenRent =
    (fixedOpex + annualDebtService) /
    (12 * (1 - a.vacancyRate / 100) * (1 - variableRate));

  const opexBreakdown = [
    { label: "Taxe foncière", value: a.propertyTax },
    { label: "Charges de copropriété", value: a.condoCharges },
    { label: "Assurance PNO", value: a.landlordInsurance },
    { label: "Assurance loyers impayés", value: unpaidRentInsurance },
    { label: "Frais de gestion", value: mgmtFees },
    { label: "Entretien", value: maintenance },
    { label: "Provision travaux (CAPEX)", value: capex },
    { label: "Autres charges", value: a.otherCosts },
  ];

  return {
    notaryFees,
    renovation,
    renovationPerM2,
    acquisitionCost,
    totalProject,
    pricePerM2,
    allInPerM2,
    loanAmount,
    monthlyPI,
    monthlyInsurance,
    monthlyPayment,
    annualDebtService,
    totalInterest,
    totalInsurance,
    totalCreditCost,
    cashInvested,
    annualRent,
    collectedRent,
    fixedOpex,
    variableOpex,
    totalOpex,
    opexBreakdown,
    noi,
    annualCashFlow,
    monthlyCashFlow,
    grossYield,
    grossYieldOnPrice,
    netYield,
    cashOnCash,
    dscr,
    breakEvenOccupancy,
    breakEvenRent,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Maps a value onto 0-100 through a piecewise-linear band list. */
function band(value: number, points: [number, number][]): number {
  const asc = points[0][0] < points[points.length - 1][0];
  const p = asc ? points : [...points].reverse();
  if (value <= p[0][0]) return p[0][1];
  if (value >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[i + 1];
    if (value >= x0 && value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 50;
}

export type ScoreFactor = {
  label: string;
  score: number;
  weight: number;
  display: string;
  tone: "good" | "warn" | "bad";
};

export function scoreDeal(
  d: Derived,
  a: Assumptions,
  ctx: { priceVsComps: number; localVacancy: number; marketHealth: number },
) {
  const cashFlowScore = band(d.monthlyCashFlow, [
    [-300, 0],
    [-100, 30],
    [0, 55],
    [150, 80],
    [400, 100],
  ]);
  const netYieldScore = band(d.netYield, [
    [1, 0],
    [3, 35],
    [4.5, 60],
    [6, 85],
    [8, 100],
  ]);
  const cocScore = band(d.cashOnCash, [
    [-10, 0],
    [-2, 35],
    [2, 60],
    [6, 85],
    [12, 100],
  ]);
  const dscrScore = band(isFinite(d.dscr) ? d.dscr : 3, [
    [0.6, 0],
    [0.9, 40],
    [1.0, 60],
    [1.25, 85],
    [1.5, 100],
  ]);
  const beScore = band(Math.min(d.breakEvenOccupancy, 140), [
    [70, 100],
    [85, 80],
    [95, 55],
    [105, 25],
    [125, 0],
  ]);
  const vacancyScore = band(ctx.localVacancy, [
    [3, 100],
    [6, 75],
    [9, 45],
    [13, 10],
  ]);
  const priceScore = band(ctx.priceVsComps, [
    [-15, 100],
    [-5, 85],
    [0, 65],
    [8, 35],
    [20, 0],
  ]);
  const marketScore = ctx.marketHealth;

  const factors: ScoreFactor[] = [
    { label: "Cash-flow", score: cashFlowScore, weight: 22, display: "" , tone: "good" },
    { label: "Rendement net", score: netYieldScore, weight: 16, display: "", tone: "good" },
    { label: "Cash-on-cash", score: cocScore, weight: 12, display: "", tone: "good" },
    { label: "DSCR", score: dscrScore, weight: 14, display: "", tone: "good" },
    { label: "Point mort d'occupation", score: beScore, weight: 12, display: "", tone: "good" },
    { label: "Vacance locative locale", score: vacancyScore, weight: 8, display: "", tone: "good" },
    { label: "Prix vs comparables", score: priceScore, weight: 10, display: "", tone: "good" },
    { label: "Fondamentaux du marché", score: marketScore, weight: 6, display: "", tone: "good" },
  ];

  for (const f of factors) {
    f.tone = f.score >= 65 ? "good" : f.score >= 40 ? "warn" : "bad";
  }

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(
    factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight,
  );

  const verdict: Verdict = score >= 68 ? "GOOD" : score >= 45 ? "BORDERLINE" : "BAD";

  // Short human explanation: pick the strongest and the weakest factor.
  const sorted = [...factors].sort((x, y) => y.score - x.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const positives: string[] = [];
  const negatives: string[] = [];
  if (d.monthlyCashFlow >= 0) positives.push("cash-flow positif");
  else negatives.push("cash-flow négatif");
  if (ctx.priceVsComps <= 0) positives.push("prix inférieur aux comparables");
  else if (ctx.priceVsComps > 6) negatives.push("prix au-dessus des comparables");
  if (d.netYield >= 5) positives.push("rendement net solide");
  else if (d.netYield >= 4) positives.push("rendement net correct");
  else if (d.netYield < 3.5) negatives.push("rendement net faible");
  if (d.breakEvenOccupancy > 95) negatives.push("point mort d'occupation élevé");
  if (!isFinite(d.dscr)) positives.push("opération sans dette");
  else if (d.dscr >= 1.15) positives.push("DSCR confortable");
  else if (d.dscr < 0.9) negatives.push("les loyers ne couvrent pas l'échéance");
  if (ctx.localVacancy <= 7) positives.push("faible vacance locale");

  const explanation =
    (positives.length ? capitalize(positives.slice(0, 2).join(" et ")) : "Peu de points forts") +
    (negatives.length
      ? `, mais ${negatives.slice(0, 2).join(" et ")}.`
      : `. Le score de ${score}/100 repose surtout sur ${best.label.toLowerCase()}.`);

  return { score, verdict, factors, explanation, best, worst };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* Sensitivity + viability thresholds                                  */
/* ------------------------------------------------------------------ */

export type Lever = {
  key: keyof Assumptions;
  label: string;
  unit: "eur" | "pct" | "eurMonth";
  /** direction that improves cash flow: -1 lower is better, +1 higher is better */
  better: -1 | 1;
  min: number;
  max: number;
  step: number;
};

export const LEVERS: Lever[] = [
  { key: "purchasePrice", label: "Prix d'achat", unit: "eur", better: -1, min: 40000, max: 400000, step: 1000 },
  { key: "monthlyRent", label: "Loyer mensuel", unit: "eurMonth", better: 1, min: 300, max: 2500, step: 10 },
  { key: "interestRate", label: "Taux d'intérêt", unit: "pct", better: -1, min: 0.5, max: 8, step: 0.05 },
  { key: "downPayment", label: "Apport", unit: "eur", better: 1, min: 0, max: 250000, step: 1000 },
  { key: "renovationBudget", label: "Montant des travaux", unit: "eur", better: -1, min: 0, max: 120000, step: 500 },
  { key: "vacancyRate", label: "Vacance locative", unit: "pct", better: -1, min: 0, max: 30, step: 0.5 },
  { key: "managementFeePct", label: "Frais de gestion", unit: "pct", better: -1, min: 0, max: 15, step: 0.5 },
  { key: "propertyTax", label: "Taxe foncière", unit: "eur", better: -1, min: 0, max: 6000, step: 50 },
  { key: "condoCharges", label: "Charges de copropriété", unit: "eur", better: -1, min: 0, max: 6000, step: 50 },
];

export function withOverride(
  a: Assumptions,
  key: keyof Assumptions,
  value: number,
): Assumptions {
  return { ...a, [key]: value } as Assumptions;
}

/** Monthly cash flow if a single lever moves to `value`. */
export function cashFlowAt(a: Assumptions, key: keyof Assumptions, value: number): number {
  return derive(withOverride(a, key, value)).monthlyCashFlow;
}

/**
 * Value of `key` that brings monthly cash flow to `target` (default 0).
 * Bisection — robust for every lever, monotonic or not in closed form.
 * Returns null when unreachable inside the lever's plausible range.
 */
export function solveThreshold(
  a: Assumptions,
  lever: Lever,
  target = 0,
): number | null {
  const f = (v: number) => cashFlowAt(a, lever.key, v) - target;
  let lo = lever.min;
  let hi = lever.max;
  const flo = f(lo);
  const fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo > 0 === fhi > 0) return null; // no sign change -> unreachable
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm > 0 === flo > 0) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  // snap to a readable step
  const snapped = lever.better === -1
    ? Math.floor(v / lever.step) * lever.step
    : Math.ceil(v / lever.step) * lever.step;
  // "Set this cost to zero" is a threshold the maths allows but nobody can act on.
  if (snapped <= lever.min || snapped >= lever.max) return null;
  return Math.round(snapped * 100) / 100;
}

export type SensitivityRow = {
  lever: Lever;
  label: string;
  newValue: number;
  impact: number;
  newCashFlow: number;
};

/** The canonical "what would change this deal" table. */
export function sensitivityTable(a: Assumptions): SensitivityRow[] {
  const base = derive(a).monthlyCashFlow;
  const scenarios: { key: keyof Assumptions; label: string; value: number }[] = [
    { key: "purchasePrice", label: "Prix d'achat −5 %", value: a.purchasePrice * 0.95 },
    { key: "purchasePrice", label: "Prix d'achat +5 %", value: a.purchasePrice * 1.05 },
    { key: "monthlyRent", label: "Loyer +10 %", value: a.monthlyRent * 1.1 },
    { key: "monthlyRent", label: "Loyer −10 %", value: a.monthlyRent * 0.9 },
    { key: "interestRate", label: "Taux −1 pt", value: Math.max(0.1, a.interestRate - 1) },
    { key: "interestRate", label: "Taux +1 pt", value: a.interestRate + 1 },
    { key: "renovationBudget", label: "Travaux −10 000 €", value: Math.max(0, a.renovationBudget - 10000) },
    { key: "downPayment", label: "Apport +20 000 €", value: a.downPayment + 20000 },
    { key: "vacancyRate", label: "Vacance −5 pts", value: Math.max(0, a.vacancyRate - 5) },
    { key: "vacancyRate", label: "Vacance +5 pts", value: a.vacancyRate + 5 },
  ];
  return scenarios.map((s) => {
    const lever = LEVERS.find((l) => l.key === s.key)!;
    const cf = cashFlowAt(a, s.key, s.value);
    return {
      lever,
      label: s.label,
      newValue: s.value,
      impact: cf - base,
      newCashFlow: cf,
    };
  });
}

/** Combined scenarios that each get the deal to break-even. */
export function makeItWork(a: Assumptions) {
  const base = derive(a);
  if (base.monthlyCashFlow >= 0) return [];

  const combos: { title: string; changes: { label: string; from: string; to: string }[]; result: number }[] = [];

  // 1. Negotiate price + slightly higher rent
  {
    const priceCut = a.purchasePrice * 0.93;
    let test = withOverride(a, "purchasePrice", priceCut);
    const rentUp = a.monthlyRent * 1.04;
    test = withOverride(test, "monthlyRent", rentUp);
    combos.push({
      title: "Négocier + optimiser le loyer",
      changes: [
        { label: "Prix d'achat", from: fmtEur(a.purchasePrice), to: fmtEur(priceCut) },
        { label: "Loyer", from: fmtEur(a.monthlyRent) + "/mois", to: fmtEur(rentUp) + "/mois" },
      ],
      result: derive(test).monthlyCashFlow,
    });
  }

  // 2. Bigger deposit
  {
    const lever = LEVERS.find((l) => l.key === "downPayment")!;
    const need = solveThreshold(a, lever);
    if (need !== null) {
      combos.push({
        title: "Augmenter l'apport",
        changes: [{ label: "Apport", from: fmtEur(a.downPayment), to: fmtEur(need) }],
        result: cashFlowAt(a, "downPayment", need),
      });
    }
  }

  // 3. Longer loan + self-management
  {
    const longer = Math.min(30, a.loanYears + 5);
    let test = withOverride(a, "loanYears", longer);
    test = withOverride(test, "managementFeePct", 0);
    combos.push({
      title: "Allonger le prêt + gérer en direct",
      changes: [
        { label: "Durée du prêt", from: `${a.loanYears} ans`, to: `${longer} ans` },
        { label: "Frais de gestion", from: `${a.managementFeePct} %`, to: "0 %" },
      ],
      result: derive(test).monthlyCashFlow,
    });
  }

  // 4. Trim the renovation budget
  {
    const cut = Math.max(0, a.renovationBudget - 8000);
    const test = withOverride(a, "renovationBudget", cut);
    combos.push({
      title: "Réduire le budget travaux",
      changes: [
        { label: "Montant des travaux", from: fmtEur(a.renovationBudget), to: fmtEur(cut) },
      ],
      result: derive(test).monthlyCashFlow,
    });
  }

  return combos.sort((x, y) => y.result - x.result);
}

function fmtEur(n: number) {
  return (
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"
  );
}

/* ------------------------------------------------------------------ */
/* 10-year projection                                                  */
/* ------------------------------------------------------------------ */

export type ProjectionYear = {
  year: number;
  rentalIncome: number;
  debtService: number;
  expenses: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  loanRemaining: number;
  equity: number;
  propertyValue: number;
};

export function projection(a: Assumptions, horizon = 10): ProjectionYear[] {
  const d = derive(a);
  const rows: ProjectionYear[] = [];
  let cumulative = 0;
  const variableRate =
    (a.managementFeePct + a.unpaidRentInsurancePct + a.maintenancePct + a.capexPct) / 100;

  for (let y = 1; y <= horizon; y++) {
    const growth = Math.pow(1 + a.rentGrowth / 100, y - 1);
    const expGrowth = Math.pow(1 + a.expenseGrowth / 100, y - 1);
    const collected = d.collectedRent * growth;
    const expenses = d.fixedOpex * expGrowth + collected * variableRate;
    const debtService = y <= a.loanYears ? d.annualDebtService : 0;
    const cashFlow = collected - expenses - debtService;
    cumulative += cashFlow;
    const loanRemaining = remainingBalance(d.loanAmount, a.interestRate, a.loanYears, y * 12);
    const propertyValue =
      a.purchasePrice * Math.pow(1 + a.propertyAppreciation / 100, y) +
      d.renovation * 0.6;
    rows.push({
      year: y,
      rentalIncome: collected,
      debtService,
      expenses,
      cashFlow,
      cumulativeCashFlow: cumulative,
      loanRemaining,
      equity: propertyValue - loanRemaining,
      propertyValue,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Buy vs rent                                                         */
/* ------------------------------------------------------------------ */

export type BuyRentYear = {
  year: number;
  rentWealth: number;
  buyWealth: number;
  /** Total cash both scenarios have committed by now (identical by construction). */
  committed: number;
  rentPaid: number;
  renterPot: number;
  renterGains: number;
  interestPaid: number;
  ownerCosts: number;
  principalRepaid: number;
  propertyValue: number;
  loanRemaining: number;
  sellingFees: number;
  buyerPot: number;
  rentNetCost: number;
  buyNetCost: number;
};

/**
 * Both scenarios spend the same amount of cash each month. Whoever pays less
 * for housing invests the difference at `investmentReturn`. Comparing final
 * net wealth is then an apples-to-apples comparison.
 */
export function buyVsRent(a: Assumptions, horizon = 30, opts?: { breakEvenOnly?: boolean }) {
  const d = derive(a);
  const breakEvenOnly = opts?.breakEvenOnly === true;

  // Cash the buyer puts in on day one; the renter keeps it invested.
  const upfront = d.cashInvested;

  const rMonthlyInvest = Math.pow(1 + a.investmentReturn / 100, 1 / 12) - 1;
  const rMonthlyRentGrowth = Math.pow(1 + a.currentRentGrowth / 100, 1 / 12) - 1;
  const rMonthlyAppreciation = Math.pow(1 + a.propertyAppreciation / 100, 1 / 12) - 1;
  const rMonthlyExpGrowth = Math.pow(1 + a.expenseGrowth / 100, 1 / 12) - 1;

  let renterPot = upfront;
  let buyerPot = 0;
  let rentMonthly = a.currentRent + a.currentRentCharges;
  let propertyValue = a.purchasePrice + d.renovation * 0.6;

  let cumRentPaid = 0;
  let cumInterest = 0;
  let cumOwnerCosts = 0;
  let cumSpend = 0;

  const rows: BuyRentYear[] = [];
  let breakEvenMonth: number | null = null;

  const monthlyOwnerBase =
    (a.propertyTax + a.condoCharges + a.landlordInsurance) / 12;

  // Amortise the loan iteratively — the solver runs this loop dozens of times
  // per keystroke, so no Math.pow inside it.
  const rLoan = a.interestRate / 100 / 12;
  let balance = d.loanAmount;
  let infl = 1;

  for (let m = 1; m <= horizon * 12; m++) {
    const ownerCosts =
      monthlyOwnerBase * infl +
      (propertyValue * (a.ownerMaintenancePct / 100)) / 12;
    const mortgage = m <= a.loanYears * 12 ? d.monthlyPayment : 0;
    const buyerMonthly = mortgage + ownerCosts;

    // Whoever spends less invests the difference.
    const spend = Math.max(buyerMonthly, rentMonthly);
    renterPot = renterPot * (1 + rMonthlyInvest) + (spend - rentMonthly);
    buyerPot = buyerPot * (1 + rMonthlyInvest) + (spend - buyerMonthly);

    cumRentPaid += rentMonthly;
    cumOwnerCosts += ownerCosts;
    cumSpend += spend;

    if (mortgage > 0 && balance > 0) {
      const interest = balance * rLoan;
      balance = Math.max(0, balance - (d.monthlyPI - interest));
      cumInterest += interest + d.monthlyInsurance;
    }
    const balAfter = balance;

    rentMonthly *= 1 + rMonthlyRentGrowth;
    propertyValue *= 1 + rMonthlyAppreciation;
    infl *= 1 + rMonthlyExpGrowth;

    const resale = propertyValue * (1 - a.sellingFeesPct / 100);
    const buyWealth = resale - balAfter + buyerPot;
    const rentWealth = renterPot;

    if (breakEvenMonth === null && buyWealth >= rentWealth) {
      breakEvenMonth = m;
      // The threshold solver only needs the crossing point — stop here rather
      // than amortising the remaining decades.
      if (breakEvenOnly) break;
    }

    if (!breakEvenOnly && m % 12 === 0) {
      const y = m / 12;
      const committed = upfront + cumSpend;
      rows.push({
        year: y,
        rentWealth,
        buyWealth,
        committed,
        rentPaid: cumRentPaid,
        renterPot,
        renterGains: renterPot - upfront - (cumSpend - cumRentPaid),
        interestPaid: cumInterest,
        ownerCosts: cumOwnerCosts,
        principalRepaid: d.loanAmount - balAfter,
        propertyValue,
        loanRemaining: balAfter,
        sellingFees: propertyValue * (a.sellingFeesPct / 100),
        buyerPot,
        rentNetCost: committed - rentWealth,
        buyNetCost: committed - buyWealth,
      });
    }
  }

  const breakEvenYears = breakEvenMonth ? breakEvenMonth / 12 : null;
  if (breakEvenOnly) {
    return { rows, breakEvenYears, atPlanned: undefined!, upfront, scenarioKeep: undefined! };
  }

  const stay = Math.min(Math.max(1, Math.round(a.plannedStayYears)), horizon);
  const atPlanned = rows[stay - 1];

  return {
    rows,
    breakEvenYears,
    atPlanned,
    upfront,
    scenarioKeep: (() => {
      const r = rows[Math.min(rows.length, stay) - 1];
      return {
        equity: r.propertyValue - r.loanRemaining,
        loanRemaining: r.loanRemaining,
        propertyValue: r.propertyValue,
        potentialRent: a.monthlyRent * Math.pow(1 + a.rentGrowth / 100, stay),
      };
    })(),
  };
}

/* ------------------------------------------------------------------ */
/* Buy vs rent — levers, sensitivity and thresholds                    */
/* ------------------------------------------------------------------ */

/** Levers that move the buy-vs-rent break-even in a predictable direction. */
export const BR_LEVERS: Lever[] = [
  { key: "purchasePrice", label: "Prix d'achat", unit: "eur", better: -1, min: 40000, max: 400000, step: 1000 },
  { key: "interestRate", label: "Taux d'intérêt", unit: "pct", better: -1, min: 0.5, max: 8, step: 0.05 },
  { key: "propertyAppreciation", label: "Valorisation du bien", unit: "pct", better: 1, min: -2, max: 8, step: 0.1 },
  { key: "currentRent", label: "Loyer actuel", unit: "eurMonth", better: 1, min: 200, max: 3000, step: 10 },
  { key: "renovationBudget", label: "Montant des travaux", unit: "eur", better: -1, min: 0, max: 120000, step: 500 },
  { key: "sellingFeesPct", label: "Frais de revente", unit: "pct", better: -1, min: 0, max: 12, step: 0.5 },
  { key: "investmentReturn", label: "Rendement des placements", unit: "pct", better: -1, min: 0, max: 12, step: 0.1 },
];

const NEVER = 99;

/** Break-even in years, or NEVER when buying does not catch up inside 30 years. */
export function breakEvenAt(
  a: Assumptions,
  key: keyof Assumptions,
  value: number,
): number {
  const r = buyVsRent(withOverride(a, key, value), 30, { breakEvenOnly: true }).breakEvenYears;
  return r === null ? NEVER : r;
}

export type BrSensitivityRow = {
  label: string;
  newValue: number;
  unit: Lever["unit"];
  breakEven: number;
  delta: number;
};

export function brSensitivityTable(a: Assumptions): BrSensitivityRow[] {
  const base = buyVsRent(a, 30, { breakEvenOnly: true }).breakEvenYears ?? NEVER;
  const scenarios: { key: keyof Assumptions; label: string; value: number; unit: Lever["unit"] }[] = [
    { key: "purchasePrice", label: "Prix d'achat −5 %", value: a.purchasePrice * 0.95, unit: "eur" },
    { key: "purchasePrice", label: "Prix d'achat +5 %", value: a.purchasePrice * 1.05, unit: "eur" },
    { key: "interestRate", label: "Taux −1 pt", value: Math.max(0.1, a.interestRate - 1), unit: "pct" },
    { key: "interestRate", label: "Taux +1 pt", value: a.interestRate + 1, unit: "pct" },
    { key: "propertyAppreciation", label: "Valorisation +1 pt", value: a.propertyAppreciation + 1, unit: "pct" },
    { key: "propertyAppreciation", label: "Valorisation −1 pt", value: a.propertyAppreciation - 1, unit: "pct" },
    { key: "currentRent", label: "Loyer actuel +10 %", value: a.currentRent * 1.1, unit: "eurMonth" },
    { key: "currentRent", label: "Loyer actuel −10 %", value: a.currentRent * 0.9, unit: "eurMonth" },
    { key: "downPayment", label: "Apport +20 000 €", value: a.downPayment + 20000, unit: "eur" },
    { key: "investmentReturn", label: "Placements +2 pts", value: a.investmentReturn + 2, unit: "pct" },
  ];
  return scenarios.map((s) => {
    const be = breakEvenAt(a, s.key, s.value);
    return {
      label: s.label,
      newValue: s.value,
      unit: s.unit,
      breakEven: be,
      delta: be - base,
    };
  });
}

/**
 * Value of `lever` that makes buying break even exactly at the planned stay.
 * Same bisection approach as the rental thresholds.
 */
export function solveBrThreshold(a: Assumptions, lever: Lever): number | null {
  const target = a.plannedStayYears;
  // g > 0 once buying wins inside the horizon.
  const g = (v: number) => target - breakEvenAt(a, lever.key, v);
  let lo = lever.min;
  let hi = lever.max;
  const glo = g(lo);
  const ghi = g(hi);
  if (glo > 0 === ghi > 0) return null;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0 === glo > 0) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  const snapped =
    lever.better === -1
      ? Math.floor(v / lever.step) * lever.step
      : Math.ceil(v / lever.step) * lever.step;
  if (snapped <= lever.min || snapped >= lever.max) return null;
  return Math.round(snapped * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Comparables statistics                                              */
/* ------------------------------------------------------------------ */

export function stats(values: number[]) {
  if (!values.length) return { avg: 0, median: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { avg, median, min: sorted[0], max: sorted[sorted.length - 1] };
}
