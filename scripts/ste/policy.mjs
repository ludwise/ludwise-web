/**
 * The language policy files, and their own validity.
 *
 * The standard-rule map and the checker-control registry are different layers.
 * The first must contain all 53 Issue 9 writing rules. The second records only
 * checks and review controls that LUDWISE can actually apply.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { knownLexiconSources } from './lexicon.mjs';

export const LANGUAGE_DIRECTORY = 'docs/language';

const FILES = {
  policy: 'policy.json',
  terminology: 'terminology.json',
  conformance: 'conformance.json',
  exceptions: 'exceptions.json',
};

const STANDARD_SECTIONS = new Map([
  [1, { name: 'Words', rules: 14 }],
  [2, { name: 'Multi-word nouns', rules: 2 }],
  [3, { name: 'Verbs', rules: 7 }],
  [4, { name: 'Sentences', rules: 5 }],
  [5, { name: 'Procedural writing', rules: 5 }],
  [6, { name: 'Descriptive writing', rules: 6 }],
  [7, { name: 'Safety instructions', rules: 3 }],
  [8, { name: 'Punctuation and word count', rules: 7 }],
  [9, { name: 'Writing practices', rules: 4 }],
]);

const STANDARD_RULE_IDS = [...STANDARD_SECTIONS.entries()].flatMap(([section, definition]) =>
  Array.from({ length: definition.rules }, (_, index) => `${section}.${index + 1}`),
);

export class PolicyError extends Error {}

const read = (rootDir, name) => {
  const path = join(rootDir, LANGUAGE_DIRECTORY, name);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new PolicyError(`The language policy file ${LANGUAGE_DIRECTORY}/${name} is missing.`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new PolicyError(`${LANGUAGE_DIRECTORY}/${name} is not valid JSON: ${error.message}`);
  }
};

export const loadLanguageDocuments = (rootDir) => ({
  policy: read(rootDir, FILES.policy),
  terminology: read(rootDir, FILES.terminology),
  conformance: read(rootDir, FILES.conformance),
  exceptions: read(rootDir, FILES.exceptions),
});

const finding = (rule, file, message) => ({
  rule,
  file: `${LANGUAGE_DIRECTORY}/${file}`,
  line: 1,
  column: 1,
  contentClass: null,
  unit: null,
  message,
  correction: 'correct-the-policy',
});

const isLabel = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[\r\n]/.test(value);

const isWord = (value) => typeof value === 'string' && value.trim().length > 0;

const duplicates = (values) => {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};

const validatePolicyFile = (policy) => {
  const found = [];
  const add = (message) => found.push(finding('LW-STE-CFG-POLICY', FILES.policy, message));

  if (policy.profile?.version !== 1) add('The profile version must be the number 1.');
  if (policy.standard?.pinned !== true) add('The normative standard must be pinned.');
  if (policy.standard?.issue !== '9') add('The standard issue must be the string "9".');
  if (policy.standard?.issueDate !== '2025-01-15')
    add('The pinned Issue 9 date must be 2025-01-15.');

  const modes = policy.rollout?.modes ?? [];
  if (!modes.includes(policy.rollout?.mode)) {
    add(`The rollout mode "${policy.rollout?.mode}" is not one of ${modes.join(', ')}.`);
  }
  if (policy.rollout?.mode === 'audit' && (policy.rollout.enforcedPaths ?? []).length === 0) {
    add('Audit mode with no enforced path would make the gating check pass over nothing.');
  }
  if (!isLabel(policy.rollout?.enforcementCheckName)) {
    add('The name of the check that branch protection must require is missing or malformed.');
  }
  if (!isLabel(policy.standard?.name))
    add('The standard name must be one short line. A report prints it.');

  const classes = Object.keys(policy.contentClasses ?? {});
  const units = Object.keys(policy.units ?? {});
  const table = policy.classification ?? [];
  if (table.length === 0) add('The classification table is empty.');

  for (const rule of table) {
    for (const field of ['id', 'paths', 'unit', 'class', 'reason']) {
      if (rule[field] === undefined)
        add(`The classification rule ${rule.id ?? '(unnamed)'} has no ${field}.`);
    }
    if (!classes.includes(rule.class))
      add(`The rule ${rule.id} names the unknown content class ${rule.class}.`);
    if (!units.includes(rule.unit)) add(`The rule ${rule.id} names the unknown unit ${rule.unit}.`);
  }

  const last = table[table.length - 1];
  if (last?.catchAll !== true) add('The last classification rule must be the catch-all rule.');
  for (const identifier of duplicates(table.map((rule) => rule.id)))
    add(`The classification rule identifier ${identifier} is used twice.`);

  for (const variant of policy.spelling?.variants ?? []) {
    if (!isWord(variant.variant) || !isWord(variant.preferred))
      add('A spelling variant is empty, and an empty pattern matches every position.');
  }
  for (const word of policy.contractions?.words ?? []) {
    if (!isWord(word))
      add('A contraction entry is empty, and an empty pattern matches every position.');
  }
  for (const form of policy.punctuation?.alternativeSlash ?? []) {
    if (!isWord(form))
      add('A punctuation entry is empty, and an empty pattern matches every position.');
  }

  for (const limit of [
    'proceduralSentenceWords',
    'descriptiveSentenceWords',
    'paragraphSentences',
  ]) {
    if (!Number.isInteger(policy.limits?.[limit]) || policy.limits[limit] <= 0)
      add(`The limit ${limit} must be a positive whole number.`);
  }
  if (policy.limits?.proceduralSentenceWords !== 20)
    add('The procedural sentence limit must be 20 words for Issue 9 rule 5.1.');
  if (policy.limits?.descriptiveSentenceWords !== 25)
    add('The descriptive sentence limit must be 25 words for Issue 9 rule 6.3.');
  if (policy.limits?.paragraphSentences !== 6)
    add('The descriptive paragraph limit must be six sentences for Issue 9 rule 6.6.');

  if ((policy.proseBearingExtensions ?? []).length === 0)
    add('The list of prose bearing extensions is empty, so nothing would be classified.');

  if (policy.lexicon === undefined) {
    add('The policy must record the state of the controlled dictionary, even when none is loaded.');
  } else if (
    policy.lexicon.source !== null &&
    !knownLexiconSources().includes(policy.lexicon.source)
  ) {
    add(
      `The policy declares the lexicon source "${policy.lexicon.source}" and no adapter is registered for it.`,
    );
  } else if (policy.lexicon.source === null && !policy.lexicon.reason) {
    add('The policy declares no lexicon source and records no reason.');
  }

  return found;
};

const validateTerminology = (terminology, policy) => {
  const found = [];
  const add = (message) =>
    found.push(finding('LW-STE-CFG-TERMINOLOGY', FILES.terminology, message));

  if (terminology.profile?.version !== policy.profile?.version)
    add('The terminology profile version differs from the policy profile version.');

  const terms = terminology.terms ?? [];
  const lower = (value) => String(value).toLowerCase();
  const patterns = [
    ...terms.flatMap((term) =>
      (term.prohibitedSynonyms ?? []).map((one) => ['A prohibited synonym', one.term]),
    ),
    ...(terminology.prohibited ?? []).map((one) => ['A prohibited expression', one.expression]),
    ...(terminology.prohibitedAbbreviations ?? []).map((one) => [
      'A prohibited abbreviation',
      one.abbreviation,
    ]),
    ...(terminology.officialNames ?? []).map((one) => ['An official name', one]),
  ];
  for (const [what, value] of patterns)
    if (!isWord(value)) add(`${what} is empty, and an empty pattern matches every position.`);

  for (const identifier of duplicates(terms.map((term) => term.conceptId)))
    add(`The concept identifier ${identifier} is used twice.`);
  for (const preferred of duplicates(terms.map((term) => lower(term.preferredTerm))))
    add(
      `Two concepts claim the preferred term "${preferred}". One concept has one preferred term.`,
    );

  for (const term of terms) {
    for (const field of [
      'conceptId',
      'preferredTerm',
      'partOfSpeech',
      'meaning',
      'source',
      'status',
    ]) {
      if (term[field] === undefined || term[field] === null)
        add(`The term ${term.conceptId ?? '(unnamed)'} has no ${field}.`);
    }
  }

  const preferredTerms = new Set(terms.map((term) => lower(term.preferredTerm)));
  const synonyms = [];
  for (const term of terms) {
    for (const synonym of term.prohibitedSynonyms ?? []) {
      synonyms.push(lower(synonym.term));
      if (preferredTerms.has(lower(synonym.term)))
        add(`"${synonym.term}" is both a preferred term and a prohibited synonym.`);
    }
  }
  for (const synonym of duplicates(synonyms))
    add(`The prohibited synonym "${synonym}" is listed under two concepts.`);

  const approved = (terminology.abbreviations ?? []).map((one) => one.abbreviation);
  for (const abbreviation of duplicates(approved))
    add(`The abbreviation ${abbreviation} is listed twice.`);
  for (const entry of terminology.prohibitedAbbreviations ?? [])
    if (approved.includes(entry.abbreviation))
      add(`The abbreviation ${entry.abbreviation} is approved and prohibited at the same time.`);
  for (const entry of terminology.abbreviations ?? [])
    if (entry.expandOnFirstUse === true && !entry.expansion)
      add(`The abbreviation ${entry.abbreviation} needs a full term but records none.`);

  const reserved = new Set([
    ...terms.map((term) => lower(term.preferredTerm)),
    ...synonyms,
    ...(terminology.prohibitedAbbreviations ?? []).map((one) => lower(one.abbreviation)),
  ]);
  for (const name of terminology.officialNames ?? [])
    if (reserved.has(lower(name)))
      add(
        `The official name "${name}" is also a controlled word, so listing it would hide every finding over it.`,
      );
  for (const name of duplicates((terminology.officialNames ?? []).map((one) => lower(one))))
    add(`The official name "${name}" is listed twice.`);

  for (const conflict of terminology.conflicts ?? []) {
    for (const field of ['id', 'status', 'concept', 'candidates', 'evidence', 'phase2'])
      if (conflict[field] === undefined)
        add(`The conflict ${conflict.id ?? '(unnamed)'} has no ${field}.`);
    if (conflict.status === 'resolved' && !conflict.resolution)
      add(`The conflict ${conflict.id} is marked resolved but records no resolution.`);
  }
  return found;
};

const validateStandardRuleMap = (conformance, add) => {
  const mapped = conformance.standardRuleMap ?? [];
  const byNumber = new Map(mapped.map((row) => [row.ruleNumber, row]));
  if (mapped.length !== STANDARD_RULE_IDS.length)
    add(
      `The standard-rule map must have ${STANDARD_RULE_IDS.length} rows and has ${mapped.length}.`,
    );
  for (const identifier of duplicates(mapped.map((row) => row.ruleNumber)))
    add(`The standard-rule map lists ${identifier} twice.`);
  for (const ruleNumber of STANDARD_RULE_IDS)
    if (!byNumber.has(ruleNumber))
      add(`The standard-rule map is missing Issue 9 rule ${ruleNumber}.`);

  for (const row of mapped) {
    if (!STANDARD_RULE_IDS.includes(row.ruleNumber)) {
      add(`The standard-rule map contains the unknown Issue 9 rule ${row.ruleNumber}.`);
      continue;
    }
    const section = Number(row.ruleNumber.split('.')[0]);
    const expected = STANDARD_SECTIONS.get(section);
    if (row.section !== section) add(`Rule ${row.ruleNumber} must be in section ${section}.`);
    if (row.sectionName !== expected?.name)
      add(`Rule ${row.ruleNumber} must use the section name "${expected?.name}".`);
    if (row.sourceVerification !== 'verified')
      add(`Rule ${row.ruleNumber} is not verified against the Issue 9 normative source.`);
    for (const field of ['title', 'enforcement', 'checkerSupport', 'humanReview', 'limitation'])
      if (!isWord(row[field])) add(`Rule ${row.ruleNumber} has no ${field}.`);
  }
};

const validateConformance = (conformance, policy, implementedRuleIds) => {
  const found = [];
  const add = (message) =>
    found.push(finding('LW-STE-CFG-CONFORMANCE', FILES.conformance, message));

  if (conformance.$schemaVersion !== 2) add('The conformance schema version must be 2.');
  if (conformance.profile?.version !== policy.profile?.version)
    add('The conformance profile version differs from the policy profile version.');
  if (conformance.normativeSourceAccess?.state !== 'verified')
    add('The Issue 9 normative source must be recorded as verified before this phase can pass.');

  const sections = conformance.sections ?? [];
  if (sections.length !== STANDARD_SECTIONS.size)
    add('The matrix must record all nine sections of the writing rules.');
  for (const [number, expected] of STANDARD_SECTIONS) {
    const section = sections.find((one) => one.number === number);
    if (section?.name !== expected.name) add(`Section ${number} must be named "${expected.name}".`);
    if (section?.sourceVerification !== 'verified')
      add(`Section ${number} is not verified against the Issue 9 normative source.`);
  }

  validateStandardRuleMap(conformance, add);

  const rows = conformance.rules ?? [];
  const listed = new Set(rows.map((row) => row.ludwiseRule));
  const mappedRules = new Map(
    (conformance.standardRuleMap ?? []).map((row) => [row.ruleNumber, row]),
  );
  for (const identifier of duplicates(rows.map((row) => row.ludwiseRule)))
    add(`The checker-control registry lists ${identifier} twice.`);
  for (const rule of implementedRuleIds)
    if (!listed.has(rule))
      add(`The checker can emit ${rule} but the control registry does not list it.`);

  for (const row of rows) {
    if (row.implementationStatus === 'implemented' && !implementedRuleIds.includes(row.ludwiseRule))
      add(`The registry calls ${row.ludwiseRule} implemented but the checker cannot emit it.`);
    if (row.enforcement === 'semantic' && row.checkerSupport === 'full')
      add(`${row.ludwiseRule} is semantic, so it cannot claim full checker support.`);
    if (row.checkerSupport !== 'full' && !isWord(row.limitations))
      add(`${row.ludwiseRule} is not fully supported and records no limitation.`);

    const reference = row.steReference ?? {};
    if (reference.ruleNumber === null || reference.ruleNumber === undefined) {
      if (reference.section !== null || reference.sectionName !== null)
        add(`${row.ludwiseRule} is a LUDWISE extension but still names an ASD-STE100 section.`);
      continue;
    }
    const mapped = mappedRules.get(reference.ruleNumber);
    if (mapped === undefined) {
      add(
        `${row.ludwiseRule} cites Issue 9 rule ${reference.ruleNumber}, which is absent from the standard-rule map.`,
      );
      continue;
    }
    if (reference.section !== mapped.section || reference.sectionName !== mapped.sectionName)
      add(
        `${row.ludwiseRule} does not use the verified section for Issue 9 rule ${reference.ruleNumber}.`,
      );
    if (reference.sourceVerification !== 'verified')
      add(`${row.ludwiseRule} has an unverified Issue 9 rule citation.`);
  }

  const coverage = conformance.coverage ?? {};
  const linked = rows.filter(
    (row) => row.steReference?.ruleNumber !== null && row.steReference?.ruleNumber !== undefined,
  );
  if (coverage.knownSections !== 9) add('Coverage must record nine standard sections.');
  if (coverage.knownWritingRules !== 53) add('Coverage must record 53 Issue 9 writing rules.');
  if (coverage.standardRuleMapRows !== (conformance.standardRuleMap ?? []).length)
    add('The recorded standard-rule-map row count does not match the map.');
  if (coverage.mappedWritingRules !== 53 || coverage.completeRuleMap !== true)
    add('Coverage must state that all 53 Issue 9 writing rules are mapped.');
  if (coverage.rowsCitingASection !== linked.length)
    add(
      `The matrix says ${coverage.rowsCitingASection} controls cite a standard rule, and ${linked.length} do.`,
    );
  if (coverage.ludwiseExtensionRows !== rows.length - linked.length)
    add('The count of LUDWISE extension controls does not match the registry.');
  if (coverage.totalRows !== rows.length)
    add('The recorded control count does not match the registry.');
  return found;
};

const validateExemptions = (policy, implementedExemptionIds) => {
  const found = [];
  const add = (message) => found.push(finding('LW-STE-CFG-EXEMPTION', FILES.policy, message));
  const declared = [...(policy.exemptions?.blocks ?? []), ...(policy.exemptions?.spans ?? [])].map(
    (one) => one.id,
  );
  for (const identifier of declared)
    if (!implementedExemptionIds.includes(identifier))
      add(`The exemption ${identifier} is declared but the checker does not implement it.`);
  for (const identifier of implementedExemptionIds)
    if (!declared.includes(identifier))
      add(`The checker implements the exemption ${identifier} but the policy does not declare it.`);
  return found;
};

const validateExceptions = (exceptions, policy, implementedRuleIds) => {
  const found = [];
  const add = (rule, message) => found.push(finding(rule, FILES.exceptions, message));
  if (exceptions.profile?.version !== policy.profile?.version)
    add(
      'LW-STE-EXCEPTION-INVALID',
      'The exception profile version differs from the policy profile version.',
    );

  const required = exceptions.requiredFields ?? ['id', 'scope', 'rules', 'reason', 'owner'];
  const today = new Date().toISOString().slice(0, 10);
  for (const exception of exceptions.exceptions ?? []) {
    for (const field of required)
      if (exception[field] === undefined)
        add(
          'LW-STE-EXCEPTION-INVALID',
          `The exception ${exception.id ?? '(unnamed)'} has no ${field}.`,
        );
    for (const rule of exception.rules ?? [])
      if (!implementedRuleIds.includes(rule))
        add(
          'LW-STE-EXCEPTION-INVALID',
          `The exception ${exception.id} names the unknown rule ${rule}.`,
        );
    if ((exception.scope?.paths ?? []).length === 0)
      add('LW-STE-EXCEPTION-INVALID', `The exception ${exception.id} names no path.`);
    if (typeof exception.expires === 'string' && exception.expires < today)
      add(
        'LW-STE-EXCEPTION-EXPIRED',
        `The exception ${exception.id} expired on ${exception.expires}.`,
      );
  }
  return found;
};

export const validateConfiguration = (documents, registry) => {
  const { policy, terminology, conformance, exceptions } = documents;
  return [
    ...validatePolicyFile(policy),
    ...validateTerminology(terminology, policy),
    ...validateConformance(conformance, policy, registry.implementedRuleIds),
    ...validateExemptions(policy, registry.implementedExemptionIds),
    ...validateExceptions(exceptions, policy, registry.implementedRuleIds),
  ];
};
