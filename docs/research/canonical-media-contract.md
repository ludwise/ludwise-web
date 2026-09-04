# State of the canonical media contract

Research for `ludwise/ludwise-web#62`. Sources are `ludwise/ludwise-backend`
issues and pull requests, and this repository's own code. Both repositories
were readable through `gh`. No file in either repository was changed.

## 1. State of `ludwise-backend#137`

`ludwise-backend#137` is the open umbrella issue for the backend canonical
media path. It lists five sub-issues in order: #138, #139, #140, #141, #142.

- #138, #139, #140, and #141 are closed.
- #142 is open. Its acceptance-criteria checklist is unchecked in the issue
  body.
- Backend pull request #147 closed #141 and merged on 2026-09-02. It added a
  `media` object to `GET /v1/games/:slug`.
- A comment on #137, dated 2026-09-03T16:29:16Z, reports evidence from #142.
  The comment states two things #142 did not prove:
  - Staging held zero assets from a source without display rights, so the
    fail-closed gate for prohibited or unknown rights had nothing to
    withhold.
  - The withholding path is covered by unit tests
    (`game-media.test.ts`), not by staging evidence.
- That comment was posted to #137, not to #142. #142's own comment count is
  zero.
- After that comment, staging had one operational failure. Backend PR #152
  raised the metadata ingestion budget. A firing at 17:00 UTC on
  2026-09-03 then hit the 900-second wall-time ceiling and lost one round
  of metadata enrichment. Backend PR #154 reverted the budget. No later
  event re-ran the media verification.
- Three follow-up issues remain open: #148 (a remote database verification
  command prints no query results), #149 (whether IGDB Data Dumps earn a
  bulk-ingestion path), and #151 (an identity match that can never succeed
  still reports success).
