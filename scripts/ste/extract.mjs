/**
 * Which parts of a file are prose at all.
 *
 * Front matter, a fenced block and an HTML comment are block level exemptions,
 * so they never reach a rule. An ordered list item is a step, which is how the
 * checker separates a procedure from a description without a guess about mood.
 * A unit carries a map from each character to its offset in the source. A
 * diagnostic can name a line and a column, even for joined text.
 */

import ts from 'typescript';

const DIRECTIVE =
  /^\s*(eslint[\s-]|@?ts-[a-z]|prettier-ignore|globals?\s+[\w$]+\s*:|istanbul\s+ignore|[cv]8\s+ignore|dprint-ignore|biome-ignore)/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;
const TABLE_DELIMITER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;
const BLOCKQUOTE = /^\s{0,3}>\s?/;

const PROSE_KINDS = ['procedural', 'descriptive'];
const FRONT_MATTER_PROSE = /^\s*ste-prose\s*:\s*["']?([a-z]+)["']?\s*$/;
const SECTION_PROSE = /<!--\s*ste-prose\s*:\s*([a-z]+)\s*-->/;

const asProseKind = (value) => (PROSE_KINDS.includes(value) ? value : null);

const frontMatterRange = (lines) => {
  if (lines[0]?.trim() !== '---') return null;
  let close = 1;
  while (close < lines.length && lines[close].trim() !== '---') close += 1;
  return close < lines.length ? { open: 1, close } : null;
};

/**
 * The prose kind that a Markdown document declares for itself.
 *
 * Issue 9 separates a procedure from a description by function, not by layout,
 * so a numbered list cannot decide which sentence limit applies. The author
 * declares the kind instead, and enforcement fails closed without one.
 */
export const declaredProseKind = (source) => {
  const lines = source.split('\n');
  const range = frontMatterRange(lines);
  if (range === null) return null;

  for (let index = range.open; index < range.close; index += 1) {
    const found = FRONT_MATTER_PROSE.exec(lines[index]);
    if (found !== null) return asProseKind(found[1]);
  }
  return null;
};

const contiguous = (source, start, end) => ({
  text: source.slice(start, end),
  map: Array.from({ length: end - start }, (_, index) => start + index),
});

const joined = (pieces, separator = '\n') => {
  const parts = [];
  const map = [];

  for (const piece of pieces) {
    if (parts.length > 0) {
      parts.push(separator);
      for (let index = 0; index < separator.length; index += 1) map.push(piece.start);
    }
    parts.push(piece.text);
    for (let index = 0; index < piece.text.length; index += 1) map.push(piece.start + index);
  }

  return { text: parts.join(''), map };
};

const lineStarts = (source) => {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  return starts;
};

const unit = (kind, prose, body, start, declaredProse = null, reviewRequired = false) => ({
  kind,
  prose,
  declaredProse,
  text: body.text,
  map: body.map,
  start,
  reviewRequired,
});

const tableCells = (line, offset) => {
  const cells = [];
  let start = 0;
  let index = 0;

  const push = (from, to) => {
    const raw = line.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text.length > 0) {
      cells.push({ text, start: offset + from + lead });
    }
  };

  while (index < line.length) {
    if (line[index] === '|' && line[index - 1] !== '\\') {
      push(start, index);
      start = index + 1;
    }
    index += 1;
  }
  push(start, line.length);

  return cells;
};

