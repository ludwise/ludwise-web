import { describe, expect, it } from 'vitest';

import { findUnlocalizedApplicationTargets } from '../../helpers/locale-links.js';

describe('locale-aware application URL audit', () => {
  it('finds direct page links and form actions', () => {
    const source = '<a href="/games">Games</a>\n<form action="/sales"></form>\n';

    expect(findUnlocalizedApplicationTargets(source, 'example.astro')).toEqual([
      'example.astro:1: /games',
      'example.astro:2: /sales',
    ]);
  });

  it('finds a page URL from a simple string binding', () => {
    const source = ['---', "const href = '/games';", '---', '<a href={href}>Games</a>', ''].join(
      '\n',
    );

    expect(findUnlocalizedApplicationTargets(source, 'example.astro')).toEqual([
      'example.astro:4: /games',
    ]);
  });

  it('ignores API paths, assets, and external URLs', () => {
    const source = [
      '<a href="/api/games">API</a>',
      '<a href="/fonts/geist.woff2">Font</a>',
      '<a href="/favicon.svg">Icon</a>',
      '<a href="https://github.com/ludwise/ludwise-web">GitHub</a>',
      '<a href="//cdn.example.test/file">CDN</a>',
      '',
    ].join('\n');

    expect(findUnlocalizedApplicationTargets(source, 'example.astro')).toEqual([]);
  });

  it('ignores locale-aware URL helpers', () => {
    const source = [
      '---',
      "import { getRelativeLocaleUrl } from 'astro:i18n';",
      "const href = getRelativeLocaleUrl(locale, 'games');",
      '---',
      '<a href={href}>Games</a>',
      "<a href={getRelativeLocaleUrl(locale, 'sales')}>Sales</a>",
      '',
    ].join('\n');

    expect(findUnlocalizedApplicationTargets(source, 'example.astro')).toEqual([]);
  });

  it('checks JSX links with the same narrow rules', () => {
    const source = [
      "const href = '/games';",
      'export const Example = () => <a href={href}>Games</a>;',
      "export const Safe = () => <a href={getRelativeLocaleUrl(locale, 'sales')}>Sales</a>;",
      '',
    ].join('\n');

    expect(findUnlocalizedApplicationTargets(source, 'example.tsx')).toEqual([
      'example.tsx:2: /games',
    ]);
  });
});
