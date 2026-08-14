"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { scrapeListingClient, ScrapeClientError } from "@/lib/scrape-client";
import type { ScrapeResult } from "@/lib/scraper/types";

type Variant = "hero" | "bar";

export function UrlSearchBar({
  variant = "hero",
  onSuccess,
  autoFocus,
}: {
  variant?: Variant;
  onSuccess?: (result: ScrapeResult) => void;
  autoFocus?: boolean;
}) {
  const { applyScrape, property } = useApp();
  const [url, setUrl] = useState(variant === "bar" ? property.url : "");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function run() {
    if (!url.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const result = await scrapeListingClient(url.trim());
      applyScrape(result);
      setStatus("idle");
      onSuccess?.(result);
    } catch (e) {
      setError((e as ScrapeClientError).message);
      setStatus("error");
    }
  }

  const loading = status === "loading";
  const hero = variant === "hero";

  return (
    <div className={hero ? "w-full" : "min-w-[280px] flex-1"}>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="relative flex-1">
          <span
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint ${
              hero ? "text-[15px]" : "text-[13px]"
            }`}
          >
            🔗
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus={autoFocus}
            disabled={loading}
            placeholder="Collez l'URL d'une annonce Leboncoin ou SeLoger"
            className={`w-full rounded-lg border border-line bg-canvas text-ink outline-none transition placeholder:text-faint focus:border-navy-400 focus:bg-white focus:ring-2 focus:ring-navy-100 disabled:opacity-60 ${
              hero ? "py-3 pl-10 pr-3 text-[15px]" : "py-2 pl-9 pr-3 text-[13px]"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className={`shrink-0 rounded-lg bg-navy-700 font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60 ${
            hero ? "px-6 py-3 text-[15px]" : "px-4 py-2 text-[13px]"
          }`}
        >
          {loading ? "Analyse…" : "Analyser"}
        </button>
      </form>

      {status === "error" && <p className="mt-2 text-[12.5px] text-bad">{error}</p>}
    </div>
  );
}
