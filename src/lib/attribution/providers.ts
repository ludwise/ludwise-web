/**
 * The address a visitor opens for a provider that LUDWISE must credit.
 *
 * Keyed on the display name in lower case, because `ProvenanceView` carries
 * no slug and a name is the one identifier every provenance shape holds. A
 * name this map does not hold gets no address, so its credit renders as plain
 * text rather than as a link to a guess.
 */

/** One provider in a credit. `url` is `null` when this map holds no address. */
export interface ProviderCredit {
  readonly name: string;
  readonly url: string | null;
}

/**
 * The public website of each provider LUDWISE credits, by display name.
 *
 * The footer names these two directly, because it credits the integration and
 * not one page. The game-page block reaches them through `providerCredit`.
 */
export const PROVIDER_SITES = {
  igdb: 'https://www.igdb.com/',
  steam: 'https://store.steampowered.com/',
} as const;

const sites = new Map<string, string>(Object.entries(PROVIDER_SITES));

/**
 * The key one display name matches on.
 *
 * Case and spacing are presentation, so a credit must not lose its link
 * because the backend changed either. The keys of `PROVIDER_SITES` are written
 * in this form.
 */
export const providerKey = (name: string): string => name.trim().toLowerCase();

export function providerCredit(name: string): ProviderCredit {
  return { name, url: sites.get(providerKey(name)) ?? null };
}
