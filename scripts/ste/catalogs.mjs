const CATALOG_PATH = /^messages\/(?:[^/]+\/)*[^/]+\.json$/;
const COMPLEX_MESSAGE_KEYS = new Set(['declarations', 'selectors', 'match']);

export const isMessageCatalogFile = (path) => CATALOG_PATH.test(path);

const messageUnit = (text, map, start, reviewRequired = false) => ({
  kind: 'message-catalog',
  prose: 'mixed',
  declaredProse: null,
  text,
  map,
  start,
  reviewRequired,
});

const patternText = (value) => {
  let text = '';
  let reviewRequired = false;
  const keptIndexes = [];

  const add = (character, index) => {
    if (/^[.,!?;:]$/.test(character) && text.endsWith(' ')) {
      text = text.slice(0, -1);
      keptIndexes.pop();
    }
    text += character;
    keptIndexes.push(index);
  };

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\\' && (value[index + 1] === '{' || value[index + 1] === '}')) {
      index += 1;
      add(value[index], index);
      continue;
    }

    if (value[index] === '{') {
      const end = value.indexOf('}', index + 1);
      if (end !== -1) {
        reviewRequired = true;
        index = end;
        continue;
      }
    }

    add(value[index], index);
  }

  while (text.startsWith(' ')) {
    text = text.slice(1);
    keptIndexes.shift();
  }
  while (text.endsWith(' ')) {
    text = text.slice(0, -1);
    keptIndexes.pop();
  }

  return { text, keptIndexes, reviewRequired };
};

const jsonStringToken = (source, start, end) => {
  const value = [];
  const map = [];

  for (let index = start + 1; index < end; index += 1) {
    if (source[index] !== '\\') {
      value.push(source[index]);
      map.push(index);
      continue;
    }

    const escape = source[index + 1];
    if (escape === 'u') {
      value.push(String.fromCharCode(Number.parseInt(source.slice(index + 2, index + 6), 16)));
      map.push(index);
      index += 5;
      continue;
    }

    const decoded = JSON.parse('"' + source.slice(index, index + 2) + '"');
    value.push(decoded);
    for (let offset = 0; offset < decoded.length; offset += 1) map.push(index);
    index += 1;
  }

  return { value: value.join(''), map, start: start + 1, end: end + 1 };
};

const scanJsonStringTokens = (source) => {
  const tokens = [];
  let previousKey = null;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '"') continue;

    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index] === '"') break;
      index += 1;
    }
    if (index >= source.length)
      throw new Error('A message catalog contains an unterminated string.');

    const token = jsonStringToken(source, start, index);
    const next = source.slice(index + 1).search(/\S/u);
    const nextCharacter = next === -1 ? undefined : source[index + 1 + next];
    if (nextCharacter === ':') {
      previousKey = token.value;
      continue;
    }
    if (previousKey !== '$schema') tokens.push(token);
    previousKey = null;
  }

  return tokens;
};

const findStringToken = (tokens, value, from) => {
  const found = tokens.find((token) => token.start >= from && token.value === value);
  if (found === undefined) throw new Error('A message value could not be mapped to its source.');
  return found;
};

const assertStringArray = (value, field) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Unsupported Inlang message structure in ${field}.`);
  }
};

const assertComplexMessage = (variant) => {
  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
    throw new Error('Unsupported Inlang complex message variant.');
  }

  for (const key of Object.keys(variant)) {
    if (!COMPLEX_MESSAGE_KEYS.has(key)) {
      throw new Error(`Unsupported Inlang complex message field: ${key}.`);
    }
  }

  assertStringArray(variant.declarations ?? [], 'declarations');
  assertStringArray(variant.selectors ?? [], 'selectors');

  if (!variant.match || typeof variant.match !== 'object' || Array.isArray(variant.match)) {
    throw new Error('Unsupported Inlang message structure in match.');
  }
  if (Object.values(variant.match).some((value) => typeof value !== 'string')) {
    throw new Error('Unsupported Inlang message value in match.');
  }
};

export const extractMessageCatalogStrings = (source, path) => {
  if (!isMessageCatalogFile(path)) return [];

  const parsed = JSON.parse(source);
  const units = [];
  const tokens = scanJsonStringTokens(source);
  let searchFrom = 0;

  const addValue = (value) => {
    if (typeof value !== 'string') {
      throw new Error('Unsupported non-string Inlang message value.');
    }
    const located = findStringToken(tokens, value, searchFrom);
    searchFrom = located.end;
    const normalized = patternText(value);
    const map = normalized.keptIndexes.map((index) => located.map[index]);
    const start = map[0] ?? located.start;
    units.push(messageUnit(normalized.text, map, start, normalized.reviewRequired));
  };

  const visit = (value) => {
    if (typeof value === 'string') {
      addValue(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const variant of value) {
        assertComplexMessage(variant);
        for (const text of Object.values(variant.match)) addValue(text);
      }
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (key === '$schema') continue;
        visit(child);
      }
      return;
    }
    throw new Error('Unsupported Inlang message structure.');
  };

  visit(parsed);
  return units.sort((left, right) => left.start - right.start);
};
