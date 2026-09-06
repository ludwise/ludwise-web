/**
 * Turns Lighthouse reports into a verdict against the committed limits.
 *
 * Every function here is pure. The gate keeps its arithmetic away from the
 * browser so that `tests/unit/scripts/lighthouse/evaluate.test.ts` can pin the
 * rules without a Chromium process.
 *
 * This module holds no threshold. `lighthouse.config.json` is the one place a
 * limit is written, and `scripts/lighthouse/config.mjs` refuses a configuration
 * that omits one.
 */

const BYTES_IN_KIB = 1024;

/** The middle value of a sample set, or the mean of the two middle values. */
export function median(values) {
  if (values.length === 0) throw new Error('Cannot take a median of no samples.');

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function categoryScores(lhr) {
  const scores = {};

  for (const [id, category] of Object.entries(lhr.categories ?? {})) {
    if (typeof category?.score !== 'number') {
      throw new Error(`Lighthouse reported no score for the ${id} category.`);
    }
    scores[id] = Math.round(category.score * 100);
  }

  return scores;
}

function metricValues(lhr, metricIds) {
  const values = {};

  for (const id of metricIds) {
    const value = lhr.audits?.[id]?.numericValue;
    if (typeof value !== 'number') {
      throw new Error(`Lighthouse reported no value for the ${id} audit.`);
    }
    values[id] = value;
  }

  return values;
}

/**
 * The unit each metric is measured in, as Lighthouse names it.
 *
 * Cumulative Layout Shift is unitless, and a failure that called its value a
 * count of milliseconds would misreport the limit it broke.
 */
function metricUnits(lhr, metricIds) {
  const units = {};

  for (const id of metricIds) {
    units[id] = lhr.audits?.[id]?.numericUnit === 'millisecond' ? 'ms' : '';
  }

  return units;
}

function transferSizes(lhr) {
  const sizes = {};

  for (const item of lhr.audits?.['resource-summary']?.details?.items ?? []) {
    if (typeof item?.resourceType === 'string' && typeof item.transferSize === 'number') {
      sizes[item.resourceType] = item.transferSize;
    }
  }

  return sizes;
}

/**
 * One run, reduced to the numbers the gate judges.
 *
 * A missing category or metric is an error rather than an absence. A run that
 * measured nothing must not read as a run that met every limit.
 */
export function observationFrom(lhr, metricIds) {
  return {
    categories: categoryScores(lhr),
    metrics: metricValues(lhr, metricIds),
    units: metricUnits(lhr, metricIds),
    resources: transferSizes(lhr),
  };
}

function medianOfGroup(observations, group) {
  const keys = Object.keys(observations[0][group]);
  const summary = {};

  for (const key of keys) {
    const values = observations.map((observation) => observation[group][key]);
    if (values.some((value) => typeof value !== 'number')) {
      throw new Error(`Only some samples measured ${key}, so there is no median to report.`);
    }
    summary[key] = median(values);
  }

  return summary;
}

/**
 * The median transfer size of every resource type any sample saw.
 *
 * A type missing from one sample transferred no bytes in it, so it counts as
 * zero rather than as absent. Reading the types from one sample would drop a
 * type the other samples saw, and a budget cannot fail on a size it never got.
 */
function medianTransferSizes(observations) {
  const keys = new Set(observations.flatMap((observation) => Object.keys(observation.resources)));
  const summary = {};

  for (const key of keys) {
    summary[key] = median(observations.map((observation) => observation.resources[key] ?? 0));
  }

  return summary;
}

/** The median of every value across the samples of one route class and form factor. */
export function summarizeObservations(observations) {
  if (observations.length === 0) throw new Error('Cannot summarize no samples.');

  return {
    categories: medianOfGroup(observations, 'categories'),
    metrics: medianOfGroup(observations, 'metrics'),
    units: observations[0].units,
    resources: medianTransferSizes(observations),
  };
}

/** A transfer size in kibibytes, to one decimal place. Budgets are set in them. */
export const kibibytes = (bytes) => Math.round((bytes / BYTES_IN_KIB) * 10) / 10;

function failuresFor(config, measurement) {
  const { routeClass, formFactor, summary } = measurement;
  const found = [];
  const record = (kind, subject, expected, measured, unit) => {
    found.push({ routeClass, formFactor, kind, subject, expected, measured, unit });
  };

  for (const [category, threshold] of Object.entries(config.categories)) {
    const score = summary.categories[category] ?? 0;
    if (score < threshold) record('category', category, threshold, score, 'points');
  }

  for (const [metric, limit] of Object.entries(config.metrics)) {
    const value = summary.metrics[metric];
    const unit = summary.units?.[metric] ?? '';
    // An unmeasured metric is a failure. Comparing undefined against a limit
    // is false, which would read as a pass.
    if (typeof value !== 'number') record('metric', metric, limit, null, unit);
    else if (value > limit) record('metric', metric, limit, value, unit);
  }

  for (const [resourceType, limit] of Object.entries(config.budgets)) {
    const measured = kibibytes(summary.resources[resourceType] ?? 0);
    if (measured > limit) record('budget', resourceType, limit, measured, 'KiB');
  }

  return found;
}

/**
 * Every limit that the run broke, and every route class the run never reached.
 *
 * A list rather than the first failure, so one run reports every regression.
 */
export function evaluateMeasurements(config, measurements) {
  const failures = [];

  for (const routeClass of config.routeClasses) {
    for (const formFactor of config.formFactors) {
      const measurement = measurements.find(
        (candidate) =>
          candidate.routeClass === routeClass.id && candidate.formFactor === formFactor,
      );

      if (measurement === undefined) {
        failures.push({
          routeClass: routeClass.id,
          formFactor,
          kind: 'coverage',
          subject: 'measurement',
          expected: 1,
          measured: 0,
          unit: 'runs',
        });
        continue;
      }

      failures.push(...failuresFor(config, measurement));
    }
  }

  return failures;
}

const KIND_LABEL = {
  category: 'category',
  metric: 'lab metric',
  budget: 'asset budget',
  coverage: 'coverage',
};

/** One failure, as the line a person reads in the job log. */
export function formatFailure(failure) {
  const { routeClass, formFactor, kind, subject, expected, measured, unit } = failure;
  const suffix = unit === '' ? '' : ` ${unit}`;
  const limit = kind === 'category' ? `at least ${expected}` : `at most ${expected}`;

  if (kind === 'coverage') {
    return `${routeClass} (${formFactor}): the gate measured nothing, and it needs ${expected} run.`;
  }

  const seen = measured === null ? 'was not measured' : `measured ${measured}${suffix}`;

  return (
    `${routeClass} (${formFactor}): ${KIND_LABEL[kind]} ${subject} ` +
    `${seen}, and the limit is ${limit}${suffix}.`
  );
}
