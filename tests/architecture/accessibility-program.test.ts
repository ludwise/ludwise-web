import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROGRAM = readFileSync(join(REPO_ROOT, 'docs/accessibility.md'), 'utf8');

const EXPECTED_A_AA = [
  '1.1.1',
  '1.2.1',
  '1.2.2',
  '1.2.3',
  '1.2.4',
  '1.2.5',
  '1.3.1',
  '1.3.2',
  '1.3.3',
  '1.3.4',
  '1.3.5',
  '1.4.1',
  '1.4.2',
  '1.4.3',
  '1.4.4',
  '1.4.5',
  '1.4.10',
  '1.4.11',
  '1.4.12',
  '1.4.13',
  '2.1.1',
  '2.1.2',
  '2.1.4',
  '2.2.1',
  '2.2.2',
  '2.3.1',
  '2.4.1',
  '2.4.2',
  '2.4.3',
  '2.4.4',
  '2.4.5',
  '2.4.6',
  '2.4.7',
  '2.4.11',
  '2.5.1',
  '2.5.2',
  '2.5.3',
  '2.5.4',
  '2.5.7',
  '2.5.8',
  '3.1.1',
  '3.1.2',
  '3.2.1',
  '3.2.2',
  '3.2.3',
  '3.2.4',
  '3.2.6',
  '3.3.1',
  '3.3.2',
  '3.3.3',
  '3.3.4',
  '3.3.7',
  '3.3.8',
  '4.1.2',
  '4.1.3',
] as const;

const WCAG_22_A_AA_ADDITIONS = ['2.4.11', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8'] as const;
const MATRIX_ROW = /^\| \[([0-9.]+)\]\([^)]*\) \| (A|AA) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gmu;

function matrixRows(): Array<{
  criterion: string;
  level: string;
  version: string;
  status: string;
  surface: string;
  method: string;
  evidence: string;
}> {
  return [...PROGRAM.matchAll(MATRIX_ROW)].map((match) => ({
    criterion: match[1]!.trim(),
    level: match[2]!.trim(),
    version: match[3]!.trim(),
    status: match[4]!.trim(),
    surface: match[5]!.trim(),
    method: match[6]!.trim(),
    evidence: match[7]!.trim(),
  }));
}

function sourceFiles(directory: string): string[] {
  return readdirSync(join(REPO_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:astro|css|ts|tsx)$/u.test(entry.name) ? [child] : [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/(^|[^:])\/\/[^\n]*/gmu, '$1');
}

describe('WCAG 2.2 accessibility program', () => {
  it('tracks every Level A and AA success criterion exactly once', () => {
    const rows = matrixRows();

    expect(rows.map(({ criterion }) => criterion)).toEqual(EXPECTED_A_AA);
    expect(new Set(rows.map(({ criterion }) => criterion).size)).toBeUndefined();
    expect(new Set(rows.map(({ criterion }) => criterion)).toHaveLength(EXPECTED_A_AA.length);
    expect(rows.some(({ criterion }) => criterion === '4.1.1')).toBe(false);
  });

  it('records an applicability state, surface, method and evidence for every row', () => {
    for (const row of matrixRows()) {
      expect(['Applicable', 'Not current', 'Conditional']).toContain(row.status);
      expect(['Automated', 'Manual', 'Both']).toContain(row.method);
      expect(row.surface.length).toBeGreaterThan(3);
      expect(row.evidence).toMatch(/\[[^\]]+\]\([^)]+\)/u);
    }
  });

  it('marks every new WCAG 2.2 Level A or AA criterion', () => {
    const rows = new Map(matrixRows().map((row) => [row.criterion, row]));

    for (const criterion of WCAG_22_A_AA_ADDITIONS) {
      expect(rows.get(criterion)?.version).toBe('2.2');
    }
    expect(matrixRows().filter(({ version }) => version === '2.2').map(({ criterion }) => criterion)).toEqual(
      WCAG_22_A_AA_ADDITIONS,
    );
  });

  it('keeps the standards and gate boundaries explicit', () => {
    expect(PROGRAM).toContain('https://www.w3.org/TR/WCAG22/');
    expect(PROGRAM).toContain('https://www.a11yproject.com/checklist/');
    expect(PROGRAM).toContain('A passing automated check does not prove WCAG conformance.');
    expect(PROGRAM).toContain('issue #37');
    expect(PROGRAM).toContain('Do not add a broad axe exclusion.');
  });
});

describe('reusable accessibility invariants', () => {
  it('keeps target-size tokens above the WCAG 2.2 minimum', () => {
    const space = readFileSync(join(REPO_ROOT, 'src/styles/tokens/space.css'), 'utf8');

    expect(space).toContain('--target-min:40px;');
    expect(space).toContain('--target-min-touch:44px;');
    expect(space).toContain('--target-min-inline:24px;');
  });

  it('keeps reduced motion in the global token layer', () => {
    const motion = readFileSync(join(REPO_ROOT, 'src/styles/tokens/motion.css'), 'utf8');

    expect(motion).toContain('@media (prefers-reduced-motion:reduce)');
    expect(motion).toContain('--motion-duration-fast:0ms;');
    expect(motion).toContain('--motion-duration-normal:0ms;');
    expect(motion).toContain('--motion-duration-deliberate:0ms;');
    expect(motion).toContain('--motion-duration-ambient:0ms;');
    expect(motion).toContain('transition-duration:.01ms !important');
  });

  it('requires an accessible name for the shared icon-only button', () => {
    const iconButton = readFileSync(
      join(REPO_ROOT, 'src/components/actions/IconButton.astro'),
      'utf8',
    );

    expect(iconButton).toMatch(/\blabel:\s*string;/u);
    expect(iconButton).toContain('aria-label={label}');
  });

  it('prohibits positive tabindex in product UI', () => {
    const files = ['src/components', 'src/layouts', 'src/pages'].flatMap(sourceFiles);
    const positiveTabIndex = /\btabindex\s*=\s*(?:["']?[1-9]\d*["']?|\{\s*[1-9]\d*\s*\})/giu;
    const offenders = files.flatMap((file) => {
      const source = stripComments(readFileSync(join(REPO_ROOT, file), 'utf8'));
      return (source.match(positiveTabIndex) ?? []).map((match) => `${file}: ${match}`);
    });

    expect(offenders).toEqual([]);
  });
});
