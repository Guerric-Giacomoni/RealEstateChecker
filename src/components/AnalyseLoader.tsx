"use client";

import Lottie from "lottie-react";
import animationData from "@/assets/analyse-loading.json";

/** Full-screen loading animation shown while a listing is being analysed. */
export default function AnalyseLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm">
      <div className="w-[220px]">
        <Lottie animationData={animationData} loop autoplay />
      </div>
      <div className="text-center">
        <div className="text-[15px] font-semibold text-ink">Analyse de l&apos;annonce en cours…</div>
        <div className="mt-1 text-[12.5px] text-muted">
          Récupération du bien et des comparables.
        </div>
      </div>
    </div>
  );
}
