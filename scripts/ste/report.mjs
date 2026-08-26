/**
 * How a result is presented.
 *
 * A run that finished is not the same thing as a conformance result. Every
 * format separates the complete standard-rule map from the smaller set of
 * machine checks.
 */

import { loadLexicon } from './lexicon.mjs';

const oneLine = (value) =>
  String(value)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 120);

const countBy = (diagnostics, key) => {
  const counts = new Map();
  for (const one of diagnostics) counts.set(one[key], (counts.get(one[key]) ?? 0) + 1);
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
};

export const summarize = (result, documents, scope) => {
  const controls = documents.conformance.rules ?? [];
  const standardRules = documents.conformance.standardRuleMap ?? [];
  const lexicon = loadLexicon(documents.policy);

  return {
    lexicon,
    unverifiedCitations: standardRules.filter((row) => row.sourceVerification !== 'verified')
      .length,
    profileVersion: documents.policy.profile.version,
    standard: oneLine(`${documents.policy.standard.name} Issue ${documents.policy.standard.issue}`),
    rolloutMode: oneLine(documents.policy.rollout.mode),
    scope,
    filesChecked: result.filesChecked,
    unitsChecked: result.unitsChecked,
    unsupportedUnits: result.unsupportedUnits,
    violations: result.diagnostics.length,
    byRule: Object.fromEntries(countBy(result.diagnostics, 'rule')),
    byFile: Object.fromEntries(countBy(result.diagnostics, 'file')),
    coverage: {
      implemented: controls.filter((row) => row.implementationStatus === 'implemented').length,
      notImplemented: controls.filter((row) => row.implementationStatus === 'not-implemented')
        .length,
      processOnly: controls.filter((row) => row.implementationStatus === 'process-only').length,
      controls: controls.length,
      knownWritingRules: documents.conformance.coverage?.knownWritingRules ?? null,
      mappedWritingRules: documents.conformance.coverage?.mappedWritingRules ?? null,
      completeRuleMap: documents.conformance.coverage?.completeRuleMap === true,
      standardFull: standardRules.filter((row) => row.checkerSupport === 'full').length,
      standardPartial: standardRules.filter((row) => row.checkerSupport === 'partial').length,
      standardNone: standardRules.filter((row) => row.checkerSupport === 'none').length,
    },
  };
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const claim = (summary) =>
  summary.violations === 0
    ? `The checker ran and found no violation in the ${summary.scope} scope. This result covers the ${summary.coverage.implemented} implemented checks only.`
    : `The checker ran and found ${plural(summary.violations, 'violation')} in the ${summary.scope} scope. This is an audit result, not a conformance statement.`;

const caveat = (summary) => {
  const mapping =
    summary.coverage.completeRuleMap &&
    summary.coverage.mappedWritingRules === summary.coverage.knownWritingRules
      ? `The standard-rule map includes all ${summary.coverage.knownWritingRules} writing rules in ASD-STE100 Issue 9.`
      : `The standard-rule map includes ${summary.coverage.mappedWritingRules} of ${summary.coverage.knownWritingRules} writing rules.`;

  const citations =
    summary.unverifiedCitations === 0
      ? 'All mapped rule identifiers are verified against the provided Issue 9 normative source.'
      : `${plural(summary.unverifiedCitations, 'rule citation')} still require verification against the normative source.`;

  return [
    mapping,
    citations,
    `Normative machine coverage is partial: ${summary.coverage.standardFull} rules have full checker support, ${summary.coverage.standardPartial} have partial support, and ${summary.coverage.standardNone} have no machine support.`,
    `${summary.coverage.notImplemented} LUDWISE enforcement controls are not implemented and ${summary.coverage.processOnly} are carried by review processes.`,
    summary.lexicon.loaded
      ? `Lexical validation uses the source "${summary.lexicon.source}".`
      : `No controlled dictionary is loaded, so no word was checked against one. ${summary.lexicon.reason}`,
  ];
};

export const formatText = (result, summary) => {
  const lines = [];
  for (const one of result.diagnostics) {
    lines.push(
      `${one.file}:${one.line}:${one.column}  ${one.rule}  ${one.message}  [${one.correction}]`,
    );
  }
  if (lines.length > 0) lines.push('');
  lines.push(
    `Standard: ${summary.standard}. Profile version ${summary.profileVersion}. Rollout mode: ${summary.rolloutMode}.`,
  );
  lines.push(
    `Files read: ${summary.filesChecked}. Prose units: ${summary.unitsChecked}. Units without extraction support: ${summary.unsupportedUnits}.`,
  );
  if (summary.violations > 0) {
    lines.push('', 'Violations by rule:');
    for (const [rule, count] of Object.entries(summary.byRule)) lines.push(`  ${count}\t${rule}`);
  }
  lines.push('', claim(summary));
  lines.push(
    `Enforcement controls: ${summary.coverage.implemented} implemented, ${summary.coverage.notImplemented} not implemented, ${summary.coverage.processOnly} carried by a process.`,
  );
  lines.push(...caveat(summary).map((one) => `  ${one}`));
  return lines.join('\n');
};

export const formatMarkdown = (summary) => {
  const lines = [
    '### Controlled language audit',
    '',
    `- Standard: ${summary.standard}, profile version ${summary.profileVersion}`,
    `- Rollout mode: \`${summary.rolloutMode}\`, scope: ${summary.scope}`,
    `- Files read: ${summary.filesChecked}, prose units: ${summary.unitsChecked}`,
    `- Violations: ${summary.violations}`,
    '',
    claim(summary),
    '',
    ...caveat(summary).map((one) => `- ${one}`),
  ];
  if (summary.violations > 0) {
    lines.push('', '| Count | Rule |', '| ---: | --- |');
    for (const [rule, count] of Object.entries(summary.byRule))
      lines.push(`| ${count} | \`${rule}\` |`);
  }
  return lines.join('\n');
};

export const formatJson = (result, summary) =>
  JSON.stringify({ summary, diagnostics: result.diagnostics }, null, 2);

export const formatMatrix = (documents) => {
  const lines = [
    `${documents.policy.standard.name} Issue ${documents.policy.standard.issue}, profile version ${documents.policy.profile.version}.`,
    '',
    `Access to the normative source: ${documents.conformance.normativeSourceAccess.state}.`,
    '',
    'Standard rule map:',
  ];
  for (const row of documents.conformance.standardRuleMap ?? []) {
    lines.push(
      `  ${row.ruleNumber}  section ${row.section}  ${row.enforcement}  support: ${row.checkerSupport}`,
    );
    lines.push(`    ${row.title}`);
    if (row.limitation) lines.push(`    limitation: ${row.limitation}`);
  }
  lines.push('', 'Enforcement controls:');
  for (const row of documents.conformance.rules ?? []) {
    const source =
      row.steReference.section === null
        ? 'LUDWISE extension'
        : `ASD-STE100 rule ${row.steReference.ruleNumber}`;
    lines.push(`${row.ludwiseRule}`);
    lines.push(
      `  ${source}  ${row.enforcement}  ${row.implementationStatus}  support: ${row.checkerSupport}`,
    );
    lines.push(`  ${row.title}`);
    if (row.limitations) lines.push(`  limitation: ${row.limitations}`);
  }
  return lines.join('\n');
};
