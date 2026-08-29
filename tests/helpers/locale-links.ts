import ts from 'typescript';

interface SourceText {
  text: string;
  offset: number;
}

interface AstroSource {
  frontmatter: SourceText;
  body: SourceText;
}

interface StringBinding {
  value: string;
  offset: number;
}

const URL_ATTRIBUTES = new Set(['href', 'action']);
const OPAQUE_ELEMENT = /<(script|style)\b[\s\S]*?<\/\1\s*>/giu;
const ASTRO_TAG = /<[A-Za-z][^>]*>/gu;
const ASTRO_ATTRIBUTE =
  /\b(href|action)\s*=\s*(?:(["'])(.*?)\2|\{\s*(?:(["'])(.*?)\4|([A-Za-z_$][\w$]*))\s*\})/gu;

const astroSource = (source: string): AstroSource => {
  if (!source.startsWith('---')) {
    return { frontmatter: { text: '', offset: 0 }, body: { text: source, offset: 0 } };
  }
  const openEnd = source.indexOf('\n');
  const close = source.indexOf('\n---', 3);
  if (openEnd === -1 || close === -1) {
    return { frontmatter: { text: '', offset: 0 }, body: { text: source, offset: 0 } };
  }
  return {
    frontmatter: { text: source.slice(openEnd + 1, close), offset: openEnd + 1 },
    body: { text: source.slice(close + 4), offset: close + 4 },
  };
};

const scriptKind = (file: string): ts.ScriptKind => {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
};

const sourceFile = (source: string, file: string): ts.SourceFile =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));

const stringBindings = (source: string, file: string, base = 0): Map<string, StringBinding> => {
  const parsed = sourceFile(source, file);
  const bindings = new Map<string, StringBinding>();

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      bindings.set(node.name.text, {
        value: node.initializer.text,
        offset: base + node.initializer.getStart(parsed),
      });
    }
    node.forEachChild(visit);
  };

  visit(parsed);
  return bindings;
};

const isPageUrl = (value: string): boolean => {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  const path = value.split(/[?#]/u, 1)[0] ?? value;
  if (path === '/api' || path.startsWith('/api/')) return false;
  return !/\/[^/]+\.[a-z0-9]+$/iu.test(path);
};

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

const report = (source: string, file: string, offset: number, value: string): string =>
  `${file}:${String(lineAt(source, offset))}: ${value}`;

const maskedOpaqueElements = (source: string): string =>
  source.replace(OPAQUE_ELEMENT, (match) => match.replace(/[^\n]/gu, ' '));

const astroTargets = (
  source: string,
  file: string,
  body: SourceText,
  bindings: Map<string, StringBinding>,
): string[] => {
  const found: string[] = [];
  const template = maskedOpaqueElements(body.text);
  ASTRO_TAG.lastIndex = 0;
  let tag = ASTRO_TAG.exec(template);

  while (tag !== null) {
    ASTRO_ATTRIBUTE.lastIndex = 0;
    let attribute = ASTRO_ATTRIBUTE.exec(tag[0]);
    while (attribute !== null) {
      const direct = attribute[3] ?? attribute[5];
      const value =
        direct ?? (attribute[6] === undefined ? undefined : bindings.get(attribute[6])?.value);
      if (value !== undefined && isPageUrl(value)) {
        found.push(report(source, file, body.offset + tag.index + attribute.index, value));
      }
      attribute = ASTRO_ATTRIBUTE.exec(tag[0]);
    }
    tag = ASTRO_TAG.exec(template);
  }

  return found;
};

const jsxTargets = (
  source: string,
  file: string,
  bindings: Map<string, StringBinding>,
): string[] => {
  const parsed = sourceFile(source, file);
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && URL_ATTRIBUTES.has(node.name.getText(parsed).toLowerCase())) {
      let value: string | undefined;
      if (node.initializer !== undefined && ts.isStringLiteral(node.initializer)) {
        value = node.initializer.text;
      }
      if (
        node.initializer !== undefined &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression !== undefined
      ) {
        const expression = node.initializer.expression;
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
          value = expression.text;
        } else if (ts.isIdentifier(expression)) {
          value = bindings.get(expression.text)?.value;
        }
      }
      if (value !== undefined && isPageUrl(value)) {
        found.push(report(source, file, node.getStart(parsed), value));
      }
    }
    node.forEachChild(visit);
  };

  visit(parsed);
  return found;
};

/** Finds page URLs that bypass Astro's locale-aware URL helpers. */
export function findUnlocalizedApplicationTargets(source: string, file: string): string[] {
  if (file.endsWith('.astro')) {
    const astro = astroSource(source);
    return astroTargets(
      source,
      file,
      {
        text: astro.body.text,
        offset: astro.body.offset,
      },
      stringBindings(astro.frontmatter.text, 'frontmatter.ts', astro.frontmatter.offset),
    );
  }

  if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
    return jsxTargets(source, file, stringBindings(source, file));
  }

  return [];
}
