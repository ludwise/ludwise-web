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

const joined = (pieces) => {
  const parts = [];
  const map = [];

  for (const piece of pieces) {
    if (parts.length > 0) {
      parts.push('\n');
      map.push(piece.start);
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

const unit = (kind, prose, body, start, declaredProse = null) => ({
  kind,
  prose,
  declaredProse,
  text: body.text,
  map: body.map,
  start,
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

export const commentCoverage = (source, path) => {
  if (!path.endsWith('.astro')) return 'full';
  return astroFrontmatter(source) === null ? 'none' : 'frontmatter-only';
};

export const extractComments = (source, path) => {
  let text = source;
  let base = 0;

  if (path.endsWith('.astro')) {
    const frontmatter = astroFrontmatter(source);
    if (frontmatter === null) return [];
    text = frontmatter.text;
    base = frontmatter.offset;
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
  return units;
};
