/**
 * The deterministic rules.
 *
 * Each rule states one measurable property of the text. A rule that needs
 * meaning is absent on purpose. The conformance matrix records it instead, so
 * the checker never blocks a build on a semantic guess.
 */

import { maskSpans } from './mask.mjs';
import { countWords, parentheticalSentences, splitSentences } from './segment.mjs';

export const PROSE_RULE_IDS = [
  'LW-STE-PROSE-KIND-UNRESOLVED',
  'LW-STE-SENTENCE-LENGTH-PROCEDURAL',
  'LW-STE-SENTENCE-LENGTH-DESCRIPTIVE',
  'LW-STE-PARAGRAPH-SENTENCES',
  'LW-STE-CONTRACTION',
  'LW-STE-TERM-PREFERRED',
  'LW-STE-TERM-PROHIBITED',
  'LW-STE-PHRASAL-VERB-RECORDED',
  'LW-STE-SPELLING-VARIANT',
  'LW-STE-PUNCTUATION-SEMICOLON',
  'LW-STE-ABBREVIATION-PROHIBITED',
  'LW-STE-ABBREVIATION-EXPANSION',
  'LW-STE-CAUSAL-SINCE',
  'LW-STE-PUNCTUATION-ALTERNATIVE-SLASH',
];

export const CONFIGURATION_RULE_IDS = [
  'LW-STE-FILE-UNREADABLE',
  'LW-STE-CFG-POLICY',
  'LW-STE-CFG-TERMINOLOGY',
  'LW-STE-CFG-CONFORMANCE',
  'LW-STE-CFG-EXEMPTION',
  'LW-STE-CFG-CLASSIFICATION-COVERAGE',
  'LW-STE-EXCEPTION-INVALID',
  'LW-STE-EXCEPTION-EXPIRED',
  'LW-STE-EXCEPTION-UNUSED',
];

export const IMPLEMENTED_RULE_IDS = [...PROSE_RULE_IDS, ...CONFIGURATION_RULE_IDS];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const apostrophes = (value) => escapeRegExp(value).replace(/'/g, "['’]");

const phrasePattern = (expression) => {
  const left = /^[\w]/.test(expression) ? '\\b' : '';
  const right = /[\w]$/.test(expression) ? '\\b' : '';
  return new RegExp(`${left}${apostrophes(expression)}${right}`, 'gi');
};

