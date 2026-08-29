import { baseLocale, isLocale, type Locale } from '../../i18n/index.js';

export type LegalPolicyStatus = 'draft' | 'current' | 'superseded';
export type LegalTranslationStatus = 'source' | 'draft' | 'approved';

export interface LegalPolicyData {
  policyId: string;
  locale: string;
  translationStatus: LegalTranslationStatus;
  footer: boolean;
  order: number;
  version: string;
  status: LegalPolicyStatus;
  sourceVersion?: string | undefined;
}

export interface LegalPolicyEntry {
  data: LegalPolicyData;
}

export function assertLegalPolicies(policies: readonly LegalPolicyEntry[]): void {
  const identities = new Set<string>();
  const policyIds = new Set<string>();

  for (const policy of policies) {
    policyIds.add(policy.data.policyId);
    const identity = `${policy.data.policyId}:${policy.data.locale}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate legal policy locale: ${identity}`);
    }
    identities.add(identity);

    const isSourceLocale = policy.data.locale === baseLocale;
    if (isSourceLocale !== (policy.data.translationStatus === 'source')) {
      throw new Error(`Invalid legal translation status: ${identity}`);
    }
  }

  for (const policyId of policyIds) {
    const source = policies.find(
      (policy) => policy.data.policyId === policyId && policy.data.locale === baseLocale,
    );
    if (source === undefined) throw new Error(`Missing source legal policy: ${policyId}`);

    for (const translation of policies.filter((policy) => policy.data.policyId === policyId)) {
      if (
        translation.data.locale !== baseLocale &&
        (typeof translation.data.sourceVersion !== 'string' ||
          translation.data.sourceVersion.length === 0)
      ) {
        throw new Error(
          `Missing source version for legal translation: ${policyId}:${translation.data.locale}`,
        );
      }
      if (
        translation.data.footer !== source.data.footer ||
        translation.data.order !== source.data.order
      ) {
        throw new Error(`Legal policy metadata differs from its source: ${policyId}`);
      }
    }
  }
}

export function legalPolicyLocale(policy: LegalPolicyEntry): Locale {
  if (!isLocale(policy.data.locale)) {
    throw new RangeError(`Legal policy locale is not enabled: ${policy.data.locale}`);
  }
  return policy.data.locale;
}

export function canServeLegalPolicy(
  policy: LegalPolicyEntry,
  source: LegalPolicyEntry,
  production: boolean,
): boolean {
  if (policy.data.status === 'superseded') return false;
  if (!production) return true;
  if (source.data.status !== 'current') return false;
  if (policy.data.status !== 'current') return false;

  if (policy.data.locale === baseLocale) return policy.data.translationStatus === 'source';

  return (
    policy.data.translationStatus === 'approved' &&
    policy.data.sourceVersion === source.data.version
  );
}

export function selectLegalPolicy<T extends LegalPolicyEntry>(
  policies: readonly T[],
  policyId: string,
  locale: string,
  production: boolean,
): T | undefined {
  const source = policies.find(
    (policy) => policy.data.policyId === policyId && policy.data.locale === baseLocale,
  );
  if (source === undefined) return undefined;

  const candidates = policies.filter(
    (policy) =>
      policy.data.policyId === policyId && canServeLegalPolicy(policy, source, production),
  );

  return (
    candidates.find((policy) => policy.data.locale === locale) ??
    candidates.find((policy) => policy.data.locale === baseLocale)
  );
}

export function selectLegalFooterPolicies<T extends LegalPolicyEntry>(
  policies: readonly T[],
  locale: string,
  production: boolean,
): T[] {
  const ids = [
    ...new Set(
      policies.filter((policy) => policy.data.footer).map((policy) => policy.data.policyId),
    ),
  ];

  return ids
    .map((policyId) => selectLegalPolicy(policies, policyId, locale, production))
    .filter((policy): policy is T => policy !== undefined)
    .sort((left, right) => left.data.order - right.data.order);
}
