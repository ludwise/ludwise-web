import type { OfferView } from '../api/contract.js';

/** Input accepted by the factual offer rendering boundary. */
export interface OfferRenderInput<TMonetization = undefined> {
  readonly offers: readonly OfferView[];
  readonly monetization?: TMonetization;
}

/** Preserve the order established by the backend for every monetization state. */
export function offersForRendering<TMonetization>(
  input: OfferRenderInput<TMonetization>,
): readonly OfferView[] {
  return input.offers;
}
