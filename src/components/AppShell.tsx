"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { buyVsRent } from "@/lib/finance";
import { eur, eurM2, eurMonthSigned, pct, years as fmtYears } from "@/lib/format";
import { AssumptionsRecap, PropertyCard } from "./AssumptionsPanel";
import { Landing } from "./Landing";
import { Onboarding } from "./Onboarding";
import { PartnersSection } from "./PartnersSection";
import { UrlSearchBar } from "./UrlSearchBar";
import { TabBien } from "./tabs/TabBien";
import { TabRentabilite } from "./tabs/TabRentabilite";
import { TabAcheterLouer } from "./tabs/TabAcheterLouer";
import { TabMarche } from "./tabs/TabMarche";
import { TabHypotheses } from "./tabs/TabHypotheses";

type TabId = "bien" | "rentabilite" | "acheter" | "marche" | "hypotheses";

const ALL_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "bien", label: "Le bien", icon: "🏠" },
  { id: "acheter", label: "Acheter ou louer", icon: "⚖️" },
  { id: "rentabilite", label: "Rentabilité locative", icon: "📈" },
  { id: "marche", label: "Marché & quartier", icon: "📍" },
  { id: "hypotheses", label: "Hypothèses du projet", icon: "⚙️" },
];

export function AppShell() {
  const { onboarded } = useApp();
  // Paste-a-URL landing runs once before onboarding; "démo" or a successful
  // scrape flips `started` and hands off to the onboarding wizard.
  const [started, setStarted] = useState(false);
  if (!started && !onboarded) return <Landing onReady={() => setStarted(true)} />;
  if (!onboarded) return <Onboarding />;
  return <Dashboard />;
}

/* ================================================================== */

/**
 * Rasterise each `.export-page` (tab) and place it on its own A4 page, then
 * download the PDF directly. Leaflet maps are skipped (cross-origin tiles can't
 * be captured to a canvas).
 */
async function exportToPdf(filename: string) {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro").then((m) => m.default),
  ]);
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".export-page"));
  if (pages.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 8;
  const cw = pw - margin * 2;

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      ignoreElements: (n) => (n as HTMLElement).classList?.contains("leaflet-container"),
    });
    const img = canvas.toDataURL("image/jpeg", 0.9);
    const ih = (canvas.height * cw) / canvas.width;

    if (i > 0) doc.addPage();
    let heightLeft = ih;
    let position = 0;
    doc.addImage(img, "JPEG", margin, position, cw, ih);
    heightLeft -= ph;
    while (heightLeft > 0) {
      position = heightLeft - ih; // shift the image up onto the next page
      doc.addPage();
      doc.addImage(img, "JPEG", margin, position, cw, ih);
      heightLeft -= ph;
    }
  }
  doc.save(filename);
}

const renderTab = (id: TabId) =>
  id === "bien" ? (
    <TabBien />
  ) : id === "rentabilite" ? (
    <TabRentabilite />
  ) : id === "acheter" ? (
    <TabAcheterLouer />
  ) : id === "marche" ? (
    <TabMarche />
  ) : (
    <TabHypotheses />
  );

