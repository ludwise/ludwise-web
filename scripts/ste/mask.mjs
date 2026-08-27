/**
 * Span level exemptions.
 *
 * A masked span keeps its length, so every offset after it stays true and a
 * diagnostic can still name a column. One masked run counts as one word, which
 * is why a long path never breaks a word limit. The block level exemptions in
 * the same policy are implemented in extract.mjs.
 */

export const MASK_CHAR = '\u{E000}';

export const IMPLEMENTED_EXEMPTION_IDS = [
  'front-matter',
  'code-fence',
  'html-comment',
  'inline-code',
  'link-destination',
  'url',
  'path-like',
  'identifier',
  'official-name',
  'jsdoc-tag',
  'conventional-commit-prefix',
];

const FILE_EXTENSION =
  /^[\w@.-]+\.(?:md|json|jsonc|ts|tsx|js|mjs|cjs|astro|css|html|htm|yml|yaml|sql|toml|lock|sh|txt|svg|png|jpg|webp|env|vars|example|bru|sql)$/i;

const IDENTIFIER_SHAPES = [
  /^[a-z][a-z0-9]*(?:[A-Z][a-zA-Z0-9]*)+$/,
  /^[A-Z][a-z0-9]+(?:[A-Z][a-zA-Z0-9]*)+$/,
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/,
  /^[a-z0-9]+(?:_[a-z0-9]+)+$/,
  /^[\w.$]+\(\)$/,
];

const INLINE_CODE = /(`+)([^\n`]{0,100})\1/g;

const TEXT_PATTERNS = [
  /\]\([^)\n]*\)/g,
  /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
  /(?:https?:\/\/|mailto:|ftp:\/\/)[^\s<>()[\]"'`]+/gi,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
  /@[a-zA-Z][a-zA-Z0-9]*/g,
];

const COMMIT_PREFIX = /^[a-z]+(?:\([^)\n]*\))?!?:\s/;

const LEADING_PUNCTUATION = /^[([{"'“‘*_]+/;
const TRAILING_PUNCTUATION = /[)\]}"'”’.,;:!?*_]+$/;

const maskRange = (characters, start, end) => {
  for (let index = start; index < end && index < characters.length; index += 1) {
    characters[index] = MASK_CHAR;
  }
};

const isFree = (characters, start, end) => {
  for (let index = start; index < end; index += 1) {
    if (characters[index] === MASK_CHAR) return false;
  }
  return true;
};

const maskPattern = (characters, text, pattern) => {
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    if (isFree(characters, match.index, match.index + match[0].length)) {
      maskRange(characters, match.index, match.index + match[0].length);
    }
    match = pattern.exec(text);
  }
};

const INLINE_CODE_TOKENS = 6;

const maskInlineCode = (characters, text) => {
  INLINE_CODE.lastIndex = 0;
  let match = INLINE_CODE.exec(text);

  while (match !== null) {
    const words = match[2]
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0);
    if (
      words.length <= INLINE_CODE_TOKENS &&
      isFree(characters, match.index, match.index + match[0].length)
    ) {
      maskRange(characters, match.index, match.index + match[0].length);
    }
    match = INLINE_CODE.exec(text);
  }
};

const maskPhrases = (characters, text, phrases) => {
  const ordered = [...phrases].sort((left, right) => right.length - left.length);
  for (const phrase of ordered) {
    if (phrase.length === 0) continue;
    let from = text.indexOf(phrase);
    while (from !== -1) {
      if (isFree(characters, from, from + phrase.length)) {
        maskRange(characters, from, from + phrase.length);
      }
      from = text.indexOf(phrase, from + 1);
    }
  }
};

/**
 * A slash alone does not make a path.
 *
 * The exemption is "file path and file name". English writes alternatives with
 * a slash too, and `read/write` or `catalogue/ingestion` are prose that the
 * word rules must see. Treating every slash as a path hid a prohibited synonym
 * from the term rule. A path therefore has to look like one. It carries a file
 * extension, a dot segment, a root, a drive, or three or more segments.
 *
 * A module specifier is exempt for the same reason a path is. `vitest/config`
 * and `@astrojs/cloudflare` are names that a reader types, not two words that
 * a slash joins.
 */
const SCOPED_PACKAGE = /^@[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*$/i;

const BARE_MODULE_ROOTS = ['astro', 'vitest', 'node'];

const isModuleSpecifier = (token) => {
  if (SCOPED_PACKAGE.test(token)) return true;
  const [root, ...rest] = token.split('/');
  return rest.length === 1 && BARE_MODULE_ROOTS.includes(root.toLowerCase());
};

const PATH_SHAPES = [/^[~.]{0,2}\//, /^[A-Za-z]:[\\/]/, /^[^/\\]+[\\/][^/\\]+[\\/]/, /\/$/];

const isPathLike = (token) => {
  if (token.includes('\\')) return true;
  if (!token.includes('/')) return false;
  if (isModuleSpecifier(token)) return true;
  if (PATH_SHAPES.some((shape) => shape.test(token))) return true;
  return token.split('/').some((segment) => FILE_EXTENSION.test(segment));
};

const isExemptToken = (token) =>
  isPathLike(token) ||
  FILE_EXTENSION.test(token) ||
  IDENTIFIER_SHAPES.some((shape) => shape.test(token));

const CALL_SHAPE = /^[\w.$]+\(\)/;

const coreOf = (raw) => {
  const lead = LEADING_PUNCTUATION.exec(raw)?.[0].length ?? 0;
  const rest = raw.slice(lead);
  const call = CALL_SHAPE.exec(rest);
  return { lead, core: call === null ? rest.replace(TRAILING_PUNCTUATION, '') : call[0] };
};

const maskTokens = (characters) => {
  const scan = characters.map((one) => (one === MASK_CHAR ? ' ' : one)).join('');
  const pattern = /\S+/g;
  let match = pattern.exec(scan);

  while (match !== null) {
    const { lead, core } = coreOf(match[0]);
    const start = match.index + lead;

    if (core.length > 0 && isExemptToken(core) && isFree(characters, start, start + core.length)) {
      maskRange(characters, start, start + core.length);
    }
    match = pattern.exec(scan);
  }
};

export const maskSpans = (text, options = {}) => {
  const characters = text.split('');

  if (options.commitPrefix === true) {
    const prefix = COMMIT_PREFIX.exec(text);
    if (prefix !== null) maskRange(characters, 0, prefix[0].length);
  }

  maskInlineCode(characters, text);
  for (const pattern of TEXT_PATTERNS) maskPattern(characters, text, pattern);
  maskPhrases(characters, text, options.officialNames ?? []);
  if (options.tokens !== false) maskTokens(characters);

  return characters.join('');
};
