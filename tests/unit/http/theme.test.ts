import { describe, expect, it } from 'vitest';

import {
  THEME_COOKIE_NAME,
  THEMES,
  readThemeCookie,
  serializeThemeCookie,
} from '../../../src/lib/http/theme.js';

/**
 * The theme cookie is caller-controlled and its value is rendered into an HTML
 * attribute on `<html>`. That makes `readThemeCookie` a sanitiser, not a
 * convenience: anything it lets through reaches the document, so it answers
 * only with a member of a closed set or with null.
 */

describe('readThemeCookie', () => {
  it.each(THEMES)('reads a recorded %s preference', (theme) => {
    expect(readThemeCookie(`${THEME_COOKIE_NAME}=${theme}`)).toBe(theme);
  });

  it('finds the cookie among others, in any position', () => {
    expect(readThemeCookie(`a=1; ${THEME_COOKIE_NAME}=dark; b=2`)).toBe('dark');
    expect(readThemeCookie(`${THEME_COOKIE_NAME}=dark; b=2`)).toBe('dark');
    expect(readThemeCookie(`a=1; ${THEME_COOKIE_NAME}=dark`)).toBe('dark');
  });

  it('reports no preference rather than guessing one', () => {
    expect(readThemeCookie(null)).toBeNull();
    expect(readThemeCookie('')).toBeNull();
    expect(readThemeCookie('other=dark')).toBeNull();
  });

  it.each([
    ['an unknown value', 'sepia'],
    ['an empty value', ''],
    ['an attribute-breaking value', '" onload="alert(1)'],
    ['a tag-breaking value', 'dark"><script>alert(1)</script>'],
    ['a value that merely starts with a valid one', 'darkish'],
    ['a case variant, since the attribute selector is case-sensitive', 'DARK'],
  ])('rejects %s', (_label, value) => {
    expect(readThemeCookie(`${THEME_COOKIE_NAME}=${value}`)).toBeNull();
  });

  it('does not match a cookie whose name merely ends with the theme name', () => {
    expect(readThemeCookie('user_theme=dark')).toBeNull();
  });

  it('survives a malformed cookie header without throwing', () => {
    expect(readThemeCookie('=;;; garbage; =value;')).toBeNull();
  });
});

describe('serializeThemeCookie', () => {
  it('scopes the cookie to the whole site and keeps it out of cross-site requests', () => {
    const cookie = serializeThemeCookie('dark', { secure: true });

    expect(cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=');
  });

  it('is not HttpOnly, because the pre-paint script has to write it', () => {
    // Deliberate, and safe: the value is a display preference with no
    // authority, and readThemeCookie treats it as untrusted regardless.
    expect(serializeThemeCookie('dark', { secure: true })).not.toContain('HttpOnly');
  });

  it('is Secure wherever the site is served over https, and not on plain-http localhost', () => {
    expect(serializeThemeCookie('light', { secure: true })).toContain('Secure');
    expect(serializeThemeCookie('light', { secure: false })).not.toContain('Secure');
  });
});
