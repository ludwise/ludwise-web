import { describe, expect, it } from 'vitest';

import { providerCredit } from '../../../src/lib/attribution/providers.js';

describe('the provider credit map', () => {
  it('links a provider it holds an address for', () => {
    expect(providerCredit('IGDB')).toEqual({ name: 'IGDB', url: 'https://www.igdb.com/' });
  });

  it('links the store data provider', () => {
    expect(providerCredit('Steam')).toEqual({
      name: 'Steam',
      url: 'https://store.steampowered.com/',
    });
  });

  it('matches a name whatever case and spacing it arrives in', () => {
    // The name is a display string from the backend. Its case is presentation,
    // and a credit must not lose its link because that presentation changed.
    expect(providerCredit(' igdb ').url).toBe('https://www.igdb.com/');
  });

  it('gives a name it does not hold no address', () => {
    // The block still credits the source. It renders the name as plain text,
    // rather than dropping a provider the page really carried.
    expect(providerCredit('Orbit Source')).toEqual({ name: 'Orbit Source', url: null });
  });
});
