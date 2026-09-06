import { describe, expect, it } from 'vitest';

import {
  BUDGET_RESOURCE_TYPES,
  FORM_FACTORS,
  THEMES,
  loadGateConfig,
  validateGateConfig,
} from '../../../../scripts/lighthouse/config.mjs';

const valid = () => ({
  $schemaVersion: 1,
  samples: 3,
  theme: 'light',
  formFactors: ['desktop', 'mobile'],
  routeClasses: [
    { id: 'home', path: '/' },
    { id: 'games', path: '/games' },
  ],
  categories: { performance: 95, seo: 100 },
  metrics: { 'largest-contentful-paint': 2500 },
  budgets: {},
  deterministic: { skipAudits: ['is-crawlable'] },
});

const rejects = (mutate: (draft: any) => void, pattern: RegExp) => {
  const draft = valid();
  mutate(draft);
  expect(() => validateGateConfig(draft)).toThrow(pattern);
};

describe('validateGateConfig', () => {
  it('accepts a complete configuration', () => {
    expect(validateGateConfig(valid()).categories.performance).toBe(95);
  });

  it('freezes the result so no caller can raise a limit at runtime', () => {
    const config = validateGateConfig(valid());
    expect(() => {
      (config.categories as Record<string, number>).performance = 0;
    }).toThrow();
  });

  it('defines no threshold of its own', () => {
    rejects((draft) => delete draft.categories, /categories/);
    rejects((draft) => delete draft.metrics, /metrics/);
    rejects((draft) => delete draft.budgets, /budgets/);
  });

  it('refuses a configuration with no route class', () => {
    rejects((draft) => (draft.routeClasses = []), /routeClasses/);
  });

  it('refuses a repeated route class identifier', () => {
    rejects((draft) => draft.routeClasses.push({ id: 'home', path: '/other' }), /home/);
  });

  it('refuses a route path that is not site relative', () => {
    rejects((draft) => (draft.routeClasses[0].path = 'https://example.com/'), /path/);
  });

  it('refuses an unknown form factor', () => {
    rejects((draft) => (draft.formFactors = ['tablet']), /tablet/);
  });

  it('refuses a sample count that cannot produce a true median', () => {
    rejects((draft) => (draft.samples = 1), /samples/);
    rejects((draft) => (draft.samples = 2), /samples/);
  });

  it('refuses a theme this site does not author', () => {
    rejects((draft) => (draft.theme = 'sepia'), /sepia/);
    rejects((draft) => delete draft.theme, /theme/);
  });

  it('accepts either authored theme', () => {
    for (const theme of THEMES) {
      const draft = valid();
      draft.theme = theme;
      expect(validateGateConfig(draft).theme).toBe(theme);
    }
  });

  it('refuses a category threshold outside the Lighthouse scale', () => {
    rejects((draft) => (draft.categories.performance = 101), /performance/);
    rejects((draft) => (draft.categories.performance = -1), /performance/);
  });

  it('refuses a negative lab metric limit', () => {
    rejects(
      (draft) => (draft.metrics['largest-contentful-paint'] = -1),
      /largest-contentful-paint/,
    );
  });

  it('refuses a budget on a resource type Lighthouse does not report', () => {
    rejects((draft) => (draft.budgets = { scripts: 60 }), /scripts/);
  });

  it('accepts a budget on every resource type Lighthouse does report', () => {
    const draft = valid();
    draft.budgets = Object.fromEntries(BUDGET_RESOURCE_TYPES.map((type) => [type, 10]));
    expect(Object.keys(validateGateConfig(draft).budgets)).toHaveLength(
      BUDGET_RESOURCE_TYPES.length,
    );
  });

  it('refuses an unknown key rather than ignoring a renamed limit', () => {
    rejects((draft) => (draft.thresholds = { performance: 10 }), /thresholds/);
  });

  it('refuses a skipped audit list that is not a list of audit identifiers', () => {
    rejects((draft) => (draft.deterministic.skipAudits = 'is-crawlable'), /skipAudits/);
  });
});

describe('the committed configuration', () => {
  const config = loadGateConfig();

  it('measures the four route classes', () => {
    expect(config.routeClasses.map((route: { id: string }) => route.id)).toEqual([
      'home',
      'games',
      'sales',
      'game-detail',
    ]);
  });

  it('measures both form factors', () => {
    expect([...config.formFactors].sort()).toEqual([...FORM_FACTORS].sort());
  });

  it('pins a theme so the run never follows the ambient color scheme', () => {
    expect(THEMES).toContain(config.theme);
  });

  it('skips named audits and never a whole category', () => {
    expect(config.deterministic.skipAudits).toEqual(['is-crawlable', 'color-contrast']);
  });
});