export const extractMarkdown = (source) => {
  const starts = lineStarts(source);
  const lines = source.split('\n');
  const units = [];
  let index = 0;
  let sectionProse = null;
  let sectionDepth = 0;

  if (lines[0]?.trim() === '---') {
    let close = 1;
    while (close < lines.length && lines[close].trim() !== '---') close += 1;
    index = close + 1;
  }

  while (index < lines.length) {
    const line = lines[index];
    const offset = starts[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[1][0];
      index += 1;
      while (index < lines.length && !new RegExp(`^\\s{0,3}\\${marker}{3,}`).test(lines[index])) {
        index += 1;
      }
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('<!--')) {
      while (index < lines.length && !lines[index].includes('-->')) index += 1;
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const depth = heading[1].length;
      const declared = SECTION_PROSE.exec(line);
      if (declared !== null) {
        sectionProse = asProseKind(declared[1]);
        sectionDepth = depth;
      } else if (sectionProse !== null && depth <= sectionDepth) {
        sectionProse = null;
        sectionDepth = 0;
      }

      const from = offset + heading[0].length;
      const end = declared === null ? offset + line.length : offset + declared.index;
      units.push(
        unit(
          'heading',
          'descriptive',
          contiguous(source, from, Math.max(from, end)),
          from,
          sectionProse,
        ),
      );
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('|') && TABLE_DELIMITER.test(lines[index + 1] ?? '')) {
      while (index < lines.length && lines[index].trimStart().startsWith('|')) {
        if (!TABLE_DELIMITER.test(lines[index])) {
          for (const cell of tableCells(lines[index], starts[index])) {
            const from = cell.start;
            units.push(
              unit(
                'table-cell',
                'descriptive',
                contiguous(source, from, from + cell.text.length),
                from,
                sectionProse,
              ),
            );
          }
        }
        index += 1;
      }
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const pieces = [];
      while (index < lines.length && BLOCKQUOTE.test(lines[index])) {
        const strip = BLOCKQUOTE.exec(lines[index])[0].length;
        pieces.push({ text: lines[index].slice(strip), start: starts[index] + strip });
        index += 1;
      }
      units.push(unit('blockquote', 'descriptive', joined(pieces), pieces[0].start, sectionProse));
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item !== null) {
      const ordered = /\d/.test(item[2]);
      const indent = item[1].length;
      const pieces = [{ text: line.slice(item[0].length), start: offset + item[0].length }];
      index += 1;

      while (index < lines.length) {
        const next = lines[index];
        if (next.trim().length === 0 || LIST_ITEM.test(next)) break;
        if (next.length - next.trimStart().length <= indent) break;

        const nested = FENCE.exec(next);
        if (nested !== null) {
          const marker = nested[1][0];
          index += 1;
          while (index < lines.length && !new RegExp(`^\\s*\\${marker}{3,}`).test(lines[index])) {
            index += 1;
          }
          index += 1;
          continue;
        }

        const lead = next.length - next.trimStart().length;
        pieces.push({ text: next.slice(lead), start: starts[index] + lead });
        index += 1;
      }

      units.push(
        unit(
          'list-item',
          ordered ? 'procedural' : 'descriptive',
          joined(pieces),
          pieces[0].start,
          sectionProse,
        ),
      );
      continue;
    }

    const from = offset;
    let last = index;
    while (
      last + 1 < lines.length &&
      lines[last + 1].trim().length > 0 &&
      !FENCE.test(lines[last + 1]) &&
      !HEADING.test(lines[last + 1]) &&
      !LIST_ITEM.test(lines[last + 1]) &&
      !BLOCKQUOTE.test(lines[last + 1]) &&
      !lines[last + 1].trimStart().startsWith('<!--')
    ) {
      last += 1;
    }
    const to = starts[last] + lines[last].length;
    units.push(unit('paragraph', null, contiguous(source, from, to), from, sectionProse));
    index = last + 1;
  }

  return units;
};

const scriptKind = (path) => {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.ts')) return ts.ScriptKind.TS;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
};

