/**
 * Reference: design/system/components/navigation.md § AppHeader — prop
 * contract, and `useIsCompactHeader`, ported verbatim. The global header:
 * wordmark, primary destinations, search, market, theme, account. Sticky,
 * 60px, one hairline bottom border, no shadow.
 *
 * The one `client:load` island on the page (see the handoff README's island
 * table) — theme toggle, search and the sub-1024px collapse all need it.
 * SearchField is part of this file rather than its own component because the
 * handoff itself makes SearchField part of AppHeader, not a standalone
 * export.
 *
 * Icon.astro, IconButton.astro, Button.astro and Wordmark.astro are Astro
 * components and cannot be imported into a React island — Astro's component
 * model does not cross into React the other direction. This file therefore
 * renders its own icon glyphs from the shared `../foundation/icons.js`
 * map and its own minimal button/wordmark markup in AppHeader.css, matching
 * the static components' visual language rather than reusing their code.
 *
 * The reference implementation assumes search and accounts already exist as
 * product capabilities. Search is now wired to a native GET action, while
 * accounts remain gated on the prop that carries their behaviour:
 *
 *   - The search field (both the desktop slot and the mobile row) renders
 *     when the host supplies either a native GET `searchAction` or the
 *     existing interactive `onSearchChange` handler. A native action keeps
 *     search available before hydration and on pages without client state.
 *   - The account/sign-in control renders only when the host supplies
 *     `authed` (i.e. `authed !== undefined`), not merely when it is
 *     supplied and true. A host that has not said whether the visitor is
 *     authenticated has no account state to show, so `authed`'s default was
 *     removed rather than left at `false` — a default would make "unknown"
 *     indistinguishable from "answered no".
 *
 * The account gate reuses the existing prop as the signal that the capability
 * is wired up. Remove it the day account state is implemented.
 */
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';

import { LUDWISE_ICONS, type IconName } from '../foundation/icons.js';
import { serializeThemeCookie, type Theme } from '../../lib/http/theme.js';
import './AppHeader.css';

