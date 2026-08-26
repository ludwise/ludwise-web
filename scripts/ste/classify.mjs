/**
 * Which content class a path belongs to.
 *
 * The table is ordered and the first rule that matches a unit wins, so a
 * specific rule can sit in front of a general one. The last rule is the
 * catch-all, and it applies only when no other rule matched at all.
 */

import { matchesAnyGlob } from './glob.mjs';

const extensionOf = (path) => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot);
};

export const classify = (path, policy) => {
  const matched = policy.classification.filter((rule) => matchesAnyGlob(path, rule.paths));
  const real = matched.filter((rule) => rule.catchAll !== true);
  const chosen = real.length > 0 ? real : matched;

  const assignments = [];
  const seen = new Set();

  for (const rule of chosen) {
    if (seen.has(rule.unit)) continue;
    seen.add(rule.unit);
    assignments.push({
      unit: rule.unit,
      contentClass: rule.class,
      prose: rule.prose ?? null,
      ruleId: rule.id,
    });
  }

  return { path, assignments, catchAllOnly: real.length === 0 };
};

export const isProseBearing = (path, policy) =>
  policy.proseBearingExtensions.includes(extensionOf(path));

export const classificationCoverage = (paths, policy) =>
  paths
    .filter((path) => isProseBearing(path, policy) && classify(path, policy).catchAllOnly)
    .map((path) => ({
      rule: 'LW-STE-CFG-CLASSIFICATION-COVERAGE',
      file: path,
      line: 1,
      column: 1,
      contentClass: null,
      unit: null,
      message:
        'The file can carry prose but only the catch-all rule matches it. Add a classification rule for it in docs/language/policy.json.',
      correction: 'classify-the-path',
    }));
