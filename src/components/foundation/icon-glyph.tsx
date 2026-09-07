/**
 * One glyph from the compile-time icon map, for React islands.
 *
 * A React island cannot import Icon.astro. This module is the island
 * counterpart, over the same framework-neutral `./icons.js` map.
 *
 * `markup` is a lookup into `LUDWISE_ICONS`, keyed by the closed `IconName`
 * union and never derived from a request or a database row. That constancy is
 * the whole basis for switching escaping off. So nothing variable may join the
 * string. `title` is a prop, and reaches the accessible name through
 * `aria-label`, which React escapes, rather than an interpolated `<title>`.
 */
import { LUDWISE_ICONS, type IconName } from './icons.js';

export interface IconGlyphProps {
  name: IconName;
  size: number;
  /** Provide ONLY when the icon carries meaning no adjacent text carries.
   *  Omitting it marks the icon aria-hidden, which is correct beside a label. */
  title?: string | undefined;
}

export function IconGlyph({ name, size, title }: IconGlyphProps) {
  const markup = LUDWISE_ICONS[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      // Same technique as Icon.astro's set:html: the map holds markup
      // strings (possibly several sibling <path>s), not a single element.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