function Dashboard() {
  const { profile, showOther, setShowOther, property } = useApp();
  const isResidence = profile === "residence";
  const [exporting, setExporting] = useState(false);

  // Render every tab, wait for charts to settle, then build + download the PDF
  // (one A4 page per tab) — no print dialog.
  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    const slug = (property.city || "rapport").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const t = setTimeout(async () => {
      try {
        await exportToPdf(`immocheck-${slug}.pdf`);
      } catch (e) {
        console.error("[export]", e);
      } finally {
        if (!cancelled) setExporting(false);
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [exporting, property.city]);

  const tabs = useMemo(() => {
    const primary: TabId = isResidence ? "acheter" : "rentabilite";
    const secondary: TabId = isResidence ? "rentabilite" : "acheter";
    const visible: TabId[] = ["bien", primary, "marche", "hypotheses"];
    if (showOther) visible.splice(2, 0, secondary);
    return ALL_TABS.filter((t) => visible.includes(t.id)).sort(
      (x, y) => visible.indexOf(x.id) - visible.indexOf(y.id),
    );
  }, [isResidence, showOther]);

  const [tab, setTab] = useState<TabId>(isResidence ? "acheter" : "rentabilite");
  // Derived so a hidden/invalid selection falls back without a setState-in-effect.
  const activeTab: TabId = tabs.some((t) => t.id === tab)
    ? tab
    : isResidence
      ? "acheter"
      : "rentabilite";

  const otherLabel = isResidence
    ? "Analyser aussi en investissement locatif"
    : "Comparer aussi acheter vs louer";

  return (
    <div className="app-root min-h-screen">
      <TopBar onExport={() => setExporting(true)} exporting={exporting} />
      <SummaryStrip onJump={setTab} />

      {/* Tabs */}
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-5">
          <nav className="no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative whitespace-nowrap px-4 py-3 text-[13.5px] font-medium transition ${
                    active ? "text-navy-700" : "text-muted hover:text-slate-700"
                  }`}
                >
                  <span className="mr-1.5">{t.icon}</span>
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-t bg-navy-600" />
                  )}
                </button>
              );
            })}
          </nav>
          <button
            onClick={() => setShowOther(!showOther)}
            className="ml-auto hidden shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium text-navy-600 transition hover:bg-navy-50 lg:block"
          >
            {showOther ? "Masquer l'autre analyse" : `+ ${otherLabel}`}
          </button>
        </div>
      </div>

      {/* Body */}
      <main className="mx-auto max-w-[1560px] px-5 py-5">
        <div className="grid gap-5 xl:grid-cols-[318px_minmax(0,1fr)]">
          <aside className="thin-scroll space-y-4 xl:sticky xl:top-[60px] xl:max-h-[calc(100vh-72px)] xl:overflow-y-auto xl:pb-4">
            <PropertyCard />
            <AssumptionsRecap onEdit={() => setTab("hypotheses")} />
          </aside>

          <div className="min-w-0">
            {renderTab(activeTab)}

            {/* Masqué pour l'instant — remettre `true` pour réafficher. */}
            {false && <PartnersSection />}
          </div>
        </div>

        <footer className="mt-8 border-t border-line pt-5 text-[11.5px] leading-relaxed text-faint">
          Toutes les données affichées sont fictives et servent à valider la maquette. Les
          calculs (crédit, cash-flow, rendement, projections, achat vs location) sont en
          revanche réels et se recalculent en direct à partir des hypothèses du projet.
        </footer>
      </main>

      {exporting && <ExportDocument tabs={tabs} />}
    </div>
  );
}

/* ================================================================== */

/** Print-only document: every tab stacked, one A4 page each (see print CSS). */
function ExportDocument({ tabs }: { tabs: { id: TabId; label: string; icon: string }[] }) {
  const { property } = useApp();
  return (
    <div className="export-overlay fixed inset-0 z-[200] overflow-auto bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 bg-navy-600 px-6 py-2 text-[13px] font-medium text-white">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Génération du PDF… le téléchargement va démarrer automatiquement.
      </div>
      <div className="mx-auto max-w-[720px] px-6 py-6">
        <div className="mb-5">
          <div className="text-[20px] font-bold text-ink">Rapport ImmoCheck</div>
          <div className="text-[13px] text-muted">
            {property.type} — {property.address ? `${property.address}, ` : ""}
            {property.postalCode} {property.city}
          </div>
        </div>
        {tabs.map((t) => (
          <section key={t.id} className="export-page mb-8">
            <h2 className="mb-3 border-b border-line pb-1 text-[16px] font-semibold text-navy-700">
              {t.icon} {t.label}
            </h2>
            {renderTab(t.id)}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */

function TopBar({ onExport, exporting }: { onExport: () => void; exporting: boolean }) {
  const { restartOnboarding } = useApp();

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-4 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700 text-[15px] text-white">
            ⌂
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              Immo<span className="text-navy-600">Check</span>
            </div>
            <div className="text-[10.5px] text-faint">Analyse d&apos;annonces immobilières</div>
          </div>
        </div>

        <UrlSearchBar variant="bar" />

        <div className="flex items-center gap-2">
          {/* Masqué — remettre `true` pour réafficher « Mon projet ». */}
          {false && (
            <button
              onClick={restartOnboarding}
              className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Mon projet
            </button>
          )}
          <button
            onClick={onExport}
            disabled={exporting}
            className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? "Préparation…" : "Exporter"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ================================================================== */

function SummaryStrip({ onJump }: { onJump: (t: TabId) => void }) {
  const { a, d, comps, scoring, profile, showOther } = useApp();
  const model = useMemo(() => buyVsRent(a, 30), [a]);
  const isResidence = profile === "residence";

  const verdictStyle =
    scoring.verdict === "GOOD"
      ? { label: "BONNE AFFAIRE", cls: "bg-pos text-white" }
      : scoring.verdict === "BORDERLINE"
        ? { label: "À LA LIMITE", cls: "bg-warn text-white" }
        : { label: "MAUVAISE AFFAIRE", cls: "bg-bad text-white" };

  const rentalBlock = (
    <button
      key="rental"
      onClick={() => onJump("rentabilite")}
      className="group flex items-center gap-4 rounded-xl border border-line px-4 py-2.5 text-left transition hover:border-navy-300 hover:bg-navy-50/40 lg:border-0 lg:border-l lg:border-line lg:px-0 lg:pl-8 lg:hover:bg-transparent"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
          Investissement locatif
        </div>
        <div className="mt-0.5 flex items-baseline gap-3">
          <span
            className={`tnum text-[19px] font-semibold ${
              d.monthlyCashFlow >= 0 ? "text-pos" : "text-bad"
            }`}
          >
            {eurMonthSigned(d.monthlyCashFlow)}
          </span>
          <span className="text-[12.5px] text-muted">rendement net {pct(d.netYield)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-wide ${verdictStyle.cls}`}
        >
          {verdictStyle.label}
        </span>
        <span className="tnum text-[11px] text-faint">{scoring.score}/100</span>
      </div>
    </button>
  );

  const residenceBlock = (
    <button
      key="residence"
      onClick={() => onJump("acheter")}
      className="group flex items-center gap-4 rounded-xl border border-line px-4 py-2.5 text-left transition hover:border-navy-300 hover:bg-navy-50/40 lg:border-0 lg:border-l lg:border-line lg:px-0 lg:pl-8 lg:hover:bg-transparent"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
          Résidence principale
        </div>
        <div className="mt-0.5 flex items-baseline gap-3">
          <span className="tnum text-[19px] font-semibold text-navy-700">
            {model.breakEvenYears ? fmtYears(model.breakEvenYears) : "> 30 ans"}
          </span>
          <span className="text-[12.5px] text-muted">avant que l&apos;achat gagne</span>
        </div>
      </div>
      <span className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-navy-500">
        →
      </span>
    </button>
  );

  const blocks = isResidence
    ? showOther
      ? [residenceBlock, rentalBlock]
      : [residenceBlock]
    : showOther
      ? [rentalBlock, residenceBlock]
      : [rentalBlock];

  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto max-w-[1560px] px-5 py-4">
        <div
          className={`grid gap-4 lg:gap-8 ${
            blocks.length > 1 ? "lg:grid-cols-[1.1fr_1fr_1fr]" : "lg:grid-cols-[1.1fr_1fr]"
          }`}
        >
          {/* Prix */}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="tnum text-[30px] font-semibold leading-none tracking-[-0.025em] text-ink">
              {eur(a.purchasePrice)}
            </span>
            <span className="tnum text-[15px] font-medium text-muted">{eurM2(d.pricePerM2)}</span>
            <span
              className={`tnum rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                comps.priceVsComps > 3
                  ? "bg-bad-soft text-bad"
                  : comps.priceVsComps < -3
                    ? "bg-pos-soft text-pos"
                    : "bg-warn-soft text-warn"
              }`}
            >
              {comps.priceVsComps > 0 ? "+" : ""}
              {pct(comps.priceVsComps)} vs comparables
            </span>
          </div>

          {blocks}
        </div>
      </div>
    </div>
  );
}
