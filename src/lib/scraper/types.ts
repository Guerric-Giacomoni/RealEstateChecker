import type { Assumptions, Property } from "../types";

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
  /** Fields we could not find, surfaced so the UI can nudge the user to fill them. */
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
