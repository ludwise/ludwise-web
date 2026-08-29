import { baseLocale, isLocale, type Locale } from '../../i18n/index.js';

export type LegalPolicyStatus = 'draft' | 'current' | 'superseded';
export type LegalTranslationStatus = 'source' | 'draft' | 'approved';

export interface LegalPolicyData {
  policyId: string;
  translationStatus: LegalTranslationStatus;
  footer: boolean;
  order: number;
  version: string;
  status: LegalPolicyStatus;
  sourceVersion?: string | undefined;
}

export interface LegalPolicyEntry {
  id: string;
  data: LegalPolicyData;
}

interface LegalPolicyPath {
  locale: string;
  policyId: string;
}

const legalPolicyPath = (policy: LegalPolicyEntry): LegalPolicyPath => {
  const parts = policy.id.split('/');
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    throw new Error(`Legal policy path must be <locale>/<policyId>.md: ${policy.id}`);
  }

  return { locale: parts[0]!, policyId: parts[1]! };
};

export function assertLegalPolicies(policies: readonly LegalPolicyEntry[]): void {
  const identities = new Set<string>();
  const policyIds = new Set<string>();

  for (const policy of policies) {
    const path = legalPolicyPath(policy);
    if (path.policyId !== policy.data.policyId) {
      throw new Error(
        `Legal policy path differs from its policy ID: ${policy.id} (${policy.data.policyId})`,
      );
    }

    policyIds.add(path.policyId);
    const identity = `${path.policyId}:${path.locale}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate legal policy locale: ${identity}`);
    }
    identities.add(identity);

    const isSourceLocale = path.locale === baseLocale;
    if (isSourceLocale !== (policy.data.translationStatus === 'source')) {
      throw new Error(`Invalid legal translation status: ${identity}`);
    }
  }

  for (const policyId of policyIds) {
    const source = policies.find((policy) => {
      const path = legalPolicyPath(policy);
      return path.policyId === policyId && path.locale === baseLocale;
    });
    if (source === undefined) throw new Error(`Missing source legal policy: ${policyId}`);

    for (const translation of policies.filter(
      (policy) => legalPolicyPath(policy).policyId === policyId,
    )) {
      const locale = legalPolicyPath(translation).locale;
      if (
        locale !== baseLocale &&
        (typeof translation.data.sourceVersion !== 'string' ||
          translation.data.sourceVersion.length === 0)
      ) {
        throw new Error(`Missing source version for legal translation: ${policyId}:${locale}`);
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
  const locale = legalPolicyPath(policy).locale;
  if (!isLocale(locale)) {
    throw new RangeError(`Legal policy locale is not enabled: ${locale}`);
  }
  return locale;
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

  if (legalPolicyPath(policy).locale === baseLocale) {
    return policy.data.translationStatus === 'source';
  }

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
  const source = policies.find((policy) => {
    const path = legalPolicyPath(policy);
    return path.policyId === policyId && path.locale === baseLocale;
  });
  if (source === undefined) return undefined;

  const candidates = policies.filter(
    (policy) =>
      legalPolicyPath(policy).policyId === policyId &&
      canServeLegalPolicy(policy, source, production),
  );

  return (
    candidates.find((policy) => legalPolicyPath(policy).locale === locale) ??
    candidates.find((policy) => legalPolicyPath(policy).locale === baseLocale)
  );
}

export function selectLegalFooterPolicies<T extends LegalPolicyEntry>(
  policies: readonly T[],
  locale: string,
  production: boolean,
): T[] {
  const ids = [
    ...new Set(
      policies
        .filter((policy) => policy.data.footer)
        .map((policy) => legalPolicyPath(policy).policyId),
    ),
  ];

  return ids
    .map((policyId) => selectLegalPolicy(policies, policyId, locale, production))
    .filter((policy): policy is T => policy !== undefined)
    .sort((left, right) => left.data.order - right.data.order);
}