const commentRanges = (text, path) => {
  const file = ts.createSourceFile(
    'input' + (path.endsWith('.tsx') ? '.tsx' : '.ts'),
    text,
    {
      languageVersion: ts.ScriptTarget.Latest,
      jsDocParsingMode: ts.JSDocParsingMode.ParseAll,
    },
    true,
    scriptKind(path),
  );

  const found = new Map();

  const visit = (node) => {
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) {
      found.set(range.pos, range);
    }
    for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) {
      found.set(range.pos, range);
    }
    for (const child of node.getChildren(file)) visit(child);
  };

  visit(file);
  for (const range of ts.getLeadingCommentRanges(text, file.endOfFileToken.pos) ?? []) {
    found.set(range.pos, range);
  }

  return [...found.values()].sort((left, right) => left.pos - right.pos);
};

const stripBlockComment = (raw, start) => {
  const pieces = [];
  const inner = raw.slice(raw.startsWith('/**') ? 3 : 2, raw.endsWith('*/') ? -2 : undefined);
  let offset = start + (raw.startsWith('/**') ? 3 : 2);

  for (const line of inner.split('\n')) {
    const cleaned = /^\s*\*\s?/.exec(line);
    const lead = cleaned === null ? line.length - line.trimStart().length : cleaned[0].length;
    const text = line.slice(lead);
    if (text.trim().length > 0) pieces.push({ text, start: offset + lead });
    offset += line.length + 1;
  }

  return pieces;
};

const astroFrontmatter = (source) => {
  if (!source.startsWith('---')) return null;
  const close = source.indexOf('\n---', 3);
  if (close === -1) return null;
  const open = source.indexOf('\n') + 1;
  return { text: source.slice(open, close + 1), offset: open };
};

/**
 * An Astro template comment, written as an expression that renders nothing.
 *
 * The frontmatter is JavaScript and the parser reads it. The template is not,
 * so its comments are found by shape instead.
 */
const ASTRO_TEMPLATE_COMMENT = /\{\s*\/\*([\s\S]*?)\*\/\s*\}/g;

export const commentCoverage = (source, path) => {
  if (!path.endsWith('.astro')) return 'full';
  ASTRO_TEMPLATE_COMMENT.lastIndex = 0;
  const hasTemplateComment = ASTRO_TEMPLATE_COMMENT.test(source);
  return astroFrontmatter(source) === null && !hasTemplateComment ? 'none' : 'full';
};

const astroTemplateComments = (source, from) => {
  const units = [];
  ASTRO_TEMPLATE_COMMENT.lastIndex = 0;
  let match = ASTRO_TEMPLATE_COMMENT.exec(source);

  while (match !== null) {
    if (match.index >= from && !DIRECTIVE.test(match[1])) {
      const open = source.indexOf('/*', match.index);
      const pieces = stripBlockComment(source.slice(open, open + match[1].length + 4), open);
      if (pieces.length > 0) units.push(unit('comment', 'mixed', joined(pieces), open));
    }
    match = ASTRO_TEMPLATE_COMMENT.exec(source);
  }

  return units;
};

export const extractComments = (source, path) => {
  let text = source;
  let base = 0;
  let templateFrom = 0;

  if (path.endsWith('.astro')) {
    const frontmatter = astroFrontmatter(source);
    if (frontmatter === null) return astroTemplateComments(source, 0);
    text = frontmatter.text;
    base = frontmatter.offset;
    templateFrom = frontmatter.offset + frontmatter.text.length;
  }

  const units = [];
  const starts = lineStarts(text);
  const lineOf = (offset) => {
    let line = 0;
    while (line + 1 < starts.length && starts[line + 1] <= offset) line += 1;
    return line;
  };

  let run = null;

  const flush = () => {
    if (run === null) return;
    units.push(unit('comment', 'mixed', joined(run.pieces), run.start));
    run = null;
  };

  for (const range of commentRanges(text, path)) {
    const raw = text.slice(range.pos, range.end);
    const body = raw.startsWith('//') ? raw.slice(2) : null;

    if (body !== null) {
      if (DIRECTIVE.test(body)) {
        flush();
        continue;
      }
      const line = lineOf(range.pos);
      if (run !== null && line !== run.lastLine + 1) flush();

      const lead = body.length - body.trimStart().length;
      const piece = { text: body.slice(lead), start: base + range.pos + 2 + lead };
      if (run === null) run = { start: base + range.pos, lastLine: line, pieces: [piece] };
      else {
        run.pieces.push(piece);
        run.lastLine = line;
      }
      continue;
    }

    flush();
    if (DIRECTIVE.test(raw.slice(2))) continue;

    const pieces = stripBlockComment(raw, range.pos).map((piece) => ({
      text: piece.text,
      start: base + piece.start,
    }));
    if (pieces.length === 0) continue;

    units.push(
      unit(
        raw.startsWith('/**') ? 'doc-comment' : 'comment',
        'mixed',
        joined(pieces),
        base + range.pos,
      ),
    );
  }

  flush();
  if (path.endsWith('.astro')) units.push(...astroTemplateComments(source, templateFrom));
  return units;
};

