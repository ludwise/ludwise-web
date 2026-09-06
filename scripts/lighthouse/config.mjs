/**
 * Reads and validates `lighthouse.config.json`.
 *
 * The file is the only place a Lighthouse limit is written. This module holds
 * no default, so a configuration that omits a threshold fails to load rather
 * than falling back to a number nobody reviewed.
 *
 * The validation is strict on purpose. An unknown key, a misspelled resource
 * type or a sample count of one each disable a limit. None of them changes a
 * visible number.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CONFIG_PATH = resolve(repositoryRoot, 'lighthouse.config.json');

export const FORM_FACTORS = Object.freeze(['desktop', 'mobile']);

/**
 * The themes that `src/lib/http/theme.ts` authors.
 *
 * The gate pins one of them through the theme cookie. Left unpinned, the page
 * follows the color scheme of whatever launched the browser, and two launchers
 * then measure two different pages.
 */
export const THEMES = Object.freeze(['light', 'dark']);

/** The resource types that the Lighthouse `resource-summary` audit reports. */
export const BUDGET_RESOURCE_TYPES = Object.freeze([
  'total',
  'document',
  'script',
  'stylesheet',
  'image',
  'media',
  'font',
  'other',
  'third-party',
]);

const KNOWN_KEYS = new Set([
  '$schemaVersion',
  'samples',
  'theme',
  'formFactors',
  'routeClasses',
  'categories',
  'metrics',
  'budgets',
  'deterministic',
]);

const fail = (message) => {
  throw new Error(`lighthouse.config.json is invalid: ${message}`);
};

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validateRouteClasses(raw) {
  if (!Array.isArray(raw) || raw.length === 0) fail('routeClasses must list at least one route.');

  const seen = new Set();

  for (const route of raw) {
    if (!isPlainObject(route)) fail('routeClasses must hold objects.');
    if (typeof route.id !== 'string' || route.id === '') fail('a routeClasses entry has no id.');
    if (seen.has(route.id)) fail(`the route class ${route.id} is declared more than once.`);
    seen.add(route.id);
    if (typeof route.path !== 'string' || !route.path.startsWith('/')) {
      fail(`the path of ${route.id} must start with a slash and stay site relative.`);
    }
  }

  return Object.freeze(raw.map((route) => Object.freeze({ id: route.id, path: route.path })));
}

function validateFormFactors(raw) {
  if (!Array.isArray(raw) || raw.length === 0) fail('formFactors must list at least one factor.');

  for (const factor of raw) {
    if (!FORM_FACTORS.includes(factor)) fail(`${String(factor)} is not a Lighthouse form factor.`);
  }

  return Object.freeze([...raw]);
}

function validateCategories(raw) {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
    fail('categories must set a threshold for at least one Lighthouse category.');
  }

  for (const [category, threshold] of Object.entries(raw)) {
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      fail(`the ${category} threshold must be a score between 0 and 100.`);
    }
  }

  return Object.freeze({ ...raw });
}

function validateMetrics(raw) {
  if (!isPlainObject(raw)) fail('metrics must be an object of audit limits.');

  for (const [metric, limit] of Object.entries(raw)) {
    if (typeof limit !== 'number' || limit < 0) {
      fail(`the ${metric} limit must be a number that is zero or more.`);
    }
  }

  return Object.freeze({ ...raw });
}

function validateBudgets(raw) {
  if (!isPlainObject(raw)) fail('budgets must be an object of transfer size limits.');

  for (const [resourceType, limit] of Object.entries(raw)) {
    if (!BUDGET_RESOURCE_TYPES.includes(resourceType)) {
      fail(`${resourceType} is not a resource type that Lighthouse reports.`);
    }
    if (typeof limit !== 'number' || limit < 0) {
      fail(`the ${resourceType} budget must be a size in kibibytes that is zero or more.`);
    }
  }

  return Object.freeze({ ...raw });
}

function validateDeterministic(raw) {
  if (!isPlainObject(raw)) fail('deterministic must be an object.');

  const skipAudits = raw.skipAudits;
  if (!Array.isArray(skipAudits) || skipAudits.some((audit) => typeof audit !== 'string')) {
    fail('deterministic.skipAudits must list audit identifiers.');
  }

  return Object.freeze({ skipAudits: Object.freeze([...skipAudits]) });
}

/**
 * The parsed configuration, or an error that names the field at fault.
 *
 * The result is frozen, so no caller can lower a threshold at runtime.
 */
export function validateGateConfig(raw) {
  if (!isPlainObject(raw)) fail('the file must hold an object.');

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) fail(`${key} is not a key this gate reads.`);
  }
  for (const key of KNOWN_KEYS) {
    if (!(key in raw)) fail(`${key} is missing.`);
  }

  if (raw.$schemaVersion !== 1) fail('$schemaVersion must be 1.');

  if (!Number.isInteger(raw.samples) || raw.samples < 3 || raw.samples % 2 === 0) {
    fail('samples must be an odd whole number of three or more, so a median exists.');
  }

  if (!THEMES.includes(raw.theme)) fail(`${String(raw.theme)} is not a theme this site authors.`);

  return Object.freeze({
    $schemaVersion: raw.$schemaVersion,
    samples: raw.samples,
    theme: raw.theme,
    formFactors: validateFormFactors(raw.formFactors),
    routeClasses: validateRouteClasses(raw.routeClasses),
    categories: validateCategories(raw.categories),
    metrics: validateMetrics(raw.metrics),
    budgets: validateBudgets(raw.budgets),
    deterministic: validateDeterministic(raw.deterministic),
  });
}

/** The committed configuration. */
export function loadGateConfig(path = CONFIG_PATH) {
  let raw;

  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${path}.`, { cause: error });
  }

  return validateGateConfig(raw);
}
