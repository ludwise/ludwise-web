import { defineConfig } from 'vitest/config';

// Plain defineConfig, deliberately not getViteConfig from astro/config.
// getViteConfig loads astro.config.mjs, which registers the Cloudflare adapter
// and stands up a workerd development environment, plus runs the git subprocess in that
// file - seconds of startup and a class of CI flakiness, for tests that only
// call pure functions. Its one benefit is resolving astro:* virtual modules,
// which the src/lib boundary rule makes unnecessary.
//
// When .astro component rendering tests appear, add a second Vitest project
// scoped to those files rather than changing this one.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**'],
      // Set below the level currently achieved rather than at it. High enough
      // that deleting a test suite fails CI, loose enough that one uncovered
      // defensive branch does not block an unrelated pull request.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  define: {
    // Mirrors the Vite define in astro.config.mjs with recognisable sentinels.
    // Without these, build-info.ts falls back and the tests cannot distinguish
    // "injection works" from "fallback works".
    __BUILD_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_GIT_COMMIT__: JSON.stringify('testsha0000000000000000000000000000000'),
    __BUILD_ID__: JSON.stringify('test-run'),
  },
});
