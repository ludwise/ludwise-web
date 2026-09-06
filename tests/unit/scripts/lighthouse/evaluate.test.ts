import { describe, expect, it } from 'vitest';

import {
  evaluateMeasurements,
  formatFailure,
  median,
  observationFrom,
  summarizeObservations,
} from '../../../../scripts/lighthouse/evaluate.mjs';

const METRIC_IDS = [
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
] as const;

const config = {
  samples: 3,
  formFactors: ['desktop'],
  routeClasses: [{ id: 'home', path: '/' }],
  categories: { performance: 95, accessibility: 100 },
  metrics: {
    'largest-contentful-paint': 2500,
    'cumulative-layout-shift': 0.1,
    'total-blocking-time': 200,
  },
  budgets: {},
};

const summary = (overrides: Record<string, any> = {}) => ({
  categories: { performance: 100, accessibility: 100 },
  metrics: {
    'largest-contentful-paint': 500,
    'cumulative-layout-shift': 0,
    'total-blocking-time': 0,
  },
  units: {
    'largest-contentful-paint': 'ms',
    'cumulative-layout-shift': '',
    'total-blocking-time': 'ms',
  },
  resources: { script: 65_946, total: 181_000 },
  ...overrides,
});

const lhr = (overrides: Record<string, any> = {}) => ({
  categories: {
    performance: { score: 0.99 },
    accessibility: { score: 1 },
  },
  audits: {
    'largest-contentful-paint': { numericValue: 1959.4, numericUnit: 'millisecond' },
    'cumulative-layout-shift': { numericValue: 0, numericUnit: 'unitless' },
    'total-blocking-time': { numericValue: 0, numericUnit: 'millisecond' },
    'resource-summary': {
      details: {
        items: [
          { resourceType: 'total', transferSize: 181_000 },
          { resourceType: 'script', transferSize: 65_946 },
        ],
      },
    },
  },
  ...overrides,
});