function IconGlyph({
  name,
  size,
  title,
}: {
  name: IconName;
  size: number;
  title?: string | undefined;
}) {
  const markup = LUDWISE_ICONS[name];
  // `markup` is never derived from a request, a database row or any other
  // runtime value — it is a lookup into the static, compile-time
  // LUDWISE_ICONS map keyed by the closed IconName union, the same trusted
  // source Icon.astro's set:html uses. That constancy is the whole basis for
  // switching escaping off, so nothing variable may join the string:
  // `title` is a prop and reaches the accessible name through aria-label,
  // which React escapes, rather than through an interpolated <title>.
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

// The lockup, reimplemented from Wordmark.astro/LudwiseMark.astro's geometry
// because those are Astro components (see the file comment above). Fixed at
// the reference's `<Wordmark size="md" href="#" />`, except the href: the
// reference's `#` was a placeholder for a specimen with no router, and this
// is the second tab stop on every real page, announcing itself as "LUDWISE —
// home" — it has to actually go there. The header does not expose a size or
// tone knob, matching the prop contract, which has none.
const WORDMARK_PX = 19;
const WORDMARK_TILE_RATIO = 1.22;
const WORDMARK_GAP_RATIO = 0.42;
const WORDMARK_TILE_RADIUS_RATIO = 0.22;
const WORDMARK_STEP_RATIO = 0.64;

function HeaderWordmark() {
  const tileSize = Math.round(WORDMARK_PX * WORDMARK_TILE_RATIO);
  const gap = Math.round(WORDMARK_PX * WORDMARK_GAP_RATIO);
  const radius = Math.round(tileSize * WORDMARK_TILE_RADIUS_RATIO);
  const stepSize = tileSize * WORDMARK_STEP_RATIO;

  return (
    <a href="/" aria-label="LUDWISE — home" className="lw-header__wordmark" style={{ gap }}>
      <span
        aria-hidden="true"
        className="lw-header__mark"
        style={{ width: tileSize, height: tileSize, borderRadius: radius }}
      >
        <svg
          width={stepSize}
          height={stepSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ludwise-neutral-1000)"
          strokeWidth={2.2}
          strokeLinecap="square"
        >
          <path d="M4 7h6v5h5v5h5" />
        </svg>
      </span>
      <span className="lw-header__wordmark-text" style={{ fontSize: WORDMARK_PX }}>
        LUD<span className="lw-header__wordmark-accent">WISE</span>
      </span>
    </a>
  );
}

interface SearchFieldProps {
  value?: string | undefined;
  onChange?: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onClear?: (() => void) | undefined;
  /** Shows a spinner in place of the magnifier while results are in flight.
   *  The previous results stay on screen — never blank them. */
  loading?: boolean | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  placeholder?: string | undefined;
  /** Accessible name. Defaults to "Search games". */
  label?: string | undefined;
  name?: string | undefined;
}

/** design/system/components/forms.md § SearchField — prop contract ported
 *  verbatim, minus the raw HTML-attribute passthrough the reference inherits
 *  via `extends Omit<InputHTMLAttributes, ...>`: this SearchField is used only
 *  from within AppHeader, not exported as a standalone public primitive, so
 *  that passthrough surface has no caller here. */
function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search games',
  size = 'md',
  loading = false,
  label = 'Search games',
  name = 'q',
}: SearchFieldProps) {
  const hasValue = value != null && value.length > 0;

  return (
    <div role="search" className="lw-search" data-size={size}>
      <span className="lw-search__icon">
        {loading ? (
          <span className="lw-search__spinner">
            <IconGlyph name="loader-circle" size={16} />
          </span>
        ) : (
          <IconGlyph name="search" size={16} />
        )}
      </span>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        name={name}
        {...(onChange === undefined ? { defaultValue: value } : { value, onChange })}
        className="lw-search__input"
      />
      {hasValue && onClear && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="lw-search__clear"
        >
          <IconGlyph name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export interface NavItem {
  id: string;
  label: string;
  href?: string | undefined;
}

export interface AppHeaderProps {
  items: NavItem[];
  activeId?: string | undefined;
  /** Called with the item id when a nav link is clicked; the default anchor
   *  navigation is prevented. Omit for a real multi-page app, where the href
   *  should navigate normally. */
  onNavigate?: ((id: string) => void) | undefined;
  searchValue?: string | undefined;
  /** Native GET destination for the server-rendered search form. */
  searchAction?: string | undefined;
  onSearchChange?: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onSearchClear?: (() => void) | undefined;
  theme?: Theme | undefined;
  onThemeToggle?: (() => void) | undefined;
  /** Current commercial market and currency, e.g. "EUR · Eurozone". Distinct
   *  from UI language — never conflate the two. */
  marketLabel?: string | undefined;
  /** Called with the new open state when the compact menu button is pressed.
   *  The header manages its own menu panel; this is only for host-side effects
   *  such as locking body scroll. */
  onMenu?: ((open: boolean) => void) | undefined;
  authed?: boolean | undefined;
  /** Forces the layout. Omit in product code — the header observes
   *  --breakpoint-lg (1024) itself. Supply it only in tests and specimens. */
  compact?: boolean | undefined;
}

// Mirrors --breakpoint-lg in src/styles/tokens/layout.css. JS media-query
// logic cannot read a CSS custom property, so this default has to be kept in
// sync by hand if that token ever changes.
const DEFAULT_COMPACT_BREAKPOINT = 1024;

/** Returns true below the given breakpoint (default 1024). Exported so a host
 *  can keep its own layout in step with the header's. */
export function useIsCompactHeader(breakpoint: number = DEFAULT_COMPACT_BREAKPOINT): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(`(max-width:${breakpoint - 0.02}px)`);
    const onChange = (event: MediaQueryListEvent) => setCompact(event.matches);
    setCompact(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [breakpoint]);

  return compact;
}

/**
 * Open/closed state for the compact menu panel, and the Escape and resize
 * behaviour that closes it.
 *
 * A non-modal disclosure, not a modal dialog: opening it never moves focus
 * into the panel, so there is no focus trap and nothing to restore — only a
 * place for focus to land when Escape closes it, which
 * accessibility.md § Focus and keyboard requires. Escape is listened for on
 * the document rather than the panel because focus may be on the trigger,
 * inside the panel, or (having tabbed past it) beyond both.
 */
function useMenuPanel(onMenu: ((open: boolean) => void) | undefined) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const viewportIsCompact = useIsCompactHeader();

  // The panel's own state, not the layout. CSS already hides the panel at
  // desktop width, but React state should not disagree with what is on screen
  // once a real resize has passed the breakpoint.
  useEffect(() => {
    if (!viewportIsCompact) setMenuOpen(false);
  }, [viewportIsCompact]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      onMenu?.(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, onMenu]);

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    onMenu?.(next);
  };

  return { menuOpen, menuButtonRef, toggleMenu, closeMenu: () => setMenuOpen(false) };
}

