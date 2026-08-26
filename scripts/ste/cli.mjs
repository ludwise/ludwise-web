#!/usr/bin/env node

/**
 * The controlled language checker.
 *
 * Exit code 0 means no violation, 1 means a violation, and 2 means the checker
 * could not run. A caller that cannot tell the second from the third would read
 * a broken policy as a clean result.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { checkFiles, enforcedFiles, positionOf, rulesForClass } from './check.mjs';
import { extractMarkdown } from './extract.mjs';
import { IMPLEMENTED_EXEMPTION_IDS } from './mask.mjs';
import { PolicyError, loadLanguageDocuments, validateConfiguration } from './policy.mjs';
import { formatJson, formatMarkdown, formatMatrix, formatText, summarize } from './report.mjs';
import { IMPLEMENTED_RULE_IDS, runRules } from './rules.mjs';

const COMMANDS = ['check', 'audit', 'report', 'check-text'];

const USAGE = `Usage: ste <${COMMANDS.join('|')}> [options]

  check        Run the deterministic checks over the paths that the rollout enforces.
  audit        Run the deterministic checks over every tracked file and report the result.
  report       Print the conformance matrix and the rules that no check supports.
  check-text   Run the checks over one text file, such as a draft description.

Options:
  --root <dir>          The repository root. The default is the working directory.
  --format <name>       text, markdown or json. The default is text.
  --strict              Make the audit exit with 1 when it finds a violation.
  --kind <name>         prose or commit, for check-text. The default is prose.
  --prose <name>        descriptive or procedural, for check-text.`;

const REGISTRY = {
  implementedRuleIds: IMPLEMENTED_RULE_IDS,
  implementedExemptionIds: IMPLEMENTED_EXEMPTION_IDS,
};

const trackedFiles = (rootDir) =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((path) => path.length > 0);

const emit = (result, documents, scope, format) => {
  const summary = summarize(result, documents, scope);
  if (format === 'json') return formatJson(result, summary);
  if (format === 'markdown') return formatMarkdown(summary);
  return formatText(result, summary);
};

const runOverRepository = (documents, options, scope) => {
  const configuration = validateConfiguration(documents, REGISTRY);
  const files = trackedFiles(options.root);
  const targets = scope === 'enforced' ? enforcedFiles(files, documents.policy) : files;
  const result = checkFiles({ rootDir: options.root, files: targets, documents, allFiles: files });

  result.diagnostics = [...configuration, ...result.diagnostics];
  console.log(emit(result, documents, scope, options.format));
  return result.diagnostics.length;
};

const runOverText = (documents, options, path) => {
  const source = readFileSync(path, 'utf8');
  const units = extractMarkdown(source);
  const found = runRules(units, {
    policy: documents.policy,
    terminology: documents.terminology,
    defaultProse: options.prose ?? 'descriptive',
    allowedRules: rulesForClass(documents.conformance, 'STE-STRICT'),
    commitPrefix: options.kind === 'commit',
  });

  const diagnostics = found.map((one) => ({
    file: basename(path),
    ...positionOf(source, one.offset),
    rule: one.rule,
    contentClass: 'STE-STRICT',
    unit: 'prose',
    message: one.message,
    correction: one.correction,
  }));

  const result = { diagnostics, filesChecked: 1, unitsChecked: units.length, unsupportedUnits: 0 };
  console.log(emit(result, documents, 'one text', options.format));
  return diagnostics.length;
};

const main = (argv) => {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        root: { type: 'string' },
        format: { type: 'string' },
        strict: { type: 'boolean' },
        kind: { type: 'string' },
        prose: { type: 'string' },
      },
    });
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }

  const [command, target] = parsed.positionals;
  const options = { ...parsed.values, root: parsed.values.root ?? process.cwd() };

  if (command === undefined) {
    console.error(USAGE);
    return 2;
  }
  if (!COMMANDS.includes(command)) {
    console.error(`Unknown subcommand "${command}".\n\n${USAGE}`);
    return 2;
  }

  let documents;
  try {
    documents = loadLanguageDocuments(options.root);
  } catch (error) {
    if (error instanceof PolicyError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  if (command === 'report') {
    console.log(formatMatrix(documents));
    return 0;
  }

  if (command === 'check-text') {
    if (target === undefined) {
      console.error(`check-text needs a path.\n\n${USAGE}`);
      return 2;
    }
    return runOverText(documents, options, target) > 0 ? 1 : 0;
  }

  if (command === 'check') {
    return runOverRepository(documents, options, 'enforced') > 0 ? 1 : 0;
  }

  const violations = runOverRepository(documents, options, 'repository');
  return options.strict === true && violations > 0 ? 1 : 0;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`The checker could not run: ${error.message}`);
    process.exitCode = 2;
  }
}

export { main };
