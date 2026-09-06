#!/usr/bin/env node
/**
 * Measures Lighthouse against one target, and judges the committed limits.
 *
 * One command serves both runs of this repository. The deterministic run
 * measures a production build that `wrangler dev` serves over the recorded
 * fixtures, and it blocks. The production run measures the live site, and it
 * reports without blocking.
 *
 * Usage:
 *   node scripts/lighthouse.mjs --target http://127.0.0.1:4321
 *   node scripts/lighthouse.mjs --target https://ludwise.com --mode production
 *
 * Every threshold, lab metric limit and asset budget lives in
 * `lighthouse.config.json`. This file states none of them.
 */

import { appendFileSync } from 'node:fs';

import { loadGateConfig } from './lighthouse/config.mjs';
import { evaluateMeasurements, formatFailure } from './lighthouse/evaluate.mjs';
import { measure } from './lighthouse/measure.mjs';
import { parseOptions } from './lighthouse/options.mjs';
import { renderSummary } from './lighthouse/report.mjs';

function writeStepSummary(markdown) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path !== undefined) appendFileSync(path, `${markdown}\n`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const config = loadGateConfig();
  const samples = options.samples ?? config.samples;

  const { measurements, reportDir } = await measure({
    config,
    target: options.target,
    mode: options.mode,
    samples,
    reportDir: options.reportDir,
  });

  const failures = evaluateMeasurements(config, measurements);
  const markdown = renderSummary({
    config,
    target: options.target,
    mode: options.mode,
    measurements,
    failures,
  });

  console.log(markdown);
  console.log(`Reports: ${reportDir}`);
  writeStepSummary(markdown);

  if (failures.length === 0) {
    console.log('Lighthouse gate passed.');
    return;
  }

  for (const failure of failures) console.error(`::error::${formatFailure(failure)}`);

  if (options.mode === 'production') {
    console.error(
      'The production run records evidence and blocks nothing. ' +
        'See docs/operations/lighthouse-gate.md.',
    );
    return;
  }

  console.error(`The Lighthouse gate failed ${String(failures.length)} checks.`);
  process.exitCode = 1;
}

await main();
