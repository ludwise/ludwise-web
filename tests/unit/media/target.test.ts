/**
 * What the media route will and will not turn into an upstream address.
 *
 * This is the whole security boundary of the route, so the cases are named
 * individually rather than sampled. Two of them are the reason the boundary
 * exists at all. A suffix match admits `images.example.test.attacker.test`,
 * and an empty first segment turns a relative path into an absolute one on
 * another origin.
 */

import { describe, expect, it } from 'vitest';

import {
  isMediaPath,
  MEDIA_PATH_PREFIX,
  resolveUpstreamUrl,
} from '../../../src/lib/media/target.js';

const ALLOWED = ['images.example.test', 'cdn.example.test'];
const PATH = 'provider/image/upload/t_cover_big/demo-cover.jpg';

const resolve = (host: string, path: string, originOverride?: string): string | null =>
  resolveUpstreamUrl({ host, path }, { allowedHosts: ALLOWED, originOverride });

describe('resolveUpstreamUrl', () => {
  it('builds an https address for an allow-listed host', () => {
    expect(resolve('images.example.test', PATH)).toBe(`https://images.example.test/${PATH}`);
  });

  it('matches a host exactly, so a suffix cannot pass', () => {
    // The rule this whole function exists for. A suffix test admits any host
    // that somebody can register in a domain ending the right way.
    expect(resolve('images.example.test.attacker.test', PATH)).toBeNull();
    expect(resolve('notimages.example.test', PATH)).toBeNull();
    expect(resolve('example.test', PATH)).toBeNull();
  });

  it('compares a host without regard to case, because a hostname has none', () => {
    expect(resolve('Images.Example.Test', PATH)).toBe(`https://images.example.test/${PATH}`);
  });

  it('admits every host on the list rather than only the first', () => {
    expect(resolve('cdn.example.test', PATH)).toBe(`https://cdn.example.test/${PATH}`);
  });

  it('refuses a host that carries a port, a scheme or a path of its own', () => {
    for (const host of [
      'images.example.test:443',
      'https://images.example.test',
      'images.example.test/upload',
      'images.example.test.',
      '',
    ]) {
      expect(resolve(host, PATH), host).toBeNull();
    }
  });

  it('refuses an empty path, because there is no image to ask for', () => {
    expect(resolve('images.example.test', '')).toBeNull();
    expect(resolve('images.example.test', '/')).toBeNull();
  });

  it('refuses an empty segment, which is how a relative path becomes another origin', () => {
    // `//attacker.test/x` resolved against an origin is `https://attacker.test/x`.
    // The allow-list would have passed, and the fetch would leave the list.
    expect(resolve('images.example.test', '/attacker.test/x.jpg')).toBeNull();
    expect(resolve('images.example.test', 'a//b.jpg')).toBeNull();
  });

  it('refuses a traversal segment', () => {
    for (const path of ['../secret.jpg', 'a/../../b.jpg', 'a/./b.jpg', '..']) {
      expect(resolve('images.example.test', path), path).toBeNull();
    }
  });

  it('refuses a path carrying anything but unreserved characters and separators', () => {
    // A provider image path is letters, digits and a few punctuation marks.
    // Everything else is refused rather than escaped, so there is no encoding
    // round trip to get wrong.
    for (const path of [
      'a.jpg?x=1',
      'a.jpg#fragment',
      'a\\b.jpg',
      'a%2e%2e/b.jpg',
      'a b.jpg',
      'a@b.jpg',
      'a:b.jpg',
      'a\nb.jpg',
    ]) {
      expect(resolve('images.example.test', path), path).toBeNull();
    }
  });

  it('refuses a path longer than any real provider address', () => {
    expect(resolve('images.example.test', `${'a'.repeat(2048)}.jpg`)).toBeNull();
  });

  it('sends a development run at the override origin, and still reads the allow-list', () => {
    // The override replaces where the bytes come from. It never replaces the
    // decision about which host a caller may name.
    expect(resolve('images.example.test', PATH, 'http://localhost:8788')).toBe(
      `http://localhost:8788/${PATH}`,
    );
    expect(resolve('attacker.test', PATH, 'http://localhost:8788')).toBeNull();
  });

  it('drops a trailing slash on the override origin rather than doubling it', () => {
    expect(resolve('images.example.test', PATH, 'http://localhost:8788/')).toBe(
      `http://localhost:8788/${PATH}`,
    );
  });
});

describe('isMediaPath', () => {
  it('recognises the route this site serves images from', () => {
    expect(isMediaPath('/media/images.example.test/a.jpg')).toBe(true);
    expect(isMediaPath(MEDIA_PATH_PREFIX)).toBe(true);
  });

  it('recognises nothing else, including a path that merely starts with the word', () => {
    for (const pathname of ['/', '/games', '/mediaeval', '/media', '/x/media/a.jpg']) {
      expect(isMediaPath(pathname), pathname).toBe(false);
    }
  });
});