/**
 * Attributes that a person reads, rather than a machine.
 *
 * The list is short on purpose. An attribute that is not on it is treated as
 * machine syntax, so a class name or a route can never be measured as prose.
 */
const VISIBLE_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'content',
  'description',
  'label',
  'placeholder',
  'title',
]);

const OPAQUE_ELEMENTS = new Set(['script', 'style']);

const WORDS = /\p{L}{2,}(?:\s+\p{L}+)/u;
const SENTENCE_SHAPE = /^[\p{L}\p{N}\p{P}\p{Zs}]+$/u;

/**
 * Whether a value is a sentence a visitor could read.
 *
 * Two adjacent words are the default bar. Explicit visitor-facing contexts can
 * allow one word, such as a button label, but not a one-letter placeholder.
 */
const isVisitorText = (value, allowSingleWord = false) => {
  const text = value.trim();
  if (text.length === 0 || !SENTENCE_SHAPE.test(text)) return false;
  if (text.includes('/') || text.includes('\\')) return false;
  return allowSingleWord ? /\p{L}{2,}/u.test(text) : WORDS.test(text);
};

const stringUnit = (kind, text, start, reviewRequired = false) => {
  const map = Array.from({ length: text.length }, (_, index) => start + index);
  return unit(kind, 'mixed', { text, map }, start, null, reviewRequired);
};

const trimmedPiece = (piece) => {
  const lead = piece.text.length - piece.text.trimStart().length;
  return { text: piece.text.trim(), start: piece.start + lead };
};

const mappedStringUnit = (kind, pieces, reviewRequired = false, allowSingleWord = false) => {
  const trimmed = pieces.map(trimmedPiece).filter((piece) => piece.text.length > 0);
  if (trimmed.length === 0) return null;
  const body = joined(trimmed, ' ');
  return isVisitorText(body.text, allowSingleWord)
    ? unit(kind, 'mixed', body, trimmed[0].start, null, reviewRequired)
    : null;
};

/**
 * Collapse the expressions inside a run of template text.
 *
 * The literal words around an expression are still prose that a visitor reads,
 * so the run is kept and the expression is removed. Replacing it with a space
 * keeps two words from being joined into one.
 */
const templateText = (raw, start) => {
  const pieces = [];
  let index = 0;
  let depth = 0;
  let from = 0;
  let reviewRequired = false;

  while (index < raw.length) {
    if (raw[index] === '{') {
      reviewRequired = true;
      if (depth === 0) pieces.push({ text: raw.slice(from, index), start: start + from });
      depth += 1;
    } else if (raw[index] === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) from = index + 1;
    }
    index += 1;
  }
  if (depth === 0) pieces.push({ text: raw.slice(from), start: start + from });

  return { pieces: pieces.filter((piece) => piece.text.trim().length > 0), reviewRequired };
};

