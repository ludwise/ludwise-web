import { describe, expect, it } from 'vitest';

import { renderSummary } from '../../../../scripts/lighthouse/report.mjs';

const config = {
  samples: 3,
  formFactors: ['desktop'],
  routeClasses: [{ id: 'home', path: '/' }],
  categories: { performance: 95, seo: 100 },
  metrics: { 'largest-contentful-paint': 2500 },
  budgets: {},
};

const measurements = [
  {
    routeClass: 'home',
    formFactor: 'desktop',
    summary: {
      categories: { performance: 99, seo: 100 },
      metrics: { 'largest-contentful-paint': 480 },
      resources: { total: 181_000, script: 65_946 },
    },
  },
];

describe('renderSummary', () => {
  it('reports the target, the mode and the sample count', () => {
    const markdown = renderSummary({
      config,
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [],
    });

    expect(markdown).toContain('http://127.0.0.1:4321');
    expect(markdown).toContain('deterministic');
    expect(markdown).toContain('3');
  });

  it('shows the median score of every route class and form factor', () => {
    const markdown = renderSummary({
      config,
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [],
    });

    expect(markdown).toMatch(/\|\s*home\s*\|\s*desktop\s*\|/);
    expect(markdown).toContain('99');
  });

  it('marks a passing run as passed', () => {
    const markdown = renderSummary({
      config,
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [],
    });

    expect(markdown).toMatch(/passed/i);
  });

  it('lists every failure with its limit and its measurement', () => {
    const markdown = renderSummary({
      config,
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [
        {
          routeClass: 'home',
          formFactor: 'desktop',
          kind: 'category',
          subject: 'performance',
          expected: 95,
          measured: 91,
          unit: 'points',
        },
      ],
    });

    expect(markdown).toMatch(/failed/i);
    expect(markdown).toContain('performance');
    expect(markdown).toContain('91');
    expect(markdown).toContain('95');
  });

  it('says that no asset budget is set rather than reporting a silent pass', () => {
    const markdown = renderSummary({
      config,
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [],
    });

    expect(markdown).toMatch(/no asset budget/i);
  });

  it('reports the transfer sizes against a budget that is set', () => {
    const markdown = renderSummary({
      config: { ...config, budgets: { script: 70, total: 200 } },
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
      measurements,
      failures: [],
    });

    expect(markdown).toContain('script');
    expect(markdown).toContain('64.4');
    expect(markdown).toContain('70');
  });
});
