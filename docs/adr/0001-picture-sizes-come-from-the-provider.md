---
ste-prose: descriptive
---

# Picture sizes come from the provider, not from an edge transformation

The game page failed the Lighthouse gate on a telephone, because the hero band
picture was 1920 pixels wide and the page painted it into 378 CSS pixels. A
browser chooses a smaller picture with a `srcset`, and a `srcset` needs more
than one address. The media contract gave one.

Two answers were possible. Cloudflare can resize each picture as the media
route fetches it. The provider already publishes the same picture at several
widths, at no cost, and the backend already chooses one of them.

We chose the provider's widths. The contract carries them as variants, and the
page writes them into a `srcset` unchanged.

## Why not the edge transformation

Cloudflare bills one unique transformation for each picture at each parameter
set each month. The first 5,000 each month cost nothing, and each further
thousand costs $0.50. Staging held 21,367 games when this was decided, and the
catalog is meant to grow faster. A crawler that indexes every game page asks
for the eager pictures of every game, so a full monthly sweep is the number to
plan for.

That is about $19 each month for the hero band alone, and about $190 each month
for every picture at three widths. Both numbers rise with every game added.

The provider's widths cost nothing at any catalog size. The catalog is the
product, so a recurring charge proportional to it is the wrong shape.

## Consequences

The variants arrive over the contract, so the web repository cannot answer this
alone. `ludwise-backend#214` publishes them, and the hero band waits for it.
The rest of the media on the game page does not.

The media route is unchanged. It serves an address, and it does not resize.