describe('median', () => {
  it('takes the middle value of an odd sample count', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values of an even sample count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('refuses an empty sample set rather than inventing a number', () => {
    expect(() => median([])).toThrow(/no samples/i);
  });
});

describe('observationFrom', () => {
  it('reads the category scores as whole numbers out of one hundred', () => {
    expect(observationFrom(lhr(), METRIC_IDS).categories).toEqual({
      performance: 99,
      accessibility: 100,
    });
  });

  it('reads the requested metric values', () => {
    expect(observationFrom(lhr(), METRIC_IDS).metrics).toEqual({
      'largest-contentful-paint': 1959.4,
      'cumulative-layout-shift': 0,
      'total-blocking-time': 0,
    });
  });

  it('reads the unit that Lighthouse reports for each metric', () => {
    expect(observationFrom(lhr(), METRIC_IDS).units).toEqual({
      'largest-contentful-paint': 'ms',
      'cumulative-layout-shift': '',
      'total-blocking-time': 'ms',
    });
  });

  it('reads the transfer size of every resource type', () => {
    expect(observationFrom(lhr(), METRIC_IDS).resources).toEqual({
      total: 181_000,
      script: 65_946,
    });
  });

  it('refuses a report whose category did not run', () => {
    const broken = lhr({
      categories: { performance: { score: null }, accessibility: { score: 1 } },
    });
    expect(() => observationFrom(broken, METRIC_IDS)).toThrow(/performance/);
  });

  it('refuses a report that is missing a requested metric', () => {
    const broken = lhr({ audits: { ...lhr().audits, 'total-blocking-time': {} } });
    expect(() => observationFrom(broken, METRIC_IDS)).toThrow(/total-blocking-time/);
  });
});

describe('summarizeObservations', () => {
  it('reports the median of each measured value', () => {
    const observations = [92, 96, 94].map((score) => ({
      categories: { performance: score, accessibility: 100 },
      metrics: { 'largest-contentful-paint': score * 10 },
      units: { 'largest-contentful-paint': 'ms' },
      resources: { script: score * 100 },
    }));

    expect(summarizeObservations(observations)).toEqual({
      categories: { performance: 94, accessibility: 100 },
      metrics: { 'largest-contentful-paint': 940 },
      units: { 'largest-contentful-paint': 'ms' },
      resources: { script: 9400 },
    });
  });

  it('counts a resource type that only some samples saw, rather than dropping it', () => {
    const observations = [
      { categories: {}, metrics: {}, units: {}, resources: { script: 1000 } },
      { categories: {}, metrics: {}, units: {}, resources: { script: 1000, image: 900_000 } },
      { categories: {}, metrics: {}, units: {}, resources: { script: 1000, image: 900_000 } },
    ];

    expect(summarizeObservations(observations).resources).toEqual({
      script: 1000,
      image: 900_000,
    });
  });

  it('refuses observations that do not measure the same things', () => {
    const observations = [
      { categories: { performance: 100 }, metrics: {}, units: {}, resources: {} },
      { categories: {}, metrics: {}, units: {}, resources: {} },
    ];
    expect(() => summarizeObservations(observations)).toThrow(/performance/);
  });
});

describe('evaluateMeasurements', () => {
  const measurement = (overrides: Record<string, any> = {}) => [
    { routeClass: 'home', formFactor: 'desktop', summary: summary(), ...overrides },
  ];

  it('passes a run that meets every threshold', () => {
    expect(evaluateMeasurements(config, measurement())).toEqual([]);
  });

  it('fails a category score below its threshold', () => {
    const failures = evaluateMeasurements(
      config,
      measurement({ summary: summary({ categories: { performance: 94, accessibility: 100 } }) }),
    );

    expect(failures).toEqual([
      {
        routeClass: 'home',
        formFactor: 'desktop',
        kind: 'category',
        subject: 'performance',
        expected: 95,
        measured: 94,
        unit: 'points',
      },
    ]);
  });

  it('passes a category score exactly at its threshold', () => {
    const failures = evaluateMeasurements(
      config,
      measurement({ summary: summary({ categories: { performance: 95, accessibility: 100 } }) }),
    );

    expect(failures).toEqual([]);
  });

  it('fails a lab metric the run never reported rather than passing it', () => {
    const failures = evaluateMeasurements(
      config,
      measurement({ summary: summary({ metrics: { 'cumulative-layout-shift': 0 } }) }),
    );

    expect(failures).toMatchObject([
      { kind: 'metric', subject: 'largest-contentful-paint', measured: null },
      { kind: 'metric', subject: 'total-blocking-time', measured: null },
    ]);
  });

  it('reports a unitless metric without a unit', () => {
    const failures = evaluateMeasurements(
      config,
      measurement({
        summary: summary({
          metrics: {
            'largest-contentful-paint': 500,
            'cumulative-layout-shift': 0.4,
            'total-blocking-time': 0,
          },
        }),
      }),
    );

    expect(failures).toMatchObject([
      { kind: 'metric', subject: 'cumulative-layout-shift', unit: '' },
    ]);
    expect(formatFailure(failures[0]!)).not.toMatch(/\bms\b/u);
  });

  it('fails a lab metric above its limit', () => {
    const failures = evaluateMeasurements(
      config,
      measurement({
        summary: summary({
          metrics: {
            'largest-contentful-paint': 2600,
            'cumulative-layout-shift': 0,
            'total-blocking-time': 0,
          },
        }),
      }),
    );

    expect(failures).toMatchObject([
      {
        kind: 'metric',
        subject: 'largest-contentful-paint',
        expected: 2500,
        measured: 2600,
        unit: 'ms',
      },
    ]);
  });

  it('fails an asset budget that the run exceeded', () => {
    const withBudget = { ...config, budgets: { script: 60, total: 200 } };
    const failures = evaluateMeasurements(withBudget, measurement());

    expect(failures).toMatchObject([
      { kind: 'budget', subject: 'script', expected: 60, measured: 64.4, unit: 'KiB' },
    ]);
  });

  it('counts a resource type that transferred nothing as zero rather than as absent', () => {
    const withBudget = { ...config, budgets: { image: 100 } };

    expect(evaluateMeasurements(withBudget, measurement())).toEqual([]);
  });

  it('fails a budget of zero that any transfer would break', () => {
    const withBudget = { ...config, budgets: { script: 0 } };

    expect(evaluateMeasurements(withBudget, measurement())).toMatchObject([
      { kind: 'budget', subject: 'script', expected: 0, measured: 64.4 },
    ]);
  });

  it('enforces nothing extra when no budget is set', () => {
    expect(evaluateMeasurements(config, measurement())).toEqual([]);
  });

  it('fails a route class that the run never measured', () => {
    expect(evaluateMeasurements(config, [])).toEqual([
      {
        routeClass: 'home',
        formFactor: 'desktop',
        kind: 'coverage',
        subject: 'measurement',
        expected: 1,
        measured: 0,
        unit: 'runs',
      },
    ]);
  });

  it('reports every failure rather than the first', () => {
    const failures = evaluateMeasurements(
      { ...config, budgets: { script: 60 } },
      measurement({
        summary: summary({
          categories: { performance: 10, accessibility: 20 },
          metrics: {
            'largest-contentful-paint': 9000,
            'cumulative-layout-shift': 1,
            'total-blocking-time': 900,
          },
        }),
      }),
    );

    expect(failures).toHaveLength(6);
  });
});

describe('formatFailure', () => {
  it('names the route class, the form factor, the audit, the limit and the measurement', () => {
    const line = formatFailure({
      routeClass: 'games',
      formFactor: 'mobile',
      kind: 'category',
      subject: 'performance',
      expected: 95,
      measured: 91,
      unit: 'points',
    });

    expect(line).toContain('games');
    expect(line).toContain('mobile');
    expect(line).toContain('performance');
    expect(line).toContain('95');
    expect(line).toContain('91');
  });

  it('states the kind of limit that a budget failure broke', () => {
    const line = formatFailure({
      routeClass: 'home',
      formFactor: 'desktop',
      kind: 'budget',
      subject: 'script',
      expected: 60,
      measured: 64.4,
      unit: 'KiB',
    });

    expect(line).toMatch(/budget/i);
    expect(line).toContain('KiB');
  });
});
