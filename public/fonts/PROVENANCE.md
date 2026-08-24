# Vendored fonts

Do not edit by hand. Regenerate with `node scripts/vendor-fonts.mjs`.

Geist and Geist Mono, SIL Open Font Licence 1.1. Latin `woff2` subsets, taken
from the @fontsource packages rather than downloaded from Google Fonts, so the
exact bytes are reproducible from a version number.

| Source                   | Version | Weights       |
| ------------------------ | ------- | ------------- |
| `@fontsource/geist-sans` | 5.3.0   | 400, 500, 600 |
| `@fontsource/geist-mono` | 5.3.0   | 400           |

The `@font-face` rules that reference these files are in
`src/styles/tokens/fonts.css`.
