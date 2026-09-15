import type { ArtifactRef } from './rich-fields';

/**
 * A logo set is what a consumer site pulls: every project's current identity logo, keyed by the
 * public slug, in a fixed directory layout with the viewer runtime beside it. The manifest is a
 * pure function of the catalog rows so an unchanged selection produces the same bytes — a site
 * that checks the set into git stays quiet until a logo actually changes.
 */
export const LOGO_SET_KIND = 'impressions.logo.set';

export interface LogoListing {
  id: string;
  slug: string;
  name: string;
  revision: string;
  manifest: ArtifactRef;
  poster: ArtifactRef;
  /** Optional presentation hints carried by the document (card product-name placement). */
  layouts?: Record<string, unknown>;
}

export interface LogoSetEntry {
  revision: string;
  document: string;
  poster: string;
  layouts?: Record<string, unknown>;
}

export interface LogoSetManifest {
  schemaVersion: 1;
  kind: typeof LOGO_SET_KIND;
  source: 'ongoing';
  runtime: { script: string; embed: string; version: string };
  logos: Record<string, LogoSetEntry>;
}

export const LOGO_SET_FILES = {
  manifest: 'logos.json',
  runtime: 'impressions-logo.js',
  embed: 'logo-embed.js',
  document: (slug: string) => `${slug}/logo.json`,
  poster: (slug: string) => `${slug}/logo.png`
} as const;

export function buildLogoSetManifest(
  listings: readonly LogoListing[],
  runtimeVersion: string
): LogoSetManifest {
  const logos: Record<string, LogoSetEntry> = {};
  for (const listing of [...listings].sort((left, right) => left.slug.localeCompare(right.slug)))
    logos[listing.slug] = {
      revision: listing.revision,
      document: LOGO_SET_FILES.document(listing.slug),
      poster: LOGO_SET_FILES.poster(listing.slug),
      ...(listing.layouts ? { layouts: listing.layouts } : {})
    };
  return {
    schemaVersion: 1,
    kind: LOGO_SET_KIND,
    source: 'ongoing',
    runtime: {
      script: LOGO_SET_FILES.runtime,
      embed: LOGO_SET_FILES.embed,
      version: runtimeVersion
    },
    logos
  };
}

/** Narrow a listing to the projects a consumer asked for, by slug or exact ID; reports what is missing. */
export function selectLogos(
  listings: readonly LogoListing[],
  requested: readonly string[]
): { selected: LogoListing[]; missing: string[] } {
  if (!requested.length) return { selected: [...listings], missing: [] };
  const selected: LogoListing[] = [];
  const missing: string[] = [];
  for (const key of requested) {
    const match = listings.find((listing) => listing.slug === key || listing.id === key);
    if (match) {
      if (!selected.includes(match)) selected.push(match);
    } else missing.push(key);
  }
  return { selected, missing };
}
