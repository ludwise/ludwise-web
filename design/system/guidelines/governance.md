# Governance

The system is **closed to arbitrary modification, open to deliberate extension** — the same stance `PRODUCT.md` §11.10 takes on the platform itself.

## When a new token is justified

Add a token only when **all** of these hold:

1. The value expresses a role no existing semantic token covers. (A new shade of an existing role is not a new role.)
2. It will be used in at least two places, or in one place that will certainly grow.
3. It can be named for its role without naming its appearance or its location.
4. It has a light and a dark value, both contrast-checked.

Otherwise: compose from existing tokens. Most "we need a new colour" requests are a missing semantic alias over an existing primitive.

**Never** add a token for: a one-off screen, a marketing page, a single component's internal value, or a retailer's brand colour beyond the seven already primitive.

## When a new component is justified

Add a component only when:

1. The pattern appears in at least two product surfaces.
2. It cannot be expressed by composing existing components without duplicating logic that must stay consistent (formatting, disclosure wording, accessibility wiring).
3. It encodes a product rule that would otherwise be re-argued each time — `PromoSlot` and `AffiliateDisclosure` are the two examples in this system.

Otherwise: compose. A "deal card" is a `GameCard` with a `signal`. A "store picker" is a `Popover` with `Checkbox` rows.

**Never** add a variant to escape a layout problem. Three `GameCard` variants exist; a fourth needs a system change, not a prop.

## Known extension points, deliberately unbuilt

| Component | When to build it |
| --- | --- |
| Combobox | When a filter exceeds ~15 options and the user needs to type. Compose `SearchField` + `Popover` first. |
| Range slider | When price filtering by band stops being enough. Must remain keyboard-operable and paired with two number inputs. |
| Date range | When history filtering by preset range stops being enough. |
| Wishlist toggle | When accounts exist. Must not live inside `GameCard` — see the nested-interactive rule. |
| API console primitives | When the B2B surface begins. `DataTable`, `KeyValueList`, `Badge` and Geist Mono should cover it. |

## Versioning

Semantic versioning against the **public API** — the exported components, their props, and the semantic token names. Primitive values are internal; changing what `--color-price-current` resolves to is not automatically breaking, changing its name is.

**PATCH** — a contrast fix inside an existing token, a corrected `.prompt.md`, a bug in a component's internals that does not change its output shape, a new icon in the set.

**MINOR** — a new semantic token, a new component, a new optional prop with a safe default, a new documented pattern, a new `@dsCard`.

**MAJOR** — renaming or removing a semantic token, removing or renaming a component or a prop, changing a default that alters existing screens, changing the type scale or the spacing base, changing the accent hue.

Every change records **what changed, why, and what a consumer must do**. A MAJOR ships with a migration note naming every renamed token.

## Review checklist for any change

- Does it work in both themes?
- Does it survive greyscale and a 35% longer string?
- Does it hold at 200% zoom and at 375px wide?
- Does it keep colour out of the meaning?
- Could a retailer's commercial interest have influenced it? If yes, stop.
