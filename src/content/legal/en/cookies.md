---
ste-prose: descriptive
policyId: cookies
translationStatus: source
title: Cookie Policy
navLabel: Cookies
footer: true
order: 30
description: Cookies and browser storage used by the public LUDWISE service.
version: '1.1'
status: current
lastUpdated: 2026-09-15
effectiveDate: 2026-09-15
---

## About this policy

This policy describes cookies and browser storage used by the public LUDWISE MVP.

## Theme cookie

LUDWISE uses one first-party cookie named `theme` after you use the theme control.
The value is either `light` or `dark`.
The cookie lets LUDWISE render your selected theme on later pages.
It expires after one year and uses `SameSite=Lax`.
Production also marks it `Secure`.

The cookie carries no account identifier, advertising identifier, analytics identifier, or other profile data.

## Region cookie

LUDWISE uses one first-party cookie named `region` after you save a region with the region control.
The value is the identifier of the region you chose, for example `DE`.
The cookie lets LUDWISE show prices for your chosen region on later pages and later visits.
It expires after one year and uses `SameSite=Lax` and `HttpOnly`.
Production also marks it `Secure`.

If the saved region is no longer supported, LUDWISE removes the cookie.

The cookie carries no account identifier, advertising identifier, analytics identifier, or other profile data.

## No storage before a visitor choice

If you do not use the theme control, LUDWISE does not write the theme cookie.
The site can still follow your browser color-scheme preference for the current page without storing that choice.

If you do not save a region, LUDWISE does not write the region cookie.
The site can still choose a region for the current page from the country of the request, without storing that choice.

## Other browser storage

The MVP does not use `localStorage` or `sessionStorage`.
It does not set analytics, advertising, affiliate, or personalization cookies.

## Analytics and advertising

LUDWISE runs no product analytics at launch and uses no analytics cookie or tracking script.
LUDWISE also has no advertising at launch, so there is no advertising storage or consent control for advertising.

## Managing the cookies

You can remove the `theme` cookie and the `region` cookie with your browser controls.
If you remove the `theme` cookie, LUDWISE stops remembering your selected theme across pages and later visits.
If you remove the `region` cookie, LUDWISE chooses a region again from the country of each request.

## Changes to this policy

LUDWISE can update this policy when browser storage behavior changes.
The page shows its effective date and last update date.
