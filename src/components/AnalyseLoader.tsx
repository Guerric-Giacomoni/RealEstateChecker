"use client";

import Lottie from "lottie-react";
import animationData from "@/assets/analyse-loading.json";

/**
 * Full-screen loading animation shown while a listing is being analysed.
 * The animation is white, so it sits on a turquoise brand background.
 */
export default function AnalyseLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-navy-600">
      <Lottie
        animationData={animationData}
        loop
        autoplay
        style={{ width: "70vmin", height: "70vmin" }}
      />
      <div className="text-center">
        <div className="text-[16px] font-semibold text-white">
          Analyse de l&apos;annonce en cours…
        </div>
        <div className="mt-1 text-[13px] text-white/80">
          Récupération du bien et des comparables.
        </div>
      </div>
    </div>
  );
}
