import type { Assumptions, Comparable, Property } from "../types";

/** Listing portals we know how to parse. */
export type ListingSource = "leboncoin" | "seloger" | "bienici" | "pap" | "unknown";

/**
 * What a successful scrape returns: the property card the whole app renders,
 * plus the subset of assumptions we can read straight from the listing
 * (price, surface…). Everything else keeps its default until the user tweaks it.
 */
export type ScrapeResult = {
  source: ListingSource;
  property: Property;
  /** Only the fields the listing actually gave us — merged over DEFAULTS. */
  assumptions: Partial<Assumptions>;
  /** Currently-listed comparable properties for sale (SeLoger only; empty otherwise). */
  comparables: Comparable[];
  /** Currently-listed rental comparables (SeLoger only; price = monthly rent). */
  rentComparables: Comparable[];
  /** Fields we could not find, surfaced so the UI can nudge the user to fill them. */
  warnings: string[];
};

/** Returned by /api/scrape/start — identifies the async Apify run to poll. */
export type ScrapeStart = {
  runId: string;
  datasetId: string;
  source: ListingSource;
};

/**
 * Returned by /api/scrape/poll — a progressive snapshot of the run. `property`
 * appears once the subject has been scraped; `comparables` fill in later.
 */
export type ScrapePoll = {
  status: string;
  done: boolean;
  property?: Property;
  assumptions?: Partial<Assumptions>;
  comparables: Comparable[];
  rentComparables: Comparable[];
  warnings: string[];
};

/** A failure the API route turns into an HTTP status + a message for the UI. */
export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unsupported_url"
      | "provider_not_configured"
      | "blocked"
      | "not_found"
      | "parse_failed"
      | "fetch_failed",
    readonly status = 502,
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}
