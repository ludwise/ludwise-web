# Content style

## Fixed strings

These are not suggestions. Reuse them verbatim.

**Historical price**
- `Lowest price observed by LUDWISE since {Month Year}`
- `Matches lowest observed price`
- `{amount} above observed low`
- `No history collected yet`
- `LUDWISE has recorded {n} price observations for this game since {date}.`

**Prohibited historical claims**
- All-time low · Best price ever · Historic low · Cheapest it has ever been · Lowest price on the internet

**Freshness**
- `Updated {n} min ago` · `Checked {n} hours ago` · `Last checked {n} days ago` · `Freshness unknown` · `{Store} not responding — showing last known price`

**Missing data**
- `Not provided` — the provider does not supply this field
- `Unavailable` — the offer cannot currently be bought
- `No history collected yet` — the observation window is empty
- Never `0`, `—`, `N/A`, `Unknown` as a bare value

**Derived data**
- `Derived by LUDWISE from the observations below`
- `LUDWISE normalised {n}/100`
- `Converted from store currency`

**Affiliate** — all three clauses, unparaphrased:
> Some store links are affiliate links. LUDWISE may earn a commission. Your price does not change, and commission never affects ranking or which offers are shown.

**Ads** — the container label is `Advertisement` or `Sponsored`. Never `Featured`, `Recommended`, `Partner`, `Picks for you`.

## Labels

Sentence case. Noun phrases for things, verb phrases for actions. Say the direction explicitly: "Price, lowest first", not "Price". Say the unit: "Discount, largest first", not "Discount".

## Prices and currency

Always through `Intl.NumberFormat` with the offer's own currency. The symbol's position, the decimal separator, the thousands separator and the spacing are the locale's business, not the layout's.

```
€29.99   $29.99   £29.99   29,99 €   499 Kč   CZK 499
```

A converted figure is always labelled as converted, and the store's native price stays visible.

## Dates and times

Relative up to seven days, absolute after. The absolute form is `21 Aug 2026` and, where a time matters, `21 Aug 2026, 15:12 CEST`. The exact timestamp is always reachable from the relative one.

## Errors

Structure: **what happened · what you are seeing instead · what you can do**.

> Steam did not respond at 15:12 CEST. These prices were last verified 3 hours ago. [Retry]

Differentiate the causes, because the recovery differs:

| Cause | Pattern | Example opening |
| --- | --- | --- |
| User input | Field `error` | "Enter an email address including the @." |
| Network | `InlineMessage danger` + retry | "LUDWISE could not reach the server." |
| Provider unavailable | `InlineMessage warning` scoped to the section | "Steam did not respond at 15:12 CEST." |
| Partial data | `InlineMessage warning` above the results | "Showing 2 of 3 stores." |
| Stale data | `FreshnessIndicator stale` in place | "Last checked 3 days ago" |
| Application failure | `InlineMessage danger` with the request id | "Something failed on our side. Quote request id {id} if you report this." |
| Permission | `InlineMessage info` with the sign-in action | "Sign in to see your price alerts." |

## Empty states

Three sentences at most, answering: what happened, why the space is empty, what to do next.

> **No price history yet**
> LUDWISE started observing this game on 4 August 2026. A chart appears once there are at least seven observations.

## Localisation

- Never concatenate a sentence from fragments; a translator needs the whole string.
- Never assume English word order, length or plural rules. Use `Intl.PluralRules`.
- Never bake a currency symbol into a label.
- Layouts must survive a 35% string expansion with no truncation of anything but game titles.
- RTL is not supported yet, but no layout may depend on a hard-coded left/right that logical properties could express.
