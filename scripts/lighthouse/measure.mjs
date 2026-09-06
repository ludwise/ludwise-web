/**
 * Runs Lighthouse over the configured route classes and form factors.
 *
 * The browser is the Chromium that `@playwright/test` pins. That keeps the
 * measurement on one browser build in continuous integration and on a
 * developer machine, with no second download and no environment-only path.
 *
 * Runs are sequential. Two Lighthouse runs on one machine compete for the
 * processor, and simulated throttling turns that competition into a slower
 * measured page.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import * as constants from 'lighthouse/core/config/constants.js';

import { observationFrom, summarizeObservations } from './evaluate.mjs';

/** Kept in step with `THEME_COOKIE_NAME` in src/lib/http/theme.ts. */
const THEME_COOKIE_NAME = 'theme';

const THROTTLING = {
  desktop: constants.throttling.desktopDense4G,
  mobile: constants.throttling.mobileSlow4G,
};

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => {
        resolvePort(port);
      });
    });
  });
}

/**
 * The cookie that pins the theme for one run.
 *
 * `src/lib/http/theme.ts` reads this cookie before the first paint, so the
 * server renders the theme the gate asked for. Without it the page follows the
 * color scheme of whatever launched the browser, and two launchers measure two
 * different pages.
 */
const themeHeader = (theme) => ({ Cookie: `${THEME_COOKIE_NAME}=${theme}` });

function settingsFor(config, formFactor, skipAudits) {
  return {
    formFactor,
    screenEmulation: constants.screenEmulationMetrics[formFactor],
    emulatedUserAgent: constants.userAgents[formFactor],
    throttling: THROTTLING[formFactor],
    extraHeaders: themeHeader(config.theme),
    ...(skipAudits.length > 0 ? { skipAudits: [...skipAudits] } : {}),
  };
}

/**
 * The audits this run removes from their categories.
 *
 * Each one fails for a reason that is correct behavior, and Lighthouse computes
 * the remaining weights again, so the reported score stays honest. The
 * production run removes nothing. docs/operations/lighthouse-gate.md states the
 * reason for each audit, and tests/architecture/lighthouse-gate.test.ts fails
 * when an audit is skipped without one.
 */
export function skipAuditsFor(config, mode) {
  return mode === 'deterministic' ? config.deterministic.skipAudits : [];
}

/**
 * Measures every route class and form factor, and returns the medians.
 *
 * Each Lighthouse report is written to `reportDir` before the run is judged, so
 * a failing gate still leaves the evidence behind.
 */
export async function measure({ config, target, mode, samples, reportDir, log = console.log }) {
  const outputDirectory = resolve(reportDir);
  mkdirSync(outputDirectory, { recursive: true });

  const skipAudits = skipAuditsFor(config, mode);
  const metricIds = Object.keys(config.metrics);
  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${String(port)}`] });
  const measurements = [];

  try {
    for (const routeClass of config.routeClasses) {
      for (const formFactor of config.formFactors) {
        const url = `${target}${routeClass.path}`;
        const observations = [];

        for (let sample = 1; sample <= samples; sample += 1) {
          log(`Lighthouse ${routeClass.id} ${formFactor} sample ${String(sample)}: ${url}`);

          const result = await lighthouse(
            url,
            { port, hostname: '127.0.0.1', output: ['json', 'html'], logLevel: 'error' },
            {
              extends: 'lighthouse:default',
              settings: settingsFor(config, formFactor, skipAudits),
            },
          );

          if (result === undefined) throw new Error(`Lighthouse produced no report for ${url}.`);

          const name = `${routeClass.id}-${formFactor}-${String(sample)}`;
          writeFileSync(join(outputDirectory, `${name}.json`), result.report[0]);
          writeFileSync(join(outputDirectory, `${name}.html`), result.report[1]);

          observations.push(observationFrom(result.lhr, metricIds));
        }

        measurements.push({
          routeClass: routeClass.id,
          formFactor,
          summary: summarizeObservations(observations),
        });
      }
    }
  } finally {
    await browser.close();
  }

  return { measurements, reportDir: outputDirectory };
}
