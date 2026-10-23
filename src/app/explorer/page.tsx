import type { Metadata } from "next";
import { ZoneExplorer } from "@/components/explorer/ZoneExplorer";

export const metadata: Metadata = {
  title: "Explorer une zone — ImmoCheck",
  description:
    "Tracez un périmètre sur la carte et découvrez les biens réellement vendus à l'intérieur (DVF 2025).",
};

export default function ExplorerPage() {
  return (
    <div className="app-root min-h-screen bg-canvas">
      <ZoneExplorer />
    </div>
  );
}