const matchesOf = (text, pattern) => {
  pattern.lastIndex = 0;
  const found = [];
  let match = pattern.exec(text);
  while (match !== null) {
    found.push({ index: match.index, text: match[0] });
    if (match[0].length === 0) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
  return found;
};

const coveredBy = (text, index, length, phrases) =>
  phrases.some((phrase) => {
    const lower = text.toLowerCase();
    const needle = phrase.toLowerCase();
    let from = lower.indexOf(needle);
    while (from !== -1) {
      if (from <= index && index + length <= from + needle.length) return true;
      from = lower.indexOf(needle, from + 1);
    }
    return false;
  });

const contractionPatterns = (contractions) => {
  const patterns = (contractions.words ?? []).map((word) => phrasePattern(word));
  const suffixes = (contractions.suffixes ?? []).map((suffix) => apostrophes(suffix));
  if (suffixes.length > 0) {
    patterns.push(new RegExp(`\\b\\p{L}+(?:${suffixes.join('|')})\\b`, 'giu'));
  }
  return patterns;
};

/**
 * Which sentence limit a unit is measured against.
 *
 * A declaration wins over any default, because Issue 9 separates a procedure
 * from a description by function. A heading declaration is narrower than the
 * document one, so it is read first. List shape is only an estimate, and
 * enforcement never trusts it.
 */
const resolveProse = (unit, fallback) => {
  if (unit.declaredProse === 'procedural' || unit.declaredProse === 'descriptive') {
    return unit.declaredProse;
  }
  if (fallback === 'procedural' || fallback === 'descriptive') return fallback;
  if (unit.kind === 'list-item') return 'mixed';
  const declared = unit.prose ?? fallback;
  if (declared === 'procedural' || declared === 'descriptive') return declared;
  return 'mixed';
};

export const runRules = (units, context) => {
  const { policy, terminology } = context;
  const allowed = context.allowedRules === undefined ? null : new Set(context.allowedRules);
  const permits = (rule) => allowed === null || allowed.has(rule);

  const officialNames = terminology.officialNames ?? [];
  const abbreviations = policy.sentenceBoundary?.abbreviations ?? [];
  const contractions = contractionPatterns(policy.contractions ?? {});
  const diagnostics = [];

  const at = (unit, index) => {
    const map = unit.map;
    if (map === undefined || map.length === 0) return (unit.start ?? 0) + index;
    return map[Math.min(index, map.length - 1)];
  };

  const report = (unit, index, rule, message, correction) => {
    if (!permits(rule)) return;
    diagnostics.push({ rule, offset: at(unit, index), message, correction });
  };

  const expansionsSeen = [];
  const expansionReported = new Set();

  for (const unit of units) {
    const options = { officialNames, commitPrefix: context.commitPrefix === true };
    const masked = maskSpans(unit.text, options);
    const structural = maskSpans(unit.text, { ...options, tokens: false });
    const sentences = splitSentences(masked, { abbreviations });
    const declaredProse = resolveProse(unit, context.defaultProse);

    if (declaredProse === 'mixed' && policy.rollout?.mode === 'enforce') {
      report(
        unit,
        0,
        'LW-STE-PROSE-KIND-UNRESOLVED',
        'Enforcement cannot decide whether this prose is procedural or descriptive.',
        'classify-the-prose-kind',
      );
    }

    const prose =
      declaredProse === 'procedural' ||
      (declaredProse === 'mixed' &&
        policy.rollout?.mode !== 'enforce' &&
        unit.prose === 'procedural')
        ? 'procedural'
        : 'descriptive';
    const measureLength = declaredProse !== 'mixed' || policy.rollout?.mode !== 'enforce';
    const limit =
      prose === 'procedural'
        ? policy.limits.proceduralSentenceWords
        : policy.limits.descriptiveSentenceWords;
    const lengthRule =
      prose === 'procedural'
        ? 'LW-STE-SENTENCE-LENGTH-PROCEDURAL'
        : 'LW-STE-SENTENCE-LENGTH-DESCRIPTIVE';

    if (measureLength && unit.kind !== 'heading') {
      for (const sentence of sentences) {
        const source = structural.slice(sentence.start, sentence.end);
        const words = countWords(source);
        if (words > limit) {
          report(
            unit,
            sentence.start,
            lengthRule,
            `The ${prose} sentence has ${words} words and the limit is ${limit}.`,
            'shorten-or-split-the-sentence',
          );
        }
      }

      for (const sentence of parentheticalSentences(structural, { abbreviations })) {
        const words = countWords(sentence.text);
        if (words > limit) {
          report(
            unit,
            sentence.start,
            lengthRule,
            `The parenthetical ${prose} sentence has ${words} words and the limit is ${limit}.`,
            'shorten-or-split-the-parenthetical-sentence',
          );
        }
      }
    }

    if (
      unit.kind === 'paragraph' &&
      prose === 'descriptive' &&
      sentences.length > policy.limits.paragraphSentences
    ) {
      report(
        unit,
        0,
        'LW-STE-PARAGRAPH-SENTENCES',
        `The paragraph has ${sentences.length} sentences and the limit is ${policy.limits.paragraphSentences}.`,
        'split-the-paragraph',
      );
    }

    for (const found of matchesOf(structural, /;/g)) {
      report(
        unit,
        found.index,
        'LW-STE-PUNCTUATION-SEMICOLON',
        'ASD-STE100 Issue 9 does not permit a semicolon in controlled prose.',
        'replace-the-semicolon-with-sentences',
      );
    }

    for (const pattern of contractions) {
      for (const found of matchesOf(masked, pattern)) {
        report(
          unit,
          found.index,
          'LW-STE-CONTRACTION',
          `Do not write the contraction "${found.text}". Write the full form.`,
          'write-the-full-form',
        );
      }
    }

    for (const term of terminology.terms ?? []) {
      for (const synonym of term.prohibitedSynonyms ?? []) {
        for (const found of matchesOf(masked, phrasePattern(synonym.term))) {
          if (coveredBy(masked, found.index, found.text.length, synonym.unless ?? [])) continue;
          report(
            unit,
            found.index,
            'LW-STE-TERM-PREFERRED',
            `"${found.text}" is a prohibited synonym. The preferred term for this concept is "${term.preferredTerm}".`,
            'use-the-preferred-term',
          );
        }
      }
    }

    for (const entry of terminology.prohibited ?? []) {
      const isPhrasalVerb = /phrasal verb/i.test(entry.reason ?? '');
      for (const found of matchesOf(masked, phrasePattern(entry.expression))) {
        if (coveredBy(masked, found.index, found.text.length, entry.unless ?? [])) continue;
        // An exact-case exemption. "SHOULD" is the requirement level that
        // PRODUCT.md defines, and it is a different token from the ordinary
        // word. The unless list cannot say this, because it is case-blind.
        if ((entry.unlessExactly ?? []).includes(found.text)) continue;
        report(
          unit,
          found.index,
          isPhrasalVerb ? 'LW-STE-PHRASAL-VERB-RECORDED' : 'LW-STE-TERM-PROHIBITED',
          `"${found.text}" is prohibited. ${entry.reason ?? ''} Write ${entry.suggestion} instead.`.trim(),
          isPhrasalVerb ? 'replace-the-phrasal-verb' : 'use-an-approved-word',
        );
      }
    }

    for (const variant of policy.spelling?.variants ?? []) {
      for (const found of matchesOf(masked, phrasePattern(variant.variant))) {
        report(
          unit,
          found.index,
          'LW-STE-SPELLING-VARIANT',
          `"${found.text}" is not the LUDWISE spelling. Write "${variant.preferred}".`,
          'use-the-approved-spelling',
        );
      }
    }

    for (const entry of terminology.prohibitedAbbreviations ?? []) {
      for (const found of matchesOf(masked, phrasePattern(entry.abbreviation))) {
        report(
          unit,
          found.index,
          'LW-STE-ABBREVIATION-PROHIBITED',
          `"${found.text}" is a prohibited abbreviation. Write "${entry.expansion}".`,
          'write-the-full-term',
        );
      }
    }

    for (const entry of terminology.abbreviations ?? []) {
      if (entry.expandOnFirstUse !== true) continue;
      if (expansionReported.has(entry.abbreviation)) continue;

      for (const found of matchesOf(
        masked,
        new RegExp(`\\b${escapeRegExp(entry.abbreviation)}\\b`, 'g'),
      )) {
        const before = [...expansionsSeen, masked.slice(0, found.index)].join(' ').toLowerCase();
        if (before.includes(entry.expansion.toLowerCase())) break;

        expansionReported.add(entry.abbreviation);
        report(
          unit,
          found.index,
          'LW-STE-ABBREVIATION-EXPANSION',
          `Write "${entry.expansion}" before the first use of "${entry.abbreviation}" in this file.`,
          'expand-on-first-use',
        );
        break;
      }
    }

    /**
     * Causal "since" only. Issue 9 keeps "since" for time. A clause that
     * gives a reason must read "because". No word list separates the two.
     * The rule reads the shape a reason takes. It matches "since" that
     * opens a sentence, and "since" after a comma. A date phrase such as
     * "observed since May 2026" is time. That phrase stays.
     */
    if ((policy.causalSince?.patterns ?? []).length > 0) {
      for (const found of matchesOf(masked, /(?:^|[.!?]\s+|,\s*)(since)\b/giu)) {
        const at = found.index + found.text.toLowerCase().lastIndexOf('since');
        report(
          unit,
          at,
          'LW-STE-CAUSAL-SINCE',
          'This "since" gives a reason. Write "because", and keep "since" for time.',
          'write-because',
        );
      }
    }

    for (const form of policy.punctuation?.alternativeSlash ?? []) {
      for (const found of matchesOf(structural, phrasePattern(form))) {
        report(
          unit,
          found.index,
          'LW-STE-PUNCTUATION-ALTERNATIVE-SLASH',
          `"${found.text}" joins two alternatives with a slash. Write one word, or write "and" or "or".`,
          'replace-the-slash',
        );
      }
    }

    expansionsSeen.push(masked);
  }

  return diagnostics.sort((left, right) => left.offset - right.offset);
};
