import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function fileNames(directory: string, suffix: string): Promise<string[]> {
  return (await readdir(join(root, directory))).filter((name) => name.endsWith(suffix)).sort();
}

async function expectSameFile(source: string, target: string): Promise<void> {
  const [sourceBytes, targetBytes] = await Promise.all([
    readFile(join(root, source)),
    readFile(join(root, target)),
  ]);
  expect(targetBytes.equals(sourceBytes)).toBe(true);
}

describe('prelaunch design system', () => {
  it('ships the production design tokens unchanged', async () => {
    const tokenNames = await fileNames('src/styles/tokens', '.css');
    expect(await fileNames('prelaunch/styles/tokens', '.css')).toEqual(tokenNames);
    await expectSameFile('src/styles/global.css', 'prelaunch/styles/global.css');

    for (const name of tokenNames) {
      await expectSameFile(`src/styles/tokens/${name}`, `prelaunch/styles/tokens/${name}`);
    }
  });

  it('ships the production Geist font files unchanged', async () => {
    const fontNames = await fileNames('public/fonts', '.woff2');
    expect(await fileNames('prelaunch/fonts', '.woff2')).toEqual(fontNames);

    for (const name of fontNames) {
      await expectSameFile(`public/fonts/${name}`, `prelaunch/fonts/${name}`);
    }
  });
});
