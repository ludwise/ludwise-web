# Component reference

44 components in 10 groups. One markdown file per group, each containing every
component's prop contract, usage rules and reference implementation.

| File | Group | Components |
| --- | --- | --- |
| `foundation.md` | Foundation | `Icon`, `Wordmark`, `LudwiseMark` |
| `actions.md` | Actions | `Button`, `IconButton` |
| `forms.md` | Form controls | `TextField`, `SearchField`, `Select`, `Checkbox`, `Radio`, `Switch`, `Textarea` |
| `navigation.md` | Navigation | `AppHeader`, `Tabs`, `Pagination`, `Breadcrumbs` |
| `display.md` | Data display | `Badge`, `Chip`, `KeyValueList`, `DataTable` |
| `game.md` | Game primitives | `GameCard`, `GameRow`, `GameArtwork`, `Price`, `DiscountBadge`, `PriceSignal`, `FreshnessIndicator`, `StoreIdentity`, `Rating`, `OfferRow`, `ProvenanceNote` |
| `feedback.md` | Feedback | `InlineMessage`, `Banner`, `Toast`, `Skeleton`, `EmptyState` |
| `overlays.md` | Overlays | `Tooltip`, `Popover`, `Modal` |
| `charts.md` | Data visualisation | `PriceHistoryChart` |
| `monetisation.md` | Monetisation | `PromoSlot`, `AffiliateDisclosure` |

Start with `foundation.md` and `game.md`. The game primitives carry the product
semantics that a naive reimplementation breaks — see *Product semantics you can
break by accident* in the handoff README.
