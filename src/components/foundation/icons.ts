/**
 * LUDWISE iconography — Lucide (ISC licence, see design/system/assets/icons/LICENSE).
 *
 * Source SVGs are vendored at design/system/assets/icons/. The inner markup is
 * inlined here, verbatim from design/system/components/foundation.md, so an
 * icon renders with no network request and inherits `currentColor`. Stroke
 * width is normalized to 1.75 at every size. That is what reads correctly
 * both at 14px in a table cell and at 24px in a header.
 *
 * This module is framework-neutral on purpose. `Icon.astro` (static pages)
 * and `AppHeader.tsx` (the one React island) both need the same 49 glyphs.
 * A React-only `lucide-react` dependency is explicitly out of scope. One
 * name→path-data map shared by both keeps the glyph set — and any future
 * addition to it — in exactly one place.
 */

export type IconName =
  | 'arrow-down'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-up-down'
  | 'arrow-up-right'
  | 'bell'
  | 'calendar'
  | 'chart-line'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-alert'
  | 'circle-check'
  | 'circle-question-mark'
  | 'clock'
  | 'clock-fading'
  | 'ellipsis'
  | 'external-link'
  | 'eye-off'
  | 'funnel'
  | 'globe'
  | 'grid-2x2'
  | 'heart'
  | 'image-off'
  | 'info'
  | 'list'
  | 'list-filter'
  | 'loader-circle'
  | 'menu'
  | 'minus'
  | 'moon'
  | 'plus'
  | 'refresh-cw'
  | 'rotate-ccw'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'sliders-horizontal'
  | 'star'
  | 'store'
  | 'sun'
  | 'tag'
  | 'thumbs-up'
  | 'triangle-alert'
  | 'user'
  | 'wallet'
  | 'x';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const ICON_SIZES: Record<IconSize, number> = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };

export const LUDWISE_ICONS: Record<IconName, string> = {
  'arrow-down': '<path d="M12 5v14"></path> <path d="m19 12-7 7-7-7"></path>',
  'arrow-right': '<path d="M5 12h14"></path> <path d="m12 5 7 7-7 7"></path>',
  'arrow-up': '<path d="m5 12 7-7 7 7"></path> <path d="M12 19V5"></path>',
  'arrow-up-down':
    '<path d="m21 16-4 4-4-4"></path> <path d="M17 20V4"></path> <path d="m3 8 4-4 4 4"></path> <path d="M7 4v16"></path>',
  'arrow-up-right': '<path d="M7 7h10v10"></path> <path d="M7 17 17 7"></path>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"></path> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>',
  calendar:
    '<path d="M8 2v3"></path> <path d="M16 2v3"></path> <rect x="3" y="3" width="18" height="18" rx="2"></rect> <path d="M3 9h18"></path>',
  'chart-line': '<path d="M3 3v16a2 2 0 0 0 2 2h16"></path> <path d="m19 9-5 5-4-4-3 3"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  'chevron-left': '<path d="m15 18-6-6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  'chevron-up': '<path d="m18 15-6-6-6 6"></path>',
  'circle-alert':
    '<circle cx="12" cy="12" r="10"></circle> <line x1="12" x2="12" y1="8" y2="12"></line> <line x1="12" x2="12.01" y1="16" y2="16"></line>',
  'circle-check': '<circle cx="12" cy="12" r="10"></circle> <path d="m9 12 2 2 4-4"></path>',
  'circle-question-mark':
    '<circle cx="12" cy="12" r="10"></circle> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path> <path d="M12 17h.01"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle> <path d="M12 6v6l4 2"></path>',
  'clock-fading':
    '<path d="M12 2a10 10 0 0 1 7.38 16.75"></path> <path d="M12 6v6l4 2"></path> <path d="M2.5 8.875a10 10 0 0 0-.5 3"></path> <path d="M2.83 16a10 10 0 0 0 2.43 3.4"></path> <path d="M4.636 5.235a10 10 0 0 1 .891-.857"></path> <path d="M8.644 21.42a10 10 0 0 0 7.631-.38"></path>',
  ellipsis:
    '<circle cx="12" cy="12" r="1"></circle> <circle cx="19" cy="12" r="1"></circle> <circle cx="5" cy="12" r="1"></circle>',
  'external-link':
    '<path d="M15 3h6v6"></path> <path d="M10 14 21 3"></path> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  'eye-off':
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path> <path d="m2 2 20 20"></path>',
  funnel:
    '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"></path>',
  globe:
    '<circle cx="12" cy="12" r="10"></circle> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path> <path d="M2 12h20"></path>',
  'grid-2x2':
    '<path d="M12 3v18"></path> <path d="M3 12h18"></path> <rect x="3" y="3" width="18" height="18" rx="2"></rect>',
  heart:
    '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>',
  'image-off':
    '<line x1="2" x2="22" y1="2" y2="22"></line> <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"></path> <line x1="13.5" x2="6" y1="13.5" y2="21"></line> <line x1="18" x2="21" y1="12" y2="15"></line> <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"></path> <path d="M21 15V5a2 2 0 0 0-2-2H9"></path>',
  info: '<circle cx="12" cy="12" r="10"></circle> <path d="M12 16v-4"></path> <path d="M12 8h.01"></path>',
  list: '<path d="M3 5h.01"></path> <path d="M3 12h.01"></path> <path d="M3 19h.01"></path> <path d="M8 5h13"></path> <path d="M8 12h13"></path> <path d="M8 19h13"></path>',
  'list-filter': '<path d="M2 5h20"></path> <path d="M6 12h12"></path> <path d="M9 19h6"></path>',
  'loader-circle': '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>',
  menu: '<path d="M4 5h16"></path> <path d="M4 12h16"></path> <path d="M4 19h16"></path>',
  minus: '<path d="M5 12h14"></path>',
  moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>',
  plus: '<path d="M5 12h14"></path> <path d="M12 5v14"></path>',
  'refresh-cw':
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path> <path d="M21 3v5h-5"></path> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path> <path d="M8 16H3v5"></path>',
  'rotate-ccw':
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path> <path d="M3 3v5h5"></path>',
  search: '<path d="m21 21-4.34-4.34"></path> <circle cx="11" cy="11" r="8"></circle>',
  settings:
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path> <circle cx="12" cy="12" r="3"></circle>',
  'shield-check':
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path> <path d="m9 12 2 2 4-4"></path>',
  'sliders-horizontal':
    '<path d="M10 5H3"></path> <path d="M12 19H3"></path> <path d="M14 3v4"></path> <path d="M16 17v4"></path> <path d="M21 12h-9"></path> <path d="M21 19h-5"></path> <path d="M21 5h-7"></path> <path d="M8 10v4"></path> <path d="M8 12H3"></path>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>',
  store:
    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"></path> <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"></path> <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle> <path d="M12 2v2"></path> <path d="M12 20v2"></path> <path d="m4.93 4.93 1.41 1.41"></path> <path d="m17.66 17.66 1.41 1.41"></path> <path d="M2 12h2"></path> <path d="M20 12h2"></path> <path d="m6.34 17.66-1.41 1.41"></path> <path d="m19.07 4.93-1.41 1.41"></path>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path> <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>',
  'thumbs-up':
    '<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path> <path d="M7 10v12"></path>',
  'triangle-alert':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path> <circle cx="12" cy="7" r="4"></circle>',
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path> <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>',
  x: '<path d="M18 6 6 18"></path> <path d="m6 6 12 12"></path>',
};
