/**
 * Renders a Lighthouse run as the markdown a person reads in a job summary.
 *
 * The summary states what the run measured and what it judged. A pull request
 * that lowers a score must show the number that moved, and not only a red
 * check.
 */

import { formatFailure } from './evaluate.mjs';

const BYTES_IN_KIB = 1024;

const kibibytes = (bytes) => (bytes / BYTES_IN_KIB).toFixed(1);

const round = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function scoreTable(config, measurements) {
  const categories = Object.keys(config.categories);
  const metrics = Object.keys(config.metrics);
  const header = ['Route class', 'Form factor', ...categories, ...metrics];
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];

  for (const { routeClass, formFactor, summary } of measurements) {
    const cells = [
      routeClass,
      formFactor,
      ...categories.map((category) => round(summary.categories[category] ?? 0)),
      ...metrics.map((metric) => round(summary.metrics[metric] ?? 0)),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines;
}

function budgetTable(config, measurements) {
  const resourceTypes = Object.keys(config.budgets);

  if (resourceTypes.length === 0) {
    return [
      'No asset budget is set, so this run enforced none.',
      'The budgets belong in `lighthouse.config.json`, and a set budget blocks a merge.',
    ];
  }

  const header = ['Route class', 'Form factor', ...resourceTypes.map((type) => `${type} (KiB)`)];
  const lines = [
    `Limits, in kibibytes: ${resourceTypes
      .map((type) => `${type} ${String(config.budgets[type])}`)
      .join(', ')}.`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];

  for (const { routeClass, formFactor, summary } of measurements) {
    const cells = [
      routeClass,
      formFactor,
      ...resourceTypes.map((type) => kibibytes(summary.resources[type] ?? 0)),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines;
}

/** The whole run, as markdown. */
export function renderSummary({ config, target, mode, measurements, failures }) {
  const verdict = failures.length === 0 ? 'passed' : 'failed';
  const lines = [
    '## Lighthouse',
    '',
    `The gate ${verdict}.`,
    '',
    `- Target: ${target}`,
    `- Mode: ${mode}`,
    `- Samples for each route class and form factor: ${String(config.samples)}`,
    `- Every value below is the median of those samples.`,
    '',
  ];

  if (failures.length > 0) {
    lines.push('### What failed', '');
    for (const failure of failures) lines.push(`- ${formatFailure(failure)}`);
    lines.push('');
  }

  lines.push('### Scores and lab metrics', '', ...scoreTable(config, measurements), '');
  lines.push('### Asset budgets', '', ...budgetTable(config, measurements), '');

  return lines.join('\n');
}
