import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_DIRECTORIES = ['src/components', 'src/layouts', 'src/pages'];
const GENERIC_BOUNDARY = /var\(--color-border-(?:subtle|default|strong)\)/u;

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.(astro|css|tsx?)$/u.test(entry.name) ? [path] : [];
  });
}

const uiFiles = [
  ...UI_DIRECTORIES.flatMap((directory) => filesIn(directory)),
  'src/styles/skip-link.css',
];

describe('component boundaries use semantic roles', () => {
  it('does not use generic border tokens for product UI', () => {
    const offenders = uiFiles.filter((file) => GENERIC_BOUNDARY.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('uses the decorative boundary role for non-identifying borders', () => {
    const uses = uiFiles.filter((file) =>
      readFileSync(file, 'utf8').includes('--color-border-decorative'),
    );
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });
});
