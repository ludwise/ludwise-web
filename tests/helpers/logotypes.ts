/**
 * The LUDWISE wordmark accent, in the header and in the footer lockup. Axe
 * reports it as a contrast failure in the light theme: `--color-accent-primary`
 * measures 2.06:1 on the page background and 1.96:1 on the footer.
 *
 * Excluded because WCAG 1.4.3 exempts it — "text that is part of a logo or
 * brand name has no contrast requirement" — and the color is the design
 * system's own, specified in design/system/components/foundation.md.
 *
 * It excludes the accent elements and not the rule, so any other contrast
 * failure still fails. Every axe audit imports this one list, so no suite
 * can miss a lockup. The legibility question is raised with the designer
 * separately. Delete this list the moment the wordmark's color changes.
 */
export const LOGOTYPES = ['.lw-header__wordmark-accent', '.lw-wordmark__accent'] as const;
