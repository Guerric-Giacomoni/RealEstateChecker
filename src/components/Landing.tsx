"use client";

import { useState } from "react";
import { UrlSearchBar } from "./UrlSearchBar";
import { ManualEntryForm } from "./ManualEntryForm";

/**
 * Entry screen: paste a listing URL, type the details in by hand, or continue
 * with the demo property. Shown once, before onboarding.
 */
export function Landing({ onReady }: { onReady: () => void }) {
  const [manual, setManual] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center gap-2.5 px-6 py-3.5">
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
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[640px] text-center">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-ink">
            Cette annonce est-elle une bonne affaire ?
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted">
            Collez le lien d&apos;une annonce Leboncoin ou SeLoger : nous récupérons le prix,
            la surface, le DPE et les détails du bien, puis lançons l&apos;analyse complète.
          </p>

          <div className="mt-8 text-left">
            <UrlSearchBar variant="hero" autoFocus onSuccess={onReady} />
          </div>

          {manual ? (
            <div className="mt-5">
              <ManualEntryForm onSuccess={onReady} />
              <button
                onClick={() => setManual(false)}
                className="mt-3 text-[13px] font-medium text-muted underline-offset-2 transition hover:underline"
              >
                Annuler la saisie manuelle
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <button
                onClick={() => setManual(true)}
                className="text-[13px] font-medium text-navy-600 underline-offset-2 transition hover:underline"
              >
                L&apos;import n&apos;a pas fonctionné ? Saisir les infos manuellement
              </button>
              <span className="hidden text-faint sm:inline">·</span>
              <button
                onClick={onReady}
                className="text-[13px] font-medium text-navy-600 underline-offset-2 transition hover:underline"
              >
                Ou continuer avec l&apos;exemple de démonstration →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
