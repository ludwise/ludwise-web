import js from '@eslint/js';
import globals from 'globals';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';
import ludwise from './eslint-rules/max-comment-block-lines.js';

// --- Layering ---------------------------------------------------------------
//
// Every zone below is a `no-restricted-imports` configuration on a `files` scope.
// Flat configuration does NOT merge a rule's options across objects: the last matching
// object wins outright. A zone switches off whatever a broader one installed unless it repeats
// it. That is why the platform group is a shared constant spread into each zone rather than
// retyped. It is also why tests/architecture/boundaries.test.ts asserts the platform ban
// independently of this file.
//
// This repository's layering is much simpler than the backend's, and
// deliberately so: there is no domain, no persistence and no provider layer
// here. This is because those are the things the split moved out. What is left is a
// contract, a client, some presentation, and the rule that keeps them apart.

const platformNeutral = {
  group: ['astro:*', 'cloudflare:*', '@astrojs/*'],
  message:
    'src/lib/ must stay framework- and platform-neutral. Code that needs astro:* or cloudflare:* ' +
    'belongs in src/middleware.ts or src/pages/**, which are the only places permitted to import ' +
    'them; pass what it produces in as an argument, the way loadConfig(source) and ' +
    'createApiClient({ fetch }) already do.',
};

// The one restriction helper. There is no directory-zone list here as there is
// in the backend. That absence is the split working: the layers a zone list
// would separate - domain, persistence, providers - are exactly what moved to
// the private repository. The rules that remain are scoped by `files`. The reason is that they
// constrain which *files* may import a thing, not which directories may import each other.
const restrictImports = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.wrangler/**',
      'coverage/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'worker-configuration.d.ts',
      // The vendored design-system handoff. Reference material, not source.
      // Its component examples are inline-styled React written for the design
      // tooling. Linting them would report on code that is never built.
      'design/**',
      // Recorded backend responses. Data, not source.
      'tests/fixtures/corpus/**',
    ],
  },

  js.configs.recommended,

  // Comment length is a readability finding, not a style preference: see
  // AGENTS.md.
  {
    files: ['src/**/*.{ts,tsx,astro}', 'tests/**/*.{ts,tsx}', 'scripts/**/*.{mjs,js,ts}'],
    plugins: { ludwise },
    rules: { 'ludwise/max-comment-block-lines': ['error', { max: 3, maxBlock: 15 }] },
  },

  // Type-aware linting is scoped to src/ rather than applied globally and then
  // switched off again. Root configuration files and scripts sit outside the tsconfig
  // project. A global type-checked configuration would fail on them for want of
  // type information before any override could take effect.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Tests get the same correctness rules without type information: they are
  // outside the build tsconfig, and type-aware rules add little over the
  // assertions themselves.
  {
    files: ['tests/**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Root configuration files and scripts are evaluated by Node, not by workerd. They
  // are also outside the tsconfig project, so they get Node globals, the
  // TypeScript parser where they are written in it, and no type-aware rules.
  //
  // `scripts/**/*.ts` is here rather than in the src/ block above for a
  // specific reason. Those files are run with `node --experimental-strip-types`
  // and are not part of the build. Linting them with the type-aware configuration
  // fails at parse time for want of a tsconfig project that includes them.
  {
    files: ['*.config.{js,mjs,ts}', 'scripts/**/*.{mjs,ts}'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: { 'no-console': 'off' },
  },

  // TypeScript resolves identifiers far more accurately than no-undef can, and
  // the core rule reports false positives for types and ambient declarations.
  {
    files: ['**/*.{ts,tsx,astro}'],
    rules: { 'no-undef': 'off' },
  },

  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],

  {
    files: ['**/*.{js,mjs,ts,tsx,astro}'],
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // The TypeScript-aware unused-vars rule understands type-only imports and
  // parameter properties, which the core rule reports as false positives.
  {
    files: ['**/*.{ts,tsx,astro}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // --- The architectural boundary -------------------------------------------
  // Nothing in src/lib/ may depend on Astro or Cloudflare module namespaces.
  //
  // This buys three things at once:
  //   1. src/lib/ unit-tests in plain Vitest with no workerd and no Astro
  //      configuration load, because there are no virtual modules to resolve.
  //   2. The API client takes its `fetch` as an argument. That argument lets a
  //      test drive it without a network. It also lets production hand it a
  //      service binding.
  //   3. Platform portability stays cheap rather than becoming a rewrite.
  //
  // Stated only in prose this decays within a month, so it is a lint error.
  {
    files: ['src/lib/**/*.{ts,tsx,js,mjs,cjs,jsx}'],
    rules: {
      ...restrictImports(platformNeutral),
      // console is the logging module's transport. Anywhere else it is a bug:
      // unstructured, unredacted, and invisible to Workers Logs queries.
      'no-console': 'error',
    },
  },
  {
    files: ['src/lib/logging/**/*.{ts,js,mjs}'],
    rules: { 'no-console': 'off' },
  },

  // --- The API boundary -----------------------------------------------------
  //
  // The contract is the innermost thing here. It states the wire shapes and is
  // authoritative about them (architecture decision record (ADR) 0025). So it must not depend on the client
  // that happens to use them - the backend vendors this one file and nothing
  // else. An import would drag the whole tree along with it.
  {
    files: ['src/lib/api/contract.ts'],
    rules: {
      ...restrictImports(platformNeutral, {
        group: ['../**', './*', '@/**'],
        message:
          'src/lib/api/contract.ts imports nothing. It is the authoritative statement of the wire ' +
          'shape and is vendored verbatim into the backend to prove conformance (ADR 0025); an ' +
          'import here would mean vendoring the tree it reaches.',
      }),
    },
  },

  // Presentation may not reach the transport directly. `locals.backend()` is
  // the only route, which is what keeps the operation allowlist meaningful:
  // a page constructing its own client could name any path.
  {
    files: [
      'src/pages/**/*.{ts,tsx,astro,js,mjs,cjs,jsx}',
      'src/components/**/*.{ts,tsx,astro,js,mjs,cjs,jsx}',
      'src/layouts/**/*.{ts,tsx,astro,js,mjs,cjs,jsx}',
    ],
    rules: {
      ...restrictImports({
        group: ['**/api/client', '**/api/client.js', '@/lib/api/client', '@/lib/api/client.js'],
        message:
          'A route, component or layout reaches the backend through locals.backend(), which ' +
          'middleware installs with the correct transport, timeout and correlation identifiers ' +
          'for this request. Constructing a client here would bypass all three. Importing types ' +
          'from src/lib/api/contract.js is fine and expected.',
      }),
    },
  },
);