- As of this research, #137 and #142 are both open. Neither carries a
  comment or a commit after 2026-09-03T17:39:41Z (the merge of #154).

## 2. Media roles and field names

The public contract adds one field to the game-detail view:
`GameDetailView.media?: GameMediaView`. The field is optional so an older
backend deployment can omit it. When a backend carries the field, it always
sends the whole object.

`GameMediaView` holds four roles:

- `cover: MediaImageView | null`
- `hero: MediaImageView | null`
- `screenshots: readonly MediaImageView[]`
- `videos: readonly MediaVideoView[]`

Each `MediaImageView` carries `url`, `profile`, `sourceKind`, and
`provenance`. `profile` names what the image is for, from
`MEDIA_IMAGE_PROFILES`: `cover`, `hero`, `gallery`. `sourceKind` names what
the image actually is, from `MEDIA_IMAGE_KINDS`: `cover`, `hero`, `artwork`,
`screenshot`, `logo`.

`logo` is part of the vocabulary and fills no slot today. IGDB's game API
does not supply a per-game logo (`ludwise-backend#138`,
`ludwise-backend#139`).

Each `MediaVideoView` carries `url`, `embedUrl: string | null`,
`title: string | null`, and `provenance`. `embedUrl` is `null` when a source
publishes a video page but no embeddable player.

Source: `ludwise-backend` file `tests/contract/contract.ts`, lines
160-267. This repository vendors the identical types in
`src/lib/api/contract.ts`, lines 175-267 (confirmed byte-identical field
names and comments; landed through `ludwise-web#59`, merged).

## 3. Dimensions, ordering, and aspect ratio

The contract exposes no width, height, or aspect-ratio field on
`MediaImageView`. A client must infer them, for example by loading the
image, or must not depend on them at all.

Backend persistence does store image width and height
(`ludwise-backend#139`, evidence list item "stores image width/height"), but
`GameMediaImage`/`MediaImageView` does not carry those fields forward. See
`ludwise-backend` file `src/lib/application/media.ts`, lines 75-80, which
lists only `url`, `profile`, `sourceKind`, `provenance`.

Cover and hero selection is deterministic but not client-visible as an
order: hero prefers a source-declared hero image, then artwork, then a
cover image, in that fixed preference (`src/lib/application/media.ts`,
line 119, constant `HERO_KINDS`).

Screenshot and video list order is a documented tie-break, not a curated or
relevance order. Candidates sort by provider slug, then by the provider's
own asset or video identifier (`src/lib/application/media.ts`,
functions `compareBySource` and `compareVideosBySource`, lines 149-159).
The code comment states this exists "to make the same stored facts give the
same answer every time," not to express an editorial or chronological
order.

`ludwise-web#53` (open, blocked) already records the constraint this
implies: "Do not infer aspect ratio, media role, or ordering when the
backend contract already supplies the authoritative value/order."

## 4. How the contract expresses a rights denial

The contract has no explicit denial field, flag, or error for withheld
media. Rights enforcement happens before the projection runs, at the
persistence read.

`listGameAssets` and `listGameProviderVideos` require a source's
`asset_display` right to equal `allowed` before a row is readable
(`ludwise-backend` files `src/lib/persistence/enrichment.ts` and
`src/lib/persistence/metadata-enrichment.ts`, confirmed by code search).
A source whose right is `unknown` or denied contributes no row.

`projectGameMedia` documents this directly: "a source without
`asset_display` never reaches this function at all"
(`src/lib/application/media.ts`, lines 241-243).

The consequence for a client: withheld media and absent media produce the
same shape. `GameMediaView` states this itself: "The empty state is
deliberate and is the same shape every time: `cover` and `hero` are `null`,
and both lists are `[]`." A client cannot distinguish "this game has no
media" from "this game has media LUDWISE may not show" from the response
alone.

Today, Steam is the only configured source whose `asset_display` right is
`unknown` rather than `allowed` (`ludwise-backend#137` evidence comment,
`docs/providers/steam.md`). Steam holds zero assets in the current schema,
so this withholding path has not been exercised against real data (see
section 1).

## 5. Provenance and freshness fields

Every image and every video carries its own `provenance` object:
`{ providerSlug, providerName, observedAtMs }` (`MediaProvenanceView`,
`tests/contract/contract.ts`, lines 202-206).

This is a separate provenance model from `GameDetailView.metadataProvenance`,
which covers scalar fields. The contract comment states the reason
directly: "Media is not one of those fields. So it carries its own
attribution on the item instead." The comment also names a second reason:
some sources place an attribution obligation on showing their images, and a
renderer needs the provider name to meet it.

`observedAtMs` is the only freshness signal on a media item. The contract
exposes no separate staleness, expiry, or "last verified" field for media.

## 6. Has the contract been verified on staging, and against what data

Partially, as of the last recorded evidence (2026-09-03T16:29:16Z on
`ludwise-backend#137`).

What was verified, against the real deployed staging Worker (read through a
service binding to the `VisitorRead` entrypoint, because the route has no
public hostname):

- Aggregate staging counts: 647 games carried assets, 391 carried videos.
  5,214 assets total (646 cover, 3,771 screenshot, 797 artwork). 611
  videos, 607 with a title. Media completeness: 391 complete, 256 partial,
  12,783 empty.
- Three named games sampled by hand: `7-wonders-ii` (complete: cover,
  hero, 11 screenshots, 1 video), `chaos-theory` (partial: cover, 5
  screenshots, no videos), `0-day` (empty: `cover: null`, `hero: null`,
  `screenshots: []`, `videos: []`, HTTP 200).
- Confirmed: absent slots are `null`/`[]`, never `undefined`; the 12
  screenshot and 6 video bounds hold against a game that exceeds both;
  the hero preference chain falls back correctly; every video carries a
  working watch URL and a `youtube-nocookie` embed URL; no IGDB
  identifier, size token, or row ID appears in any field; two consecutive
  reads answered identically; resolved image URLs returned
  `200 image/jpeg`.

What was not verified against real data:

- The rights-denial path (section 4), because the only rights-denied
  source in staging holds no media to withhold.

No newer evidence exists. The most recent related backend change is PR
#154 (merged 2026-09-03T17:39:41Z), which reverted an ingestion budget
after a staging firing failed. It did not touch media verification.

## 7. This repository's own state

`ludwise-web#59` (merged) already vendors the contract from backend PR
#147 into `src/lib/api/contract.ts`, confirmed identical field-for-field
(`MEDIA_IMAGE_PROFILES`, `MEDIA_IMAGE_KINDS`, `MediaProvenanceView`,
`MediaImageView`, `MediaVideoView`, `GameMediaView`,
`GameDetailView.media?`).

No page renders `media` yet. A search of `src/pages/games/[slug].astro`
finds no reference to the `media` field. `ludwise-web#53` (open, MVP
blocker) owns rendering it and is blocked on `ludwise-backend#137`.

## Unknowns

- Whether `ludwise-backend#142` will close on staging evidence alone, or
  will require exercising the rights-denial path against real data.
- Whether production carries any IGDB rows or media. The #137 evidence
  comment states production held neither credential nor IGDB rows as of
  2026-09-03, and nothing in that work deployed to it. No later source
  confirms or updates this.
- Whether the two open observability follow-ups (#148, #151) affect
  confidence in future staging or production media verification runs.
