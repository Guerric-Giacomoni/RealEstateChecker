"use client";

import { UrlSearchBar } from "./UrlSearchBar";

/**
 * Entry screen: paste a listing URL to pull in real data, or continue with the
 * demo property. Shown once, before onboarding.
 */
export function Landing({ onReady }: { onReady: () => void }) {
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

          <button
            onClick={onReady}
            className="mt-6 text-[13px] font-medium text-navy-600 underline-offset-2 transition hover:underline"
          >
            Ou continuer avec l&apos;exemple de démonstration →
          </button>
        </div>
      </main>
    </div>
  );
}
