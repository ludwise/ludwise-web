---
name: humanizer
description: How to take the tells of machine-written prose out of a visitor-visible string before it is committed.
---

## When to use

Before committing any string a visitor can read, run this skill after the text
says what it must say. Use it for page copy, headings, empty states, error
messages, button labels, accessible names, page titles, and metadata.

## First, the fixed strings

`design/system/guidelines/content-style.md` fixes some strings exactly.
Reuse those strings verbatim. Do not humanize fixed historical, freshness,
affiliate, ad-label, or missing-data wording.

## The tells

- Replace internal vocabulary with words a visitor understands.
- Remove sales language and inflated claims.
- Remove padding and repeated hedging.
- Do not create groups of three only for rhythm.
- Prefer an active sentence when naming the actor makes the text clearer.

## The message shape

State what happened, why the visitor sees it, and what the visitor can do next.
Use that order when all three parts apply.

## Where this sits

This skill is one step of the `STE-DERIVED` pipeline in
`docs/language/user-facing-text.md`.
The order is meaning, ASD-STE100 baseline, `/humanizer`, and semantic safety
review. Never use this skill on `STE-STRICT` technical prose.

## What this skill must never change

Keep these facts unchanged:

- Meaning, technical facts, and product behavior.
- Numbers, prices, dates, and times.
- Permissions, security meaning, and privacy meaning.
- Billing, legal, and accessibility meaning.
- Destructive-action meaning and recovery instructions.

If humanization conflicts with clarity or safety, keep the clear baseline.

## What this skill does not do

It does not decide what LUDWISE claims.
A product-meaning change is a product decision, not a writing transformation.
