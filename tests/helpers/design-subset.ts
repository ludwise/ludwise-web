/**
 * The design-system adoption, as data.
 *
 * `design/system/components/` holds 44 primitives. Issue #77 adopts a subset
 * of 20, states the island split, and names what is absent and why. All three
 * answers live here, so the subset test and the orphan rule in
 * design-system.test.ts read the same list.
 */

export interface AdoptedComponent {
  /** The name the prop contract in design/system/components/ uses. */
  readonly name: string;
  /** Repository-relative path. */
  readonly file: string;
  /** design/README.md decides this. An island carries a `client:` directive. */
  readonly kind: 'static' | 'island';
}

/** The MVP subset issue #77 adopts. Wordmark ships with LudwiseMark. */
export const ADOPTED_SUBSET: readonly AdoptedComponent[] = [
  { name: 'Button', file: 'src/components/actions/Button.astro', kind: 'static' },
  { name: 'IconButton', file: 'src/components/actions/IconButton.astro', kind: 'static' },
  { name: 'Badge', file: 'src/components/display/Badge.astro', kind: 'static' },
  { name: 'Chip', file: 'src/components/display/Chip.tsx', kind: 'island' },
  { name: 'KeyValueList', file: 'src/components/display/KeyValueList.astro', kind: 'static' },
  { name: 'Breadcrumbs', file: 'src/components/navigation/Breadcrumbs.astro', kind: 'static' },
  { name: 'Pagination', file: 'src/components/navigation/Pagination.astro', kind: 'static' },
  { name: 'Skeleton', file: 'src/components/feedback/Skeleton.astro', kind: 'static' },
  { name: 'Banner', file: 'src/components/feedback/Banner.astro', kind: 'static' },
  { name: 'GameArtwork', file: 'src/components/game/GameArtwork.astro', kind: 'static' },
  { name: 'GameRow', file: 'src/components/game/GameRow.astro', kind: 'static' },
  { name: 'OfferRow', file: 'src/components/game/OfferRow.astro', kind: 'static' },
  { name: 'ProvenanceNote', file: 'src/components/game/ProvenanceNote.astro', kind: 'static' },
  { name: 'Tooltip', file: 'src/components/overlays/Tooltip.tsx', kind: 'island' },
  { name: 'Popover', file: 'src/components/overlays/Popover.tsx', kind: 'island' },
  { name: 'SearchField', file: 'src/components/forms/SearchField.tsx', kind: 'island' },
  { name: 'Select', file: 'src/components/forms/Select.tsx', kind: 'island' },
  { name: 'Checkbox', file: 'src/components/forms/Checkbox.astro', kind: 'static' },
  { name: 'Radio', file: 'src/components/forms/Radio.astro', kind: 'static' },
  { name: 'Wordmark', file: 'src/components/foundation/Wordmark.astro', kind: 'static' },
  { name: 'LudwiseMark', file: 'src/components/foundation/LudwiseMark.astro', kind: 'static' },
];

/** Adopted before issue #77, and outside its scope. */
export const ALREADY_ADOPTED: readonly AdoptedComponent[] = [
  { name: 'Icon', file: 'src/components/foundation/Icon.astro', kind: 'static' },
  { name: 'AppHeader', file: 'src/components/navigation/AppHeader.tsx', kind: 'island' },
  { name: 'EmptyState', file: 'src/components/feedback/EmptyState.astro', kind: 'static' },
  { name: 'InlineMessage', file: 'src/components/feedback/InlineMessage.astro', kind: 'static' },
  { name: 'DiscountBadge', file: 'src/components/game/DiscountBadge.astro', kind: 'static' },
  {
    name: 'FreshnessIndicator',
    file: 'src/components/game/FreshnessIndicator.astro',
    kind: 'static',
  },
  { name: 'GameCard', file: 'src/components/game/GameCard.astro', kind: 'static' },
  { name: 'Price', file: 'src/components/game/Price.astro', kind: 'static' },
  { name: 'StoreIdentity', file: 'src/components/game/StoreIdentity.astro', kind: 'static' },
];

/**
 * The 12 primitives issue #77 excludes. The reason for each is on the issue.
 *
 * A later issue that ports one of these must first say where its data comes
 * from.
 */
export const EXCLUDED_COMPONENTS: readonly string[] = [
  'AffiliateDisclosure',
  'DataTable',
  'Modal',
  'PriceHistoryChart',
  'PriceSignal',
  'PromoSlot',
  'Rating',
  'Switch',
  'Tabs',
  'Textarea',
  'TextField',
  'Toast',
];

/**
 * Subset members that nothing renders yet.
 *
 * Issue #77 adopts the primitives and touches no page, because issue #93 owns
 * the composition. So the "every component has a consumer" rule in
 * design-system.test.ts cannot hold for these until #93 lands. The exemption
 * is pinned rather than open. That test also asserts every entry is still an
 * orphan, so a composed component has to leave this list.
 */
export const AWAITING_COMPOSITION: readonly string[] = [
  'src/components/display/Badge.astro',
  'src/components/display/Chip.tsx',
  'src/components/display/KeyValueList.astro',
  'src/components/feedback/Banner.astro',
  'src/components/forms/Checkbox.astro',
  'src/components/forms/Radio.astro',
  'src/components/forms/Select.tsx',
  'src/components/foundation/Wordmark.astro',
  'src/components/game/GameRow.astro',
  'src/components/game/OfferRow.astro',
  'src/components/game/ProvenanceNote.astro',
  'src/components/navigation/Breadcrumbs.astro',
  'src/components/navigation/Pagination.astro',
  'src/components/overlays/Popover.tsx',
  'src/components/overlays/Tooltip.tsx',
];
