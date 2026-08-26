/**
 * Path matching for the classification table.
 *
 * A single star stays inside one path segment and a double star crosses them.
 * Every other character is a literal, so a period in a file name cannot match
 * an arbitrary character.
 */

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

const literal = (value) => value.replace(ESCAPE, '\\$&');

const translate = (pattern) => {
  let source = '';
  let index = 0;

  while (index < pattern.length) {
    const rest = pattern.slice(index);

    if (rest.startsWith('**/')) {
      source += '(?:.*/)?';
      index += 3;
      continue;
    }
    if (rest.startsWith('**')) {
      source += '.*';
      index += 2;
      continue;
    }
    if (rest.startsWith('*')) {
      source += '[^/]*';
      index += 1;
      continue;
    }
    if (rest.startsWith('?')) {
      source += '[^/]';
      index += 1;
      continue;
    }
    if (rest.startsWith('{')) {
      const close = rest.indexOf('}');
      if (close > 0) {
        const options = rest.slice(1, close).split(',');
        source += `(?:${options.map((option) => literal(option)).join('|')})`;
        index += close + 1;
        continue;
      }
    }

    source += literal(pattern[index]);
    index += 1;
  }

  return new RegExp(`^${source}$`);
};

const cache = new Map();

export const globToRegExp = (pattern) => {
  const known = cache.get(pattern);
  if (known !== undefined) return known;

  const compiled = translate(pattern);
  cache.set(pattern, compiled);
  return compiled;
};

export const matchesGlob = (path, pattern) => globToRegExp(pattern).test(path);

export const matchesAnyGlob = (path, patterns) =>
  patterns.some((pattern) => matchesGlob(path, pattern));
