---
ste-prose: descriptive
---

# The IGDB attribution obligation, exactly

This file answers [issue #64](https://github.com/ludwise/ludwise-web/issues/64).
The question is: what do the published IGDB terms require the public site to
show, and where.

## Sources consulted

- IGDB API docs, Getting Started section. `https://api-docs.igdb.com/`. Retrieved 2026-09-05.
- IGDB API docs, Business related FAQ section. `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.
- IGDB API docs, License section. `https://api-docs.igdb.com/#license`. Retrieved 2026-09-05.
- Twitch Developer Services Agreement. `https://legal.twitch.com/legal/developer-agreement/`. The page states "Last modified on 12/04/2024". Retrieved 2026-09-05.
- Steam Web API Terms of Use. `https://steamcommunity.com/dev/apiterms`. The page states "Last updated July 2010". Retrieved 2026-09-05.
- Steam Web API documentation, "Valve Brand and Links" section. `https://steamcommunity.com/dev`. Retrieved 2026-09-05.

Two attempts did not reach a source. `https://www.igdb.com/api` returned an
HTTP 403 response from a bot-protection layer, on every retrieval attempt
today. No separate "IGDB Terms of Service" page exists apart from the API
docs quoted below. The IGDB API docs state that IGDB operates under the
Twitch Developer Services Agreement, so that agreement is a primary source
for this question too.

## What is the exact attribution obligation in the current published IGDB terms?

The IGDB API docs state the obligation in two adjacent FAQ answers.

> Yes, we offer commercial partnerships for users looking to integrate the
> API in monetized products. From our side, as part of the partnership, we
> ask for user facing attribution to IGDB.com from products integrating the
> IGDB API.

Source: IGDB API docs, Business related FAQ, question 1 ("I want to use the
API for a commercial project, is it allowed?"). `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.

> Not really. We expect fair attribution, i.e. attribution that is visible
> to your users and located in a static location (e.g. not in a change
> log).

Source: IGDB API docs, Business related FAQ, question 4 ("Regarding user
facing attribution (relating to the commercial partnership), any specific
guidelines?"). `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.

Reading: IGDB frames the attribution obligation as a term of a commercial
partnership, not as a blanket rule for every integration. The FAQ names the
target explicitly as "IGDB.com". A ludwise-web decision about a commercial
partnership status with IGDB governs whether this specific clause applies.

Unknown: the FAQ does not state whether a non-commercial integration under
the plain Twitch Developer Services Agreement carries the same attribution
duty. The Getting Started section, quoted in the next section, separates
"non-commercial usage" of the Twitch Developer Service Agreement from a
"commercial partnership" that requires a separate email exchange with IGDB.
Whether ludwise-web counts as commercial for this purpose is unknown here.

## What does "a static location" require in practice?

The same FAQ answer is the only place the terms define this phrase.

> We expect fair attribution, i.e. attribution that is visible to your
> users and located in a static location (e.g. not in a change log).

Source: IGDB API docs, Business related FAQ, question 4. `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.

Reading: the terms give one example of what does not count, a change log,
and two properties of what does count, visible to users and fixed in place.
A footer, an about page, or a credits page each plausibly satisfies a
static location reading, because each stays in one fixed place across
visits.

Unknown: the terms do not define "static" beyond the change-log contrast.
No minimum visual weight, position, or repetition interval appears in the
quoted text. A ludwise-web design choice, not a terms requirement, settles
placement inside that fixed point.

## Is a specific wording or a specific link target mandated?

> Not really. We expect fair attribution, i.e. attribution that is visible
> to your users and located in a static location (e.g. not in a change
> log).

Source: IGDB API docs, Business related FAQ, question 4. `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.

Reading: the FAQ answer opens with "Not really", directly denying a fixed
wording template or a mandated link target. The earlier FAQ answer names
"IGDB.com" as the entity to credit, so the attribution needs to identify
IGDB.com, without a required sentence or a required hyperlink destination.

The Twitch Developer Services Agreement adds a related but distinct clause
about the separate case of using Twitch's own marks.

> Use and display Twitch Marks in accordance with the Twitch Trademark
> Guidelines solely to attribute Twitch's offerings as the source of the
> Program Materials as set forth in this Agreement.

Source: Twitch Developer Services Agreement, Section II.B.2.ii. `https://legal.twitch.com/legal/developer-agreement/`. Retrieved 2026-09-05.

Reading: this clause governs the Twitch name, trademarks, and logos
specifically, defined in the agreement as "Twitch Marks". Whether an IGDB
logo or wordmark counts as a Twitch Mark for this clause is unknown here.

Unknown: no quoted text ties a specific approved logo file, a specific
sentence, or a specific target URL to the IGDB attribution obligation.

## Must the attribution appear on every page, or once in a persistent location?

No quoted text uses the word "page" for this obligation. Two separate
clauses bear on the question, and they read in tension with each other.

> We expect fair attribution, i.e. attribution that is visible to your
> users and located in a static location (e.g. not in a change log).

Source: IGDB API docs, Business related FAQ, question 4. `https://api-docs.igdb.com/#business-related-faq`. Retrieved 2026-09-05.

> You must ensure that there is a clear path to the source from displays of
> Program Materials in Your Services. Appropriately attribute uses of
> Program Materials or Twitch Content.

Source: Twitch Developer Services Agreement, Section VII ("Maintaining the
Integrity of Program Materials"), item C. `https://legal.twitch.com/legal/developer-agreement/`. Retrieved 2026-09-05.

Reading: the IGDB FAQ answer, read on its own, favors a single fixed
location, because it contrasts a static place with a change log rather than
with a per-page requirement. The Twitch clause instead ties a "clear path
to the source" to each "display" of Program Materials, which reads closer
to a per-instance duty.

Unknown: the quoted text does not settle whether one sitewide credit
satisfies both clauses together, or whether every page rendering IGDB data
needs its own path back to the source. This is the central open question
for issue #58 and #64, and the terms alone do not close it.

## Do the terms carry any further visitor-facing obligation beyond attribution?

> A. You must not commingle Program Materials, make modifications, or
> delete portions of Program Materials that reveal incomplete data sets;

> B. You must update Program Materials used in Your Services frequently to
> return complete and accurate information; and

> C. You must ensure that there is a clear path to the source from
> displays of Program Materials in Your Services. Appropriately attribute
> uses of Program Materials or Twitch Content.

Source: Twitch Developer Services Agreement, Section VII, items A through
C. `https://legal.twitch.com/legal/developer-agreement/`. Retrieved 2026-09-05.

> You will not remove, modify, or obscure any copyright, patent,
> trademark, or other proprietary or attribution notices on or in any
> Program Materials.

Source: Twitch Developer Services Agreement, Section II.B.3 ("Limitations"). `https://legal.twitch.com/legal/developer-agreement/`. Retrieved 2026-09-05.

Reading: beyond the attribution notice itself, the agreement asks for a
"clear path to the source", which reads as a link or a similar route back
to IGDB, separate from a bare credit line. It also asks for data freshness,
data completeness, and it forbids stripping any notice already present in
the data IGDB serves.

Unknown: the quoted clauses do not name a specific visitor-facing element,
such as a required disclaimer about pricing accuracy or a required consent
banner. Any such requirement would need a separate source, not found here.

## Does any other data source used by the MVP carry its own attribution duty?

Yes, for Steam. The Steam Web API Terms of Use state a comparable clause.

> You agree, and Valve grants you a license, to implement the Valve
> name(s), logo(s), and links to Valve (the "Valve Brand & Links") on any
> Web page incorporating the Steam Web API and/or Steam Data, in accordance
> with the Steam Web API documentation. You shall not tag links to Valve
> hereunder with a "nofollow" attribute or otherwise prevent or discourage
> search engines from following or scoring the link.

Source: Steam Web API Terms of Use, Section 3 ("License to Valve Brand &
Links"). `https://steamcommunity.com/dev/apiterms`. Retrieved 2026-09-05.

> You may not present the Steam Data (or permit the Steam Data to be
> presented) so that it appears (a) that your Application is endorsed or
> affiliated with Valve or Steam, or (b) to be available from a third
> party.

Source: Steam Web API Terms of Use, Section 2, list item. `https://steamcommunity.com/dev/apiterms`. Retrieved 2026-09-05.

The linked Steam Web API documentation page adds one concrete visual
requirement, but only for a specific feature.

> If you are using OpenID on your site, we request that you use one of the
> following buttons as your link to the Steam sign in page.

Source: Steam Web API documentation, "Valve Brand and Links" section. `https://steamcommunity.com/dev`. Retrieved 2026-09-05.

Reading: Valve's clause names "any Web page incorporating the Steam Web API
and/or Steam Data", a phrase that reads as a per-page duty, in contrast to
the IGDB FAQ's single static location. Valve also supplies specific button
images, but only for the OpenID sign-in flow, not for a general Steam Data
display. No general Steam-brand button or wording appears in the quoted
text for the general case.

Unknown: whether ludwise-web's current MVP integrates the Steam Web API at
all is not settled by this research. `design/system/readme.md` in this
repository states "Steam is the first provider", and `design/system/guidelines/tokens.md`
names a `--ludwise-store-*` token namespace listing `steam, gog, epic,
humble, fanatical, gmg, gamesplanet` as candidate providers, but neither
file is a terms document, and neither confirms a live integration.

For the remaining named providers, this research did not locate a public
storefront-data API with terms comparable to Steam's or IGDB's. A search
for GOG found only affiliate-program terms and an affiliate product feed
with a rate limit, not a general public API with an attribution clause. A
search for Epic Games found only Epic Online Services documentation, a
different product from a storefront price API, with no attribution clause
found for storefront data. Humble, Fanatical, and Green Man Gaming were not
searched individually in this pass.

Unknown: whether GOG, Epic, Humble, Fanatical, or Green Man Gaming (GMG)
carry their own attribution duty for storefront data is unknown from this
research. Mark each as unverified rather than assuming no duty exists.

## Open questions for the web repository

The exact wording of the credit text is a repository design choice, not a
terms requirement. The IGDB FAQ names only the entity, "IGDB.com", and
explicitly declines to mandate a sentence.

The exact placement, such as a global footer against a per-page credit
near each IGDB-sourced element, is not settled by the terms alone. Section
"Must the attribution appear on every page" above states the tension
directly: the IGDB FAQ favors a single static location, while the general
Twitch Developer Services Agreement clause favors a path to source at each
display. A resolution needs a decision from the repository, not a further
reading of the terms.

Whether ludwise-web's use of the IGDB API is commercial, and therefore
inside the specific attribution clause tied to a commercial partnership,
is a business-model question for the web repository team, not a terms
question.

Whether ludwise-web currently calls the Steam Web API, and therefore falls
inside the Valve Brand & Links clause, needs confirmation from the
codebase or from the team, not from this research.