const astroTemplateStrings = (source) => {
  const frontmatter = astroFrontmatter(source);
  const base = frontmatter === null ? 0 : frontmatter.offset + frontmatter.text.length + 4;
  const template = source.slice(Math.min(base, source.length));
  const units = [];
  let index = 0;
  let text = '';
  let textStart = 0;

  const flushText = () => {
    const extracted =
      text.trim().length === 0
        ? { pieces: [], reviewRequired: false }
        : templateText(text, base + textStart);
    const pieces = extracted.pieces;
    if (pieces.length > 0) {
      const trimmed = pieces.map(trimmedPiece).filter((piece) => piece.text.length > 0);
      const body = joined(trimmed, ' ');
      if (trimmed.length > 0 && isVisitorText(body.text, true)) {
        units.push(
          unit('template-text', 'mixed', body, trimmed[0].start, null, extracted.reviewRequired),
        );
      }
    }
    text = '';
  };

  while (index < template.length) {
    if (template[index] !== '<') {
      if (text.length === 0) textStart = index;
      text += template[index];
      index += 1;
      continue;
    }

    flushText();

    if (template.startsWith('<!--', index)) {
      const close = template.indexOf('-->', index);
      index = close === -1 ? template.length : close + 3;
      continue;
    }

    const tag = /^<\/?\s*([a-zA-Z][\w.:-]*)/.exec(template.slice(index));
    const close = template.indexOf('>', index);
    if (tag === null || close === -1) {
      index += 1;
      continue;
    }

    const open = template.slice(index, close + 1);
    for (const found of matchesOfAttribute(open)) {
      if (!VISIBLE_ATTRIBUTES.has(found.name.toLowerCase())) continue;
      if (!isVisitorText(found.value, true)) continue;
      units.push(stringUnit('template-attribute', found.value.trim(), base + index + found.start));
    }

    index = close + 1;

    const name = tag[1].toLowerCase();
    if (!open.startsWith('</') && !open.endsWith('/>') && OPAQUE_ELEMENTS.has(name)) {
      const end = template.toLowerCase().indexOf(`</${name}`, index);
      index = end === -1 ? template.length : end;
    }
  }

  flushText();
  return units;
};