/**
 * The theme the toggle shows and switches to.
 *
 * Resolved here rather than round-tripped through the host, so the glyph
 * changes on click rather than on the next render the host happens to cause.
 *
 * `initial` is the cookie value the server resolved (src/lib/http/theme.ts),
 * which is all the server can know. A first-time visitor has no cookie, so
 * what is actually on `<html>` was decided before paint by the head script
 * from prefers-color-scheme — the effect below adopts that, or the toggle
 * would offer to switch to the theme already showing.
 */
function useHeaderTheme(initial: Theme, onThemeToggle: (() => void) | undefined) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(initial);

  useEffect(() => {
    const rendered = document.documentElement.dataset.theme;
    if (rendered === 'light' || rendered === 'dark') setCurrentTheme(rendered);
  }, []);

  const toggleTheme = () => {
    const next: Theme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = serializeThemeCookie(next, { secure: location.protocol === 'https:' });
    onThemeToggle?.();
  };

  return { currentTheme, toggleTheme };
}

export function AppHeader({
  items,
  activeId,
  onNavigate,
  searchValue,
  searchAction,
  onSearchChange,
  onSearchClear,
  theme = 'light',
  onThemeToggle,
  marketLabel,
  onMenu,
  authed,
  compact,
}: AppHeaderProps) {
  const { menuOpen, menuButtonRef, toggleMenu, closeMenu } = useMenuPanel(onMenu);
  const { currentTheme, toggleTheme } = useHeaderTheme(theme, onThemeToggle);

  // Which layout renders is CSS's job, never this component's: useIsCompactHeader
  // resolves in an effect, so it answers `false` on the server and for the whole
  // pre-hydration window, and a layout only correct after hydration would break
  // the server-rendered HTML PRODUCT.md §83 and §89 require.
  //
  // `compact` is the escape hatch the prop contract documents. Supplied, it is
  // written onto the root as `data-compact`, which AppHeader.css gives higher
  // specificity than the media query; omitted, no attribute is written and the
  // media query alone decides.
  const compactOverride = compact === undefined ? undefined : compact ? 'true' : 'false';

  const handleNavClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(id);
    closeMenu();
  };

  // Two DOM instances of the nav, not one instance whose styling depends on
  // JS state: `bar` is the row of links shown inline at desktop width,
  // `panel` is the column of touch-sized links shown inside the mobile menu
  // panel. Which one is visible is a CSS concern (AppHeader.css); which one
  // this is affects only its own classes, never anything computed at
  // render time, so there is nothing for hydration to get temporarily wrong.
  const renderNav = (variant: 'bar' | 'panel') => (
    <nav aria-label="Primary" className={`lw-header__nav lw-header__nav--${variant}`}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={item.href ?? '#'}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate ? handleNavClick(item.id) : undefined}
            className="lw-header__nav-link"
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );

  // Same reasoning as renderNav: the bar copy carries an extra class so CSS
  // can hide it at compact widths, the panel copy needs no such class
  // because its whole container is already gated on `menuOpen`.
  const renderMarketButton = (extraClassName?: string) =>
    marketLabel ? (
      <button
        type="button"
        className={
          extraClassName ? `lw-header__market-button ${extraClassName}` : 'lw-header__market-button'
        }
      >
        {marketLabel}
      </button>
    ) : null;

  const themeToggleLabel =
    currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  const hasSearch = searchAction !== undefined || onSearchChange !== undefined;
  const renderSearch = (size: 'sm' | 'md') => {
    const field = (
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        onClear={onSearchClear}
        size={size}
      />
    );
    return searchAction === undefined ? (
      field
    ) : (
      <form action={searchAction} method="get" aria-label="Search games">
        {field}
      </form>
    );
  };

  return (
    <header className="lw-header" data-compact={compactOverride}>
      <div className="lw-header__bar">
        <div className="lw-header__logo">
          <HeaderWordmark />
        </div>

        {renderNav('bar')}

        {/* CSS chooses the desktop copy; the native GET form remains usable
            before the island hydrates. */}
        {hasSearch && <div className="lw-header__search-slot">{renderSearch('sm')}</div>}

        <div className="lw-header__utilities-slot">
          <div className="lw-header__utilities">
            {renderMarketButton('lw-header__market-desktop')}

            {/* A mode switch, not a pressed toggle: the label names the action
                and aria-pressed stays off. Sized 40/44 by AppHeader.css rather
                than by a JS viewport check, like every other size here. */}
            <button
              type="button"
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
              onClick={toggleTheme}
              className="lw-header__icon-button"
            >
              <IconGlyph name={currentTheme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>

            {/* Gated on authed !== undefined — see the file comment. A host
                that has not said whether the visitor is authenticated has no
                account state to show; `authed`'s prop default was removed
                (rather than left at `false`) precisely so "unknown" and
                "answered no" stay distinguishable here. */}
            {authed !== undefined &&
              (authed ? (
                <button
                  type="button"
                  aria-label="Account"
                  title="Account"
                  className="lw-header__icon-button"
                >
                  <IconGlyph name="user" size={16} />
                </button>
              ) : (
                <button type="button" className="lw-header__signin">
                  Sign in
                </button>
              ))}

            {/* Rendered unconditionally, because CSS decides whether it shows:
                gating it on a hydration-resolved value would leave it out of the
                server HTML, where a mobile visitor's only route to the nav is.

                aria-expanded, not aria-pressed: this discloses `#lw-header-menu`
                rather than toggling a pressed state. The name stays "Menu" —
                aria-expanded already carries open/closed, and a changing name
                alongside it states the same thing twice. The glyph carries it
                visually through `data-pressed`, which implies no ARIA role. */}
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Menu"
              title="Menu"
              aria-expanded={menuOpen}
              aria-controls="lw-header-menu"
              onClick={toggleMenu}
              className="lw-header__icon-button lw-header__menu-button"
              data-pressed={menuOpen || undefined}
            >
              <IconGlyph name={menuOpen ? 'x' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Unconditional for the same reason as the menu button; CSS decides
          whether this or the inline `.lw-header__search-slot` copy shows. */}
      {hasSearch && <div className="lw-header__mobile-search">{renderSearch('md')}</div>}

      {/* The one genuinely JS-controlled piece: a disclosure panel has to hold
          open/closed somewhere. `menuOpen` starts `false` on both server and
          client, so this gate cannot mismatch on hydration. AppHeader.css hides
          it at desktop width as a backstop. */}
      {menuOpen && (
        <div id="lw-header-menu" className="lw-header__mobile-panel">
          {renderNav('panel')}
          {marketLabel && <div className="lw-header__mobile-market">{renderMarketButton()}</div>}
        </div>
      )}
    </header>
  );
}
