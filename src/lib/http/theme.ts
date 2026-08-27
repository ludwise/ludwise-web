/**
 * The visitor's color-scheme preference, carried in a cookie.
 *
 * A cookie rather than local storage, because this Worker has to render the right `data-theme`
 * on the first response. A flash of the light theme over a price comparison is a defect, not a
 * polish item. Anything read after first paint is too late by definition.
 *
 * `readThemeCookie` is a sanitiser rather than a convenience. The value is
 * caller-controlled and ends up in an attribute on `<html>`. So it answers
 * only with a member of a closed set or with null - never with what it was
 * given.
 */

export const THEME_COOKIE_NAME = 'theme';

/**
 * Both themes are authored. Neither is an inversion of the other. See
 * src/styles/tokens/color-semantic.css, which declares a full value set per
 * theme under `:root,[data-theme="light"]` and `[data-theme="dark"]`.
 */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** A year. The preference is not worth asking about twice. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/**
 * The recorded preference, or null when the visitor has none.
 *
 * Null is a distinct answer from either theme. It is what tells the document
 * to let the pre-paint script resolve `prefers-color-scheme` instead of
 * asserting a preference the visitor never expressed.
 */
export function readThemeCookie(cookieHeader: string | null | undefined): Theme | null {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    // Whole and exact, so neither `user_theme=dark` nor `darkish` matches. The token layer's
    // attribute selector is case-sensitive. A near-miss that reached the document would silently
    // produce an unstyled page.
    if (pair.slice(0, separator).trim() !== THEME_COOKIE_NAME) continue;

    const value = pair.slice(separator + 1).trim();
    return isTheme(value) ? value : null;
  }

  return null;
}

/**
 * The `Set-Cookie` value recording a preference.
 *
 * Deliberately not `HttpOnly`: the theme toggle writes it from the client, in the same handler
 * that sets `data-theme` on the document. The pre-paint script deliberately does not write it.
 * The reason is that storing a value with no act by the visitor is outside ePrivacy's
 * strictly-necessary exemption, see architecture decision record 0013. So the toggle is the only
 * writer. A writer inside the page has to be able to reach the cookie. That is safe because the
 * value carries no authority and `readThemeCookie` treats it as untrusted whatever wrote it.
 *
 * `secure` is a parameter rather than a constant because local development is
 * plain http on localhost, where a `Secure` cookie is simply dropped.
 */
export function serializeThemeCookie(theme: Theme, options: { secure: boolean }): string {
  return [
    `${THEME_COOKIE_NAME}=${theme}`,
    'Path=/',
    `Max-Age=${String(ONE_YEAR_SECONDS)}`,
    // Lax rather than Strict. A visitor following a link to a game page from a search engine
    // must see their own theme. They must not see a one-navigation flash of the other one.
    'SameSite=Lax',
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');
}
