/**
 * Conventional Commits, enforced at commit time by .husky/commit-msg and again
 * in CI. See docs/development/commits.md for the rationale behind each type.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The type list is closed: an unknown type silently escapes release-please's
    // version calculation, so a typo would mean a change never triggers a release.
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
