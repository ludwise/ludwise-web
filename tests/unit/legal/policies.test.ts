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

const policy = (
  overrides: Partial<LegalPolicyEntry['data']> & { id?: string; locale?: string } = {},
): LegalPolicyEntry => {
  const { id, locale = baseLocale, ...dataOverrides } = overrides;
  const policyId = dataOverrides.policyId ?? 'privacy';
  return {
    id: id ?? `${locale}/${policyId}`,
    data: {
      policyId,
      translationStatus: 'source',
      footer: true,
      order: 20,
      status: 'current',
      version: '2026-08-28',
      ...dataOverrides,
    },
  };
};

describe('localized legal policy selection', () => {
  it('accepts one source policy per policy and locale', () => {
    expect(() => assertLegalPolicies([policy()])).not.toThrow();
  });

  it('rejects duplicate policy and locale identities', () => {
    expect(() => assertLegalPolicies([policy(), policy()])).toThrow(
      'Duplicate legal policy locale',
    );
  });

  it('requires the path locale and policy ID layout', () => {
    expect(() => assertLegalPolicies([policy({ id: 'privacy' })])).toThrow(
      'Legal policy path must be',
    );
    expect(() => assertLegalPolicies([policy({ id: 'en/terms', policyId: 'privacy' })])).toThrow(
      'Legal policy path differs from its policy ID',
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
        policy({
          locale: 'cs',
          translationStatus: 'approved',
          sourceVersion: '2026-08-28',
          order: 30,
        }),
      ]),
    ).toThrow('Legal policy metadata differs from its source');
  });

  it('rejects a source marker on a translated policy', () => {
    expect(() =>
      assertLegalPolicies([policy({ locale: 'cs', translationStatus: 'source' })]),
    ).toThrow('Invalid legal translation status');
  });

  it('requires provenance metadata on every translated policy', () => {
    for (const sourceVersion of [undefined, '']) {
      expect(() =>
        assertLegalPolicies([
          policy(),
          policy({ locale: 'cs', translationStatus: 'approved', sourceVersion }),
        ]),
      ).toThrow('Missing source version');
    }
  });

  it('accepts translated policy metadata when it names the source version', () => {
    expect(() =>
      assertLegalPolicies([
        policy(),
        policy({ locale: 'cs', translationStatus: 'approved', sourceVersion: '2026-08-28' }),
      ]),
    ).not.toThrow();
  });

  it('serves drafts outside production but not in production', () => {
    const source = policy();
    const draft = policy({ status: 'draft' });
    expect(canServeLegalPolicy(draft, source, false)).toBe(true);
    expect(canServeLegalPolicy(draft, source, true)).toBe(false);
  });

  it('requires approval before production serves a translation', () => {
    const source = policy();
    const draftTranslation = policy({
      locale: 'cs',
      translationStatus: 'draft',
      sourceVersion: source.data.version,
    });
    const approvedTranslation = policy({
      locale: 'cs',
      translationStatus: 'approved',
      sourceVersion: source.data.version,
    });

    expect(canServeLegalPolicy(draftTranslation, source, true)).toBe(false);
    expect(canServeLegalPolicy(approvedTranslation, source, true)).toBe(true);
  });

  it('keeps a draft translation available for development review', () => {
    const source = policy();
    const translation = policy({
      locale: 'cs',
      translationStatus: 'draft',
      sourceVersion: source.data.version,
    });

    expect(canServeLegalPolicy(translation, source, false)).toBe(true);
    expect(canServeLegalPolicy(translation, source, true)).toBe(false);
  });

  it('keeps a stale approved translation available for development review', () => {
    const source = policy();
    const stale = policy({
      locale: 'cs',
      translationStatus: 'approved',
      sourceVersion: '2026-08-27',
    });

    expect(canServeLegalPolicy(stale, source, false)).toBe(true);
    expect(canServeLegalPolicy(stale, source, true)).toBe(false);
  });

  it('requires the source policy to be current in production', () => {
    const source = policy({ status: 'draft' });
    const translation = policy({
      locale: 'cs',
      translationStatus: 'approved',
      sourceVersion: source.data.version,
    });

    expect(canServeLegalPolicy(translation, source, true)).toBe(false);
  });

  it('does not serve a superseded source policy', () => {
    const source = policy({ status: 'superseded' });

    expect(canServeLegalPolicy(source, source, false)).toBe(false);
    expect(canServeLegalPolicy(source, source, true)).toBe(false);
  });

  it('falls back to the source policy when a translation cannot be served', () => {
    const source = policy();
    const translation = policy({
      locale: 'cs',
      translationStatus: 'approved',
      sourceVersion: '2026-08-27',
    });

    expect(selectLegalPolicy([source, translation], 'privacy', 'cs', true)).toBe(source);
  });

  it('selects one footer link per policy', () => {
    const source = policy();
    const translation = policy({
      locale: 'cs',
      translationStatus: 'approved',
      sourceVersion: source.data.version,
    });

    expect(selectLegalFooterPolicies([source, translation], 'cs', true)).toEqual([translation]);
  });

  it('rejects a legal locale that the application has not enabled', () => {
    expect(() =>
      legalPolicyLocale(policy({ locale: 'cs', translationStatus: 'approved' })),
    ).toThrow(RangeError);
  });
});
