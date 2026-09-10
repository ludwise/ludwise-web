---
ste-prose: descriptive
---

# LUDWISE web

The public website. It shows a game, the pictures a provider published for it,
and the offers that name a price. This file is the glossary of that domain. It
holds no rule and no implementation detail.

## Language

### Pictures

**Media route**:
The LUDWISE address that serves a provider picture from the LUDWISE origin.
_Avoid_: image proxy, CDN, image server

**Upstream address**:
The provider address of one picture, which the media route names in its own
path.
_Avoid_: source URL, origin URL, remote URL

**Profile**:
What a picture is for. A purpose, and never a measurement.
_Avoid_: size, format, role

**Kind**:
What a picture actually is, whatever profile it fills.
_Avoid_: type, category, class

**Variant**:
The same picture at one pixel width that the provider publishes.
_Avoid_: size, rendition, derivative, thumbnail

**Hero band**:
The landscape picture above the identity block of a game page.
_Avoid_: banner, header image, key art

**Promoted cover**:
A cover that fills the hero profile, because the provider published no
landscape picture for that game.
_Avoid_: fallback hero, substitute hero

**Gallery**:
The screenshots of one game, below a heading that states how many there are.
_Avoid_: carousel, slider, lightbox