const ATTRIBUTE = /([a-zA-Z][\w:-]*)\s*=\s*(["'])(.*?)\2/g;

const matchesOfAttribute = (open) => {
  ATTRIBUTE.lastIndex = 0;
  const found = [];
  let match = ATTRIBUTE.exec(open);
  while (match !== null) {
    found.push({
      name: match[1],
      value: match[3],
      start: match.index + match[0].length - match[3].length - 1,
    });
    match = ATTRIBUTE.exec(open);
  }
  return found;
};

/**
 * Visitor strings that a module holds rather than a template.
 *
 * A string literal is read only where it is a sentence. The shapes are a named
 * constant, a table value, a visible JSX attribute, and JSX element text. A key,
 * a route or an identifier never passes the sentence test.
 */
const moduleStrings = (source, path, base = 0) => {
  const file = ts.createSourceFile(
    'input' + (path.endsWith('.tsx') || path.endsWith('.jsx') ? '.tsx' : '.ts'),
    source,
    { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
    true,
    scriptKind(path),
  );

  const units = [];
  const add = (kind, text, start, allowSingleWord = false) => {
    if (isVisitorText(text, allowSingleWord)) {
      units.push(stringUnit(kind, text.trim(), base + start));
    }
  };

  const addMapped = (kind, pieces, reviewRequired = false, allowSingleWord = false) => {
    const found = mappedStringUnit(
      kind,
      pieces.map((piece) => ({ ...piece, start: base + piece.start })),
      reviewRequired,
      allowSingleWord,
    );
    if (found !== null) units.push(found);
  };

  const templatePieces = (expression) => {
    const pieces = [];
    if (expression.head.text.length > 0) {
      pieces.push({ text: expression.head.text, start: expression.head.getStart(file) + 1 });
    }
    for (const span of expression.templateSpans) {
      if (span.literal.text.length > 0) {
        pieces.push({ text: span.literal.text, start: span.literal.getStart(file) + 1 });
      }
    }
    return { pieces, reviewRequired: true };
  };

  const jsxTextPieces = (node) => {
    const pieces = [];
    let reviewRequired = false;
    const collect = (child) => {
      if (ts.isJsxText(child)) {
        pieces.push({ text: child.getText(file), start: child.getStart(file) });
      } else if (ts.isJsxExpression(child)) {
        reviewRequired = true;
      } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
        for (const nested of child.children) collect(nested);
      }
    };
    for (const child of node.children) collect(child);
    return { pieces, reviewRequired };
  };

  const visit = (node, insideJsx = false) => {
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && !insideJsx) {
      const extracted = jsxTextPieces(node);
      addMapped('template-text', extracted.pieces, extracted.reviewRequired, true);
    } else if (ts.isJsxAttribute(node) && node.initializer !== undefined) {
      const name = node.name.getText(file).toLowerCase();
      if (VISIBLE_ATTRIBUTES.has(name) && ts.isStringLiteral(node.initializer)) {
        add('template-attribute', node.initializer.text, node.initializer.getStart(file) + 1, true);
      } else if (
        VISIBLE_ATTRIBUTES.has(name) &&
        ts.isNoSubstitutionTemplateLiteral(node.initializer)
      ) {
        addMapped('template-attribute', [
          { text: node.initializer.text, start: node.initializer.getStart(file) + 1 },
        ]);
      } else if (
        VISIBLE_ATTRIBUTES.has(name) &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression !== undefined
      ) {
        const expression = node.initializer.expression;
        if (ts.isTemplateExpression(expression)) {
          const extracted = templatePieces(expression);
          addMapped('template-attribute', extracted.pieces, extracted.reviewRequired, true);
        } else if (ts.isNoSubstitutionTemplateLiteral(expression)) {
          addMapped('template-attribute', [
            { text: expression.text, start: expression.getStart(file) + 1 },
          ]);
        }
      }
    } else if (ts.isStringLiteral(node) && !ts.isImportDeclaration(node.parent)) {
      const parent = node.parent;
      const named =
        ts.isVariableDeclaration(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isReturnStatement(parent) ||
        ts.isConditionalExpression(parent) ||
        ts.isArrayLiteralExpression(parent);
      if (named) add('string', node.text, node.getStart(file) + 1);
    } else if (
      (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) &&
      (ts.isVariableDeclaration(node.parent) ||
        ts.isPropertyAssignment(node.parent) ||
        ts.isReturnStatement(node.parent) ||
        ts.isConditionalExpression(node.parent) ||
        ts.isArrayLiteralExpression(node.parent))
    ) {
      if (ts.isNoSubstitutionTemplateLiteral(node)) {
        addMapped('string', [{ text: node.text, start: node.getStart(file) + 1 }]);
      } else {
        const extracted = templatePieces(node);
        addMapped('string', extracted.pieces, extracted.reviewRequired);
      }
    }
    for (const child of node.getChildren(file)) {
      visit(child, insideJsx || ts.isJsxElement(node) || ts.isJsxFragment(node));
    }
  };

  visit(file);
  return units;
};

const STRING_EXTENSIONS = ['.astro', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

export const stringCoverage = (path) =>
  STRING_EXTENSIONS.some((one) => path.endsWith(one)) ? 'full' : 'none';

export const extractStrings = (source, path) => {
  if (stringCoverage(path) === 'none') return [];

  if (path.endsWith('.astro')) {
    const frontmatter = astroFrontmatter(source);
    const inFrontmatter =
      frontmatter === null ? [] : moduleStrings(frontmatter.text, 'a.ts', frontmatter.offset);
    return [...inFrontmatter, ...astroTemplateStrings(source)].sort(
      (left, right) => left.start - right.start,
    );
  }

  return moduleStrings(source, path);
};
