#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FULL = Object.freeze({
  format: true,
  language: true,
  static: true,
  unit: true,
  build: true,
  browser: true,
  degraded: true,
  deployment: true,
  publishAudit: true,
});

const EMPTY = Object.freeze(Object.fromEntries(Object.keys(FULL).map((key) => [key, false])));

const CONTROL = [
  /^\.github\//,
  /^scripts\/ci\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^\.nvmrc$/,
  /^tsconfig(?:\..+)?\.json$/,
  /^vitest(?:\..+)?\.(?:ts|js|mts|mjs)$/,
  /^playwright(?:\..+)?\.(?:ts|js|mts|mjs)$/,
  /^eslint(?:\.config)?\./,
  /^astro\.config\./,
  /^wrangler(?:\..+)?\.jsonc$/,
  /^\.dev\.vars\.example$/,
  /^project\.inlang\//,
  /^scripts\/(?:check-dev-ssr|run-degraded|audit-public|check-bundle)\.mjs$/,
];

const DOC =
  /^(?:README\.md|CHANGELOG\.md|CONTRIBUTING\.md|SECURITY\.md|SUPPORT\.md|docs\/|\.claude\/|\.github\/.*\.md$)/;
const CODE =
  /^(?:src\/|tests\/|scripts\/|eslint-rules\/).+\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|astro)$/;

const merge = (target, patch) => {
  for (const [key, value] of Object.entries(patch)) target[key] ||= value;
};

export const classifyPaths = (paths) => {
  const plan = { ...EMPTY };
  let full = false;
  let unknown = false;

  for (const path of paths) {
    if (!path) continue;
    if (CONTROL.some((pattern) => pattern.test(path))) {
      full = true;
      continue;
    }
    if (DOC.test(path) || path.endsWith('.md')) {
      merge(plan, { format: true, language: true });
      continue;
    }
    if (/^(?:messages\/|src\/paraglide\/)/.test(path)) {
      merge(plan, {
        format: true,
        language: true,
        static: true,
        unit: true,
        build: true,
        browser: true,
        publishAudit: true,
      });
      continue;
    }
    if (/^tests\/(?:e2e|states)\//.test(path) || /^playwright\./.test(path)) {
      merge(plan, {
        format: true,
        language: true,
        static: true,
        unit: true,
        build: true,
        browser: true,
      });
      continue;
    }
    if (/^tests\/.*degrad/i.test(path)) {
      merge(plan, {
        format: true,
        language: true,
        static: true,
        unit: true,
        build: true,
        degraded: true,
      });
      continue;
    }
    if (/^src\//.test(path)) {
      merge(plan, {
        format: true,
        language: true,
        static: true,
        unit: true,
        build: true,
        browser: true,
        publishAudit: true,
      });
      continue;
    }
    if (CODE.test(path)) {
      merge(plan, { format: true, language: true, static: true, unit: true, build: true });
      continue;
    }
    if (
      /^(?:\.prettierignore|\.prettierrc\.json|\.editorconfig|\.gitattributes|\.gitignore)$/.test(
        path,
      )
    ) {
      merge(plan, { format: true });
      continue;
    }
    unknown = true;
  }

  if (full || unknown || paths.length === 0) return { full: true, unknown, ...FULL };
  return { full: false, unknown: false, ...plan };
};

const changedPaths = (base, head) => {
  const output = execFileSync('git', ['diff', '--name-status', '-M', '-z', base, head], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const fields = output.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status.startsWith('R') || status.startsWith('C'))
      paths.push(fields[index++], fields[index++]);
    else paths.push(fields[index++]);
  }
  return paths;
};

const writePlan = (plan, outputPath) => {
  const lines = Object.entries(plan).map(([key, value]) => `${key}=${value ? 'true' : 'false'}`);
  const text = `${lines.join('\n')}\n`;
  if (outputPath) appendFileSync(outputPath, text);
  else process.stdout.write(text);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--github-output');
  const outputPath = outputIndex >= 0 ? args.splice(outputIndex, 2)[1] : undefined;

  if (args[0] === '--full') {
    writePlan({ full: true, unknown: false, ...FULL }, outputPath);
  } else {
    const [base, head] = args;
    if (!base || !head) throw new Error('Expected BASE and HEAD commit SHAs.');
    try {
      writePlan(classifyPaths(changedPaths(base, head)), outputPath);
    } catch (error) {
      console.error(
        `Impact diff failed; escalating to full verification: ${error instanceof Error ? error.message : String(error)}`,
      );
      writePlan({ full: true, unknown: true, ...FULL }, outputPath);
    }
  }
}
