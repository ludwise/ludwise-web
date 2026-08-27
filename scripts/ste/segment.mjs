/**
 * Sentence and word boundaries.
 *
 * Sentence length uses the word-count rules from ASD-STE100 Issue 9. The
 * segmenter keeps offsets stable so every diagnostic can point back to source.
 */

import { MASK_CHAR } from './mask.mjs';

const TERMINATORS = new Set(['.', '!', '?']);
const CLOSERS = new Set(['"', "'", '\u201d', '\u2019', ')', ']', '}', '*', '_']);
const CONTENT = /[\p{L}\p{N}]/u;

const hasContent = (text) => CONTENT.test(text) || text.includes(MASK_CHAR);

const startsSentence = (character) =>
  character === MASK_CHAR ||
  character === '`' ||
  character === '[' ||
  character === '*' ||
  character === '_' ||
  /[\p{Lu}\p{N}]/u.test(character);

const precedingWord = (text, index) => {
  let start = index;
  while (start > 0 && /[\w.]/.test(text[start - 1])) start -= 1;
  return text.slice(start, index);
};

const quoteStateAfter = (state, character) => {
  if (character === '"') return state === '"' ? null : state === null ? '"' : state;
  if (character === '\u201c') return state === null ? '\u201d' : state;
  if (character === '\u201d' && state === '\u201d') return null;
  return state;
};

export const splitSentences = (text, options = {}) => {
  const abbreviations = new Set((options.abbreviations ?? []).map((one) => one.toLowerCase()));
  const sentences = [];
  let start = 0;
  let parentheses = 0;
  let quote = null;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '(' && quote === null) {
      parentheses += 1;
      continue;
    }
    if (character === ')' && quote === null && parentheses > 0) {
      parentheses -= 1;
      continue;
    }

    quote = quoteStateAfter(quote, character);
    if (!TERMINATORS.has(character)) continue;

    const closesParenthetical = parentheses > 0 && text[index + 1] === ')';
    const closesQuote =
      quote !== null && (text[index + 1] === quote || (quote === '"' && text[index + 1] === '"'));

    if (parentheses > 0 && !closesParenthetical) continue;
    if (quote !== null && !closesQuote) continue;
    if (text[index + 1] === MASK_CHAR) continue;

    if (character === '.' && abbreviations.has(precedingWord(text, index).toLowerCase())) continue;

    let end = index + 1;
    while (end < text.length && CLOSERS.has(text[end])) end += 1;

    let after = end;
    while (after < text.length && /\s/.test(text[after])) after += 1;

    const atEnd = after >= text.length;
    if (!atEnd && (after === end || !startsSentence(text[after]))) continue;

    const slice = text.slice(start, end);
    if (hasContent(slice)) sentences.push({ text: slice, start, end });
    start = after;
  }

  const tail = text.slice(start);
  if (hasContent(tail)) sentences.push({ text: tail, start, end: text.length });

  return sentences;
};

const maskRange = (characters, start, end) => {
  for (let index = start; index < end && index < characters.length; index += 1) {
    characters[index] = MASK_CHAR;
  }
};

const collapseParentheses = (characters, text) => {
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') {
      stack.push(index);
      continue;
    }
    if (text[index] !== ')' || stack.length === 0) continue;
    const start = stack.pop();
    if (stack.length === 0) maskRange(characters, start, index + 1);
  }
};

const collapseQuotes = (characters, text) => {
  const pairs = [
    ['"', '"'],
    ['\u201c', '\u201d'],
  ];

  for (const [open, close] of pairs) {
    let start = -1;
    for (let index = 0; index < text.length; index += 1) {
      if (start === -1 && text[index] === open) {
        start = index;
        continue;
      }
      if (start !== -1 && text[index] === close) {
        maskRange(characters, start, index + 1);
        start = -1;
      }
    }
  }
};

const MEASUREMENT_UNIT =
  /^(?:%|°[CF]?|K|mm|cm|m|km|in|ft|yd|mi|µm|um|nm|mg|g|kg|oz|lb|ms|s|min|h|Hz|kHz|MHz|GHz|mV|V|kV|mA|A|kA|mW|W|kW|Pa|kPa|MPa|bar|psi|N|N·m|Nm|J|rpm|bps|kbps|Mbps|Gbps|B|KB|MB|GB|TB|KiB|MiB|GiB)$/i;
const NUMBER = /^[+-]?(?:\d+(?:[.,]\d+)?|\d+\/\d+)$/;

const coreToken = (token) => token.replace(/^[([{"'\u201c]+|[)\]}"'\u201d.,;:!?]+$/g, '');

export const countWords = (text) => {
  const characters = text.split('');
  collapseQuotes(characters, text);
  collapseParentheses(characters, text);

  const tokens = characters
    .join('')
    .split(/\s+/)
    .filter((token) => token.length > 0 && hasContent(token));

  let count = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = coreToken(tokens[index]);
    const next = coreToken(tokens[index + 1] ?? '');
    count += 1;
    if (NUMBER.test(token) && MEASUREMENT_UNIT.test(next)) index += 1;
  }
  return count;
};

export const parentheticalSentences = (text, options = {}) => {
  const found = [];
  const stack = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') {
      stack.push(index);
      continue;
    }
    if (text[index] !== ')' || stack.length === 0) continue;

    const open = stack.pop();
    if (stack.length !== 0) continue;

    const inner = text.slice(open + 1, index);
    if (!hasContent(inner) || !/\s/.test(inner.trim())) continue;

    for (const sentence of splitSentences(inner, options)) {
      found.push({
        text: sentence.text,
        start: open + 1 + sentence.start,
        end: open + 1 + sentence.end,
      });
    }
  }

  return found;
};
