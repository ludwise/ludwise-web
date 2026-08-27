import { describe, expect, it } from 'vitest';
import { MASK_CHAR } from '../../../../scripts/ste/mask.mjs';
import {
  countWords,
  parentheticalSentences,
  splitSentences,
} from '../../../../scripts/ste/segment.mjs';

const ABBREVIATIONS = ['e.g', 'i.e', 'etc', 'vs'];
const split = (text: string): string[] =>
  splitSentences(text, { abbreviations: ABBREVIATIONS }).map((one) => one.text.trim());

describe('splitSentences', () => {
  it('splits normal sentences', () =>
    expect(split('One thing. Another thing.')).toEqual(['One thing.', 'Another thing.']));
  it('splits when Markdown emphasis precedes the next sentence', () =>
    expect(split('The first state is clear. **The next state is safe.**')).toHaveLength(2));
  it('does not split a recorded abbreviation', () =>
    expect(split('Use a limit, e.g. twenty words, for a step.')).toHaveLength(1));
  it('does not split inside a masked span', () =>
    expect(split(`Open ${MASK_CHAR.repeat(11)} and stop.`)).toHaveLength(1));
  it('does not split inside parentheses', () =>
    expect(
      split('The value is absent (see the note.) and the explanation continues.'),
    ).toHaveLength(1));
  it('splits after a closing parenthesis', () =>
    expect(split('The value is absent (see the note.) The next line explains it.')).toHaveLength(
      2,
    ));
});

describe('countWords', () => {
  it('counts ordinary and hyphenated words', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('an end-to-end check')).toBe(3);
  });
  it('counts one masked run as one word', () =>
    expect(countWords(`open ${MASK_CHAR.repeat(40)} now`)).toBe(3));
  it('counts balanced parenthetical text once', () =>
    expect(countWords('Make sure that the switch is released (the legend is off).')).toBe(8));
  it('counts quoted text once', () =>
    expect(countWords('The label says "do not open this package".')).toBe(4));
  it('counts a number and supported unit once', () => {
    expect(countWords('The timeout is 120 ms.')).toBe(4);
    expect(countWords('The temperature is 20 °C.')).toBe(4);
  });
});

describe('parentheticalSentences', () => {
  it('returns prose inside parentheses separately', () =>
    expect(
      parentheticalSentences('The switch is released (the legend is off).', {
        abbreviations: ABBREVIATIONS,
      }).map((one) => one.text),
    ).toEqual(['the legend is off']));
  it('ignores a simple identifier', () =>
    expect(parentheticalSentences('Remove pin (10).', { abbreviations: ABBREVIATIONS })).toEqual(
      [],
    ));
});
