import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALE_FALLBACKS,
  LOCALE_ROUTING,
  SUPPORTED_LOCALES,
} from '../../i18n.config.js';
import { baseLocale, getTextDirection, locales, messages as m } from '../../src/i18n/index.js';

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

describe('localization architecture', () => {
  it('keeps Astro and Inlang locale configuration aligned', () => {
    expect(DEFAULT_LOCALE).toBe(settings.baseLocale);
    expect([...SUPPORTED_LOCALES]).toEqual(settings.locales);

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

  it('uses Astro as the only URL-routing owner for present and future locales', () => {
    const astroConfig = readFileSync('astro.config.mjs', 'utf8');
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');

    expect(astroConfig).toContain('i18n: {');
    expect(astroConfig).toContain("trailingSlash: 'never'");
    expect(astroConfig).not.toContain('paraglideVitePlugin');
    expect(layout).toContain("from 'astro:i18n'");
    expect(layout).toContain("getRelativeLocaleUrl(locale, 'games')");
    expect(layout).toContain("getRelativeLocaleUrl(locale, 'sales')");
  });

  it('has one explicit Paraglide compiler owner', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const directOwners = Object.entries(packageJson.scripts).filter(([, command]) =>
      command.includes('paraglide-js compile'),
    );

    expect(directOwners).toEqual([
      ['i18n:compile', 'paraglide-js compile --project ./project.inlang'],
    ]);
    expect(packageJson.scripts.dev).toContain('pnpm run i18n:compile');
    expect(packageJson.scripts.build).toContain('pnpm run i18n:compile');
    expect(packageJson.scripts.sync).toContain('pnpm run i18n:compile');
    expect(packageJson.scripts.typecheck).toContain('pnpm run i18n:compile');
  });

  it('keeps generated Paraglide code out of source control', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('src/paraglide/');
    expect(existsSync('src/paraglide/.git')).toBe(false);
  });

  it('resolves document locale, direction, copy, and URLs before React hydration', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    const header = readFileSync('src/components/navigation/AppHeader.tsx', 'utf8');

    expect(layout).toContain('<html lang={locale} dir={getTextDirection(locale)}');
    expect(layout).toContain('copy={headerCopy}');
    expect(layout).toContain('homeHref={homeHref}');
    expect(layout).toContain('searchAction={gamesHref}');
    expect(header).not.toContain('paraglide');
    expect(header).not.toContain('inlang');
    expect(header).not.toContain("from '../../i18n");
  });

  it('does not keep the replaced custom runtime or message factories', () => {
    expect(existsSync('src/i18n/runtime.ts')).toBe(false);
    expect(existsSync('src/i18n/messages/types.ts')).toBe(false);
  });
});
