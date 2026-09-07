/**
 * The measurements of the LUDWISE lockup, in one place.
 *
 * Wordmark.astro draws it, and AppHeader.tsx draws it again because a React
 * island cannot import an Astro component. The two markup trees are
 * unavoidable. Two copies of the numbers are not. A lockup a fraction off in
 * the header is the kind of drift nobody sees in review.
 *
 * Reference: design/system/components/foundation.md § Wordmark.
 */

/** Cap height in px per size step. Everything else derives from it. */
export const WORDMARK_CAP_HEIGHT = { sm: 15, md: 19, lg: 26, xl: 34 } as const;

export type WordmarkSize = keyof typeof WORDMARK_CAP_HEIGHT;

/** Tile edge, relative to the cap height. */
export const WORDMARK_TILE_RATIO = 1.22;
/** Space between the tile and the wordmark, relative to the cap height. */
export const WORDMARK_GAP_RATIO = 0.42;
/** Corner radius, relative to the tile edge. */
export const WORDMARK_TILE_RADIUS_RATIO = 0.22;
/** Step size, relative to the tile edge. */
export const WORDMARK_STEP_RATIO = 0.64;

/**
 * A constant stroke at every size.
 *
 * The bundle's prop comment says the stroke thickens below 22px. Its rules
 * paragraph, and its reference implementation, both keep 2.2 at every size:
 * "do not thicken it at small sizes, the treads close up and it stops reading
 * as a staircase". The rules paragraph wins.
 */
export const WORDMARK_STEP_STROKE_WIDTH = 2.2;

/** The descending three-step path. It is also the shape the price chart draws. */
export const WORDMARK_STEP_PATH = 'M4 7h6v5h5v5h5';

/** Tracking of the lockup. Wider than the label roles, which are type scale. */
export const WORDMARK_LETTER_SPACING = '0.14em';
