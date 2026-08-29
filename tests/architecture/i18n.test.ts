import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extractStrings } from '../../scripts/ste/extract.mjs';
import {
  DEFAULT_LOCALE,
  LOCALE_FALLBACKS,
  LOCALE_ROUTING,
  SUPPORTED_LOCALES,
} from '../../i18n.config.js';
import { baseLocale, getTextDirection, locales, messages as m } from '../../src/i18n/index.js';
import { importsInFile, listSourceFiles } from '../helpers/imports.js';

interface InlangSettings {
  baseLocale: string;
  locales: string[];
  modules: string[];
}

const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8')) as InlangSettings;

const catalogKeys = (locale: string): string[] => {
  const catalog = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as Record<
    string,
    unknown
  >;
  return Object.keys(catalog)
    .filter((key) => key !== '$schema')
    .sort();
};

const renderedSourceFiles = [
  ...new Set([
    ...listSourceFiles('src/pages'),
    ...listSourceFiles('src/components'),
    ...listSourceFiles('src/layouts'),
  ]),
].filter(
  (file) =>
    !file.startsWith('src/pages/api/') &&
    (file.endsWith('.astro') || file.endsWith('.tsx') || file.endsWith('.jsx')),
);

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

const uncataloguedVisitorText = (): string[] =>
  renderedSourceFiles.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return extractStrings(source, file).map(
      (unit) => `${file}:${String(lineAt(source, unit.start))}: ${unit.text}`,
    );
  });

const staticApplicationTargets = (): string[] => {
  const target = /\b(?:href|action)=["'](\/(?!\/)[^"']*)["']/g;
  const found: string[] = [];

  for (const file of renderedSourceFiles) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(target)) {
      const url = match[1];
      if (url === undefined) continue;
      const path = url.split(/[?#]/, 1)[0] ?? url;
      if (path.startsWith('/api/')) continue;
      if (/\/[^/]+\.[a-z0-9]+$/i.test(path)) continue;
      found.push(`${file}:${String(lineAt(source, match.index ?? 0))}: ${url}`);
    }
  }

  return found;
};

describe('localization architecture', () => {
  it('derives Astro locale configuration from the Inlang project', () => {
    expect(DEFAULT_LOCALE).toBe(settings.baseLocale);
    expect(SUPPORTED_LOCALES).toEqual(settings.locales);

    const expectedFallbacks = Object.fromEntries(
      settings.locales
        .filter((locale) => locale !== settings.baseLocale)
        .map((locale) => [locale, settings.baseLocale]),
    );
    expect(LOCALE_FALLBACKS).toEqual(expectedFallbacks);
    expect(LOCALE_ROUTING).toEqual({
      prefixDefaultLocale: false,
      fallbackType: 'rewrite',
    });

    const config = readFileSync('i18n.config.ts', 'utf8');
    expect(config).toContain('project.inlang/settings.json');
    expect(config).not.toContain("SUPPORTED_LOCALES = ['en']");
  });

  it('keeps the Inlang locale project aligned with generated runtime data', () => {
    expect(baseLocale).toBe(settings.baseLocale);
    expect([...locales]).toEqual(settings.locales);
  });

  it('loads pinned Inlang plugins from node_modules without a CDN', () => {
    expect(settings.modules).toEqual([
      './node_modules/@inlang/plugin-message-format/dist/index.js',
      './node_modules/@inlang/plugin-m-function-matcher/dist/index.js',
    ]);
    for (const modulePath of settings.modules) {
      expect(modulePath).toMatch(/^\.\/node_modules\//);
      expect(modulePath).not.toMatch(/^https?:\/\//);
      expect(existsSync(modulePath)).toBe(true);
    }
  });

  it('has one complete source catalog for every configured locale', () => {
    const sourceKeys = catalogKeys(settings.baseLocale);
    for (const locale of settings.locales) expect(catalogKeys(locale)).toEqual(sourceKeys);
  });

  it('keeps commercial settings outside locale configuration', () => {
    expect(settings).not.toHaveProperty('market');
    expect(settings).not.toHaveProperty('region');
    expect(settings).not.toHaveProperty('currency');
  });

  it('compiles static and parameterized messages', () => {
    const options = { locale: baseLocale } as const;
    expect(m.shell_navigation_home({}, options)).toBe('Home');
    expect(m.price_current({ price: '$12.99' }, options)).toBe('Current price $12.99.');
  });

  it('gets document direction from the compiled locale runtime', () => {
    expect(getTextDirection(baseLocale)).toBe('ltr');
  });

  it('uses Astro as the URL-routing owner', () => {
    const astroConfig = readFileSync('astro.config.mjs', 'utf8');
    expect(astroConfig).toContain('i18n: {');
    expect(astroConfig).toContain("trailingSlash: 'never'");
    expect(astroConfig).not.toContain('paraglideVitePlugin');
    expect(importsInFile('src/layouts/BaseLayout.astro')).toContain('astro:i18n');
  });

  it('blocks a second locale until rendered source is locale-safe', () => {
    if (settings.locales.length === 1) return;

    expect(uncataloguedVisitorText(), 'Move rendered visitor text into messages/*.json.').toEqual(
      [],
    );
    expect(staticApplicationTargets(), 'Use Astro locale URL helpers for internal routes.').toEqual(
      [],
    );
  });

  it('has one explicit Paraglide compiler owner and a development watcher', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const directOwners = Object.entries(packageJson.scripts).filter(([, command]) =>
      command.includes('paraglide-js compile'),
    );

    expect(directOwners).toEqual([
      ['i18n:compile', 'paraglide-js compile --project ./project.inlang'],
    ]);
    expect(packageJson.scripts.dev).toBe('node scripts/run-with-i18n-watch.mjs astro dev');
    expect(packageJson.scripts['test:watch']).toBe('node scripts/run-with-i18n-watch.mjs vitest');
    expect(packageJson.scripts.build).toContain('pnpm run i18n:compile');
    expect(packageJson.scripts.sync).toContain('pnpm run i18n:compile');
  });

  it('keeps generated Paraglide code out of source control', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('src/paraglide/');
    expect(existsSync('src/paraglide/.git')).toBe(false);
  });

  it('resolves localization before React hydration', () => {
    const headerImports = importsInFile('src/components/navigation/AppHeader.tsx');
    expect(headerImports).not.toContain('../../i18n/index.js');
    expect(headerImports.some((specifier) => specifier.includes('paraglide'))).toBe(false);
    expect(headerImports.some((specifier) => specifier.includes('inlang'))).toBe(false);
  });

  it('isolates the Cloudflare dev optimizer workaround behind a cold SSR gate', () => {
    const astroConfig = readFileSync('astro.config.mjs', 'utf8');
    const workaround = readFileSync('scripts/vite/cloudflare-ssr.mjs', 'utf8');
    const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');

    expect(astroConfig).toContain("from './scripts/vite/cloudflare-ssr.mjs'");
    expect(astroConfig).not.toContain('astro/virtual-modules/i18n.js');
    expect(workaround).toContain('astro/virtual-modules/i18n.js');
    expect(workflow).toContain('node scripts/check-dev-ssr.mjs');
  });

  it('does not keep the replaced custom runtime or message factories', () => {
    expect(existsSync('src/i18n/runtime.ts')).toBe(false);
    expect(existsSync('src/i18n/messages/types.ts')).toBe(false);
  });
});
