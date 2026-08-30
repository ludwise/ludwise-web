import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../helpers/contrast.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PRIMITIVES = readFileSync(join(REPO_ROOT, 'src/styles/tokens/color-primitives.css'), 'utf8');
const SEMANTIC = readFileSync(join(REPO_ROOT, 'src/styles/tokens/color-semantic.css'), 'utf8');
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/gu;

const primitiveValues = new Map(
  [...PRIMITIVES.matchAll(DECLARATION)].map(([, name, value]) => [name!, value!.trim()]),
);

function themeValues(theme: 'light' | 'dark'): Map<string, string> {
  const start = theme === 'light' ? SEMANTIC.indexOf(':root,[data-theme="light"]{') : SEMANTIC.indexOf('[data-theme="dark"]{');
  const end = theme === 'light' ? SEMANTIC.indexOf('[data-theme="dark"]{') : SEMANTIC.length;
  return new Map(
    [...SEMANTIC.slice(start, end).matchAll(DECLARATION)].map(([, name, value]) => [name!, value!.trim()]),
  );
}

function tokenValue(theme: 'light' | 'dark', name: string): string {
  const values = themeValues(theme);
  let value = values.get(name) ?? primitiveValues.get(name);
  for (let depth = 0; depth < 4 && value?.startsWith('var('); depth += 1) {
    const referenced = value.match(/^var\((--[\w-]+)\)$/u)?.[1];
    if (referenced === undefined) break;
    value = values.get(referenced) ?? primitiveValues.get(referenced);
  }
  if (value === undefined || !value.startsWith('#')) throw new Error(`Missing colour token: ${name}`);
  return value;
}

const REQUIRED_SURFACES = [
  ['background.primary', '--color-background-primary'],
  ['background.secondary', '--color-background-secondary'],
  ['surface.default', '--color-surface-default'],
  ['surface.raised', '--color-surface-raised'],
  ['surface.sunken', '--color-surface-sunken'],
  ['surface.interactive', '--color-surface-interactive'],
  ['surface.interactive-hover', '--color-surface-interactive-hover'],
  ['surface.interactive-active', '--color-surface-interactive-active'],
  ['surface.selected', '--color-surface-selected'],
] as const;

describe('component boundary contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme} component boundaries meet WCAG 1.4.11`, () => {
      const boundary = tokenValue(theme, '--color-border-component');

      for (const [surfaceName, surfaceToken] of REQUIRED_SURFACES) {
        expect(
          contrastRatio(boundary, tokenValue(theme, surfaceToken)),
          `${theme} component boundary / ${surfaceName}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${theme} focus indicator remains distinct and visible`, () => {
      const focus = tokenValue(theme, '--color-border-focus');
      expect(contrastRatio(focus, tokenValue(theme, '--color-background-primary'))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(focus, tokenValue(theme, '--color-surface-default'))).toBeGreaterThanOrEqual(3);
    });

    it(`${theme} decorative boundaries remain weaker than component boundaries`, () => {
      const component = tokenValue(theme, '--color-border-component');
      const decorative = tokenValue(theme, '--color-border-decorative');

      expect(component).not.toBe(decorative);
      expect(contrastRatio(decorative, tokenValue(theme, '--color-surface-default'))).toBeLessThan(3);
    });
  }
});
