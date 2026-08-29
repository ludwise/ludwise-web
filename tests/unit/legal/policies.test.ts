import { describe, expect, it } from 'vitest';

import { baseLocale } from '../../../src/i18n/index.js';
import {
  assertLegalPolicies,
  canServeLegalPolicy,
  legalPolicyLocale,
  selectLegalFooterPolicies,
  selectLegalPolicy,
  type LegalPolicyEntry,
} from '../../../src/lib/legal/policies.js';

const policy = (overrides: Partial<LegalPolicyEntry['data']> = {}): LegalPolicyEntry => ({
  data: {
    policyId: 'privacy',
    locale: baseLocale,
    translationStatus: 'source',
    footer: true,
    order: 20,
    status: 'current',
    ...overrides,
  },
});

describe('localized legal policy selection', () => {
  it('accepts one source policy per policy and locale', () => {
    expect(() => assertLegalPolicies([policy()])).not.toThrow();
  });

  it('rejects duplicate policy and locale identities', () => {
    expect(() => assertLegalPolicies([policy(), policy()])).toThrow(
      'Duplicate legal policy locale',
    );
  });

  it('requires a source policy for every translated policy', () => {
    expect(() =>
      assertLegalPolicies([policy({ locale: 'cs', translationStatus: 'approved' })]),
    ).toThrow('Missing source legal policy');
  });

  it('keeps footer metadata aligned with the source policy', () => {
    expect(() =>
      assertLegalPolicies([
        policy(),
        policy({ locale: 'cs', translationStatus: 'approved', order: 30 }),
      ]),
    ).toThrow('Legal policy metadata differs from its source');
  });

  it('rejects a source marker on a translated policy', () => {
    expect(() =>
      assertLegalPolicies([policy({ locale: 'cs', translationStatus: 'source' })]),
    ).toThrow('Invalid legal translation status');
  });

  it('serves drafts outside production but not in production', () => {
    const draft = policy({ status: 'draft' });
    expect(canServeLegalPolicy(draft, false)).toBe(true);
    expect(canServeLegalPolicy(draft, true)).toBe(false);
  });

  it('requires approval before production serves a translation', () => {
    const draftTranslation = policy({ locale: 'cs', translationStatus: 'draft' });
    const approvedTranslation = policy({ locale: 'cs', translationStatus: 'approved' });

    expect(canServeLegalPolicy(draftTranslation, true)).toBe(false);
    expect(canServeLegalPolicy(approvedTranslation, true)).toBe(true);
  });

  it('falls back to the source policy when a translation cannot be served', () => {
    const source = policy();
    const translation = policy({ locale: 'cs', translationStatus: 'draft' });

    expect(selectLegalPolicy([source, translation], 'privacy', 'cs', true)).toBe(source);
  });

  it('selects one footer link per policy', () => {
    const source = policy();
    const translation = policy({ locale: 'cs', translationStatus: 'approved' });

    expect(selectLegalFooterPolicies([source, translation], 'cs', true)).toEqual([translation]);
  });

  it('rejects a legal locale that the application has not enabled', () => {
    expect(() =>
      legalPolicyLocale(policy({ locale: 'cs', translationStatus: 'approved' })),
    ).toThrow(RangeError);
  });
});
