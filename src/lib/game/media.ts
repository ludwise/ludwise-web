/**
 * What the game page renders from the canonical media contract.
 *
 * The page holds the markup, as it does for the offer groups. This module
 * holds every decision: which slot a picture fills, which address serves it,
 * which picture loads first, and what each section heading says. Vitest cannot
 * render an `.astro` file, so a decision left in the template has no test.
 *
 * No provider vocabulary is read here. A picture arrives as a public address
 * and a LUDWISE kind, and it leaves as a same-origin address.
 * `tests/unit/game/media.test.ts` states the rules.
 */

import type { GameMediaView, MediaImageView, MediaVideoView } from '../api/contract.js';
import { MEDIA_PATH_PREFIX } from '../media/target.js';

/** One picture in its frame. The frame's ratio is the page's, never the image's. */
export interface MediaPicture {
  /**
   * A LUDWISE address, or `null` when the route's path cannot carry this one.
   * A frame with no address renders the placeholder, as a picture that fails
   * to load does. No provider host reaches the markup either way.
   */
  readonly src: string | null;
  /** The one picture above the fold. Every other picture stays lazy. */
  readonly eager: boolean;
}

/**
 * The screenshots, below a heading that states how many there are.
 *
 * The heading is the text alternative for the set, because the contract
 * describes no picture and the client invents no description. So every
 * screenshot the contract supplies keeps a frame, and the count equals them.
 */
export interface MediaGallery {
  readonly heading: string;
  readonly pictures: readonly MediaPicture[];
}

/** One outbound link to a video. The page renders no player. */
export interface MediaVideoLink {
  readonly href: string;
  readonly label: string;
}

export interface MediaVideoList {
  readonly heading: string;
  readonly links: readonly MediaVideoLink[];
}

/**
 * Each slot the game page can fill. `null` means the page omits the section.
 *
 * There is no band slot. The contract gives one address for each picture, and
 * the band painted a picture of 1920 pixels into a width below 400. Issue
 * ludwise-web#121 adds the band again, after ludwise-backend#214 publishes the
 * widths the provider holds.
 */
export interface GameMediaPresentation {
  /** A portrait picture in the identity block, at `--aspect-cover`. */
  readonly cover: MediaPicture | null;
  readonly gallery: MediaGallery | null;
  readonly videos: MediaVideoList | null;
}

/**
 * The same picture, served from the LUDWISE origin.
 *
 * A test of what the route's path can express, and never a second opinion on
 * what may be fetched. `src/lib/media/target.ts` holds that decision alone.
 * The path carries an https host and a path, so `null` is the answer for
 * everything else. `tests/unit/game/media.test.ts` names each case.
 */
export function mediaRouteAddress(upstreamUrl: string): string | null {
  let address: URL;
  try {
    address = new URL(upstreamUrl);
  } catch {
    return null;
  }

  if (address.protocol !== 'https:') return null;
  if (address.username !== '' || address.password !== '') return null;
  if (address.port !== '' || address.search !== '' || address.hash !== '') return null;

  const path = address.pathname.replace(/^\/+/u, '');
  if (path === '') return null;
  return `${MEDIA_PATH_PREFIX}${address.hostname}/${path}`;
}

export function mediaForRendering(media: GameMediaView | undefined): GameMediaPresentation {
  const gallery = (media?.screenshots ?? []).map((screenshot) => frame(screenshot, false));
  const links = videoLinks(media?.videos ?? []);

  return {
    cover: slot(coverImage(media), true),
    gallery:
      gallery.length === 0
        ? null
        : { heading: countHeading(gallery.length, 'screenshot'), pictures: gallery },
    videos: links.length === 0 ? null : { heading: countHeading(links.length, 'video'), links },
  };
}

/**
 * The cover slot, or the hero when the backend promoted a cover into it.
 *
 * The cover slot wins where both are present, because a promoted cover is the
 * same picture at a second image profile.
 */
function coverImage(media: GameMediaView | undefined): MediaImageView | null {
  const hero = media?.hero ?? null;
  const promoted = hero !== null && hero.sourceKind === 'cover' ? hero : null;
  return media?.cover ?? promoted;
}

function frame(image: MediaImageView, eager: boolean): MediaPicture {
  return { src: mediaRouteAddress(image.url), eager };
}

/** `null` where the contract supplies no picture for the slot at all. */
function slot(image: MediaImageView | null, eager: boolean): MediaPicture | null {
  return image === null ? null : frame(image, eager);
}

/** The count and its noun, in the singular or the plural. */
function countHeading(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Every video the contract lists, in the order it lists them.
 *
 * `embedUrl` is never read, because the MVP renders no player. The label is
 * the name the source gave the video, and it never names the video host.
 */
function videoLinks(videos: readonly MediaVideoView[]): readonly MediaVideoLink[] {
  const untitled = videos.filter((item) => item.title === null).length;
  return videos.map((item, index) => ({
    href: item.url,
    label: item.title ?? videoLabel(index, untitled),
  }));
}

/** A video the source named nothing. Numbered only where a number tells them apart. */
function videoLabel(index: number, untitled: number): string {
  return untitled > 1 ? `Video ${String(index + 1)}` : 'Video';
}
