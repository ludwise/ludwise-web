# Image fixtures

Bytes for the image addresses that `tests/fixtures/corpus/` carries.
`scripts/fake-backend.ts` maps the path of a recorded address onto the file at
the same path here, and serves it. A development run and the deterministic
Lighthouse run then measure real image bytes without reaching a provider.

## The file path is the upstream path

A file here sits at the upstream path of the address it answers, with the host
removed. So `/igdb/image/upload/t_cover_big/demo-cover.jpg` is answered by
`igdb/image/upload/t_cover_big/demo-cover.jpg`.

The last segment alone is not enough. A promoted cover is one picture at two
image profiles, so `t_cover_big/demo-cover-only.jpg` and
`t_1080p/demo-cover-only.jpg` are two sizes of one artwork. Keyed by the last
segment they would share one file, and a measurement of image weight would read
one size twice.

## What these pictures are

Generated shapes and noise. They are not provider bytes. This repository is
public and holds no right to redistribute a provider's image, and a measurement
needs nothing from the picture except its size.

Each file is a baseline JPEG at the size the profile in the recorded address
implies.

| Profile             | Pixels    | Files                                     |
| ------------------- | --------- | ----------------------------------------- |
| `t_cover_big`       | 264x374   | `demo-cover.jpg`, `demo-cover-only.jpg`   |
| `t_1080p`           | 1920x1080 | `demo-artwork.jpg`, `demo-cover-only.jpg` |
| `t_screenshot_huge` | 1280x720  | `demo-shot-1.jpg`, `demo-shot-2.jpg`      |

The two `demo-cover-only.jpg` files hold one artwork at two sizes, because the
recording they answer puts the cover in the hero slot.

## Why they are committed

The development container holds no image tool. To generate them at test time
would add a dependency, and the measured byte count would move with it. The
bytes are committed instead, and `scripts/fake-backend.ts` fails at startup when
a recorded address has no file here.

## This directory is not the corpus

`tests/fixtures/corpus/` holds recordings of real backend responses, byte for
byte. Nothing here is a recording. Keep the two apart.
