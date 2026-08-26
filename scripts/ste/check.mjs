/**
 * One pass over a list of files.
 *
 * A file is read once, classified, split into prose units and measured. The
 * conformance matrix decides which rules a content class receives. The
 * checker cannot apply a rule that the matrix does not claim for that class.
 * A unit whose extraction is not implemented is counted rather than ignored.
 */

import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classificationCoverage, classify } from './classify.mjs';
import {
  commentCoverage,
  declaredProseKind,
  extractComments,
  extractMarkdown,
} from './extract.mjs';
import { matchesAnyGlob } from './glob.mjs';
import { IMPLEMENTED_RULE_IDS, PROSE_RULE_IDS, runRules } from './rules.mjs';

const COMMENT_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.astro'];

const endsWithAny = (path, extensions) => extensions.some((extension) => path.endsWith(extension));

export const positionOf = (source, offset) => {
  let line = 1;
  let start = 0;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === '\n') {
      line += 1;
      start = index + 1;
    }
  }
  return { line, column: offset - start + 1 };
};

export const rulesForClass = (conformance, contentClass) =>
  (conformance.rules ?? [])
    .filter(
      (row) =>
        row.implementationStatus === 'implemented' &&
        PROSE_RULE_IDS.includes(row.ludwiseRule) &&
        (row.contentClasses ?? []).includes(contentClass),
    )
    .map((row) => row.ludwiseRule);

export const enforcedFiles = (files, policy) => {
  if (policy.rollout.mode === 'enforce') return [...files];
  return files.filter((file) => matchesAnyGlob(file, policy.rollout.enforcedPaths ?? []));
};

const unitsFor = (assignment, source, file) => {
  if (assignment.unit === 'prose') {
    return file.endsWith('.md')
      ? {
          units: extractMarkdown(source),
          supported: true,
          unread: 0,
          prose: declaredProseKind(source),
        }
      : { units: [], supported: false, unread: 1 };
  }
  if (assignment.unit === 'comments') {
    if (!endsWithAny(file, COMMENT_EXTENSIONS)) return { units: [], supported: false, unread: 1 };
    const coverage = commentCoverage(source, file);
    return {
      units: coverage === 'none' ? [] : extractComments(source, file),
      supported: coverage !== 'none',
      unread: coverage === 'full' ? 0 : 1,
    };
  }
  return { units: [], supported: false, unread: 1 };
};

const exceptionAllows = (exception, file, rule) =>
  matchesAnyGlob(file, exception.scope?.paths ?? []) && (exception.rules ?? []).includes(rule);

export const checkFiles = ({ rootDir, files, documents, allFiles = files }) => {
  const { policy, terminology, conformance, exceptions } = documents;
  const diagnostics = [];
  let filesChecked = 0;
  let unitsChecked = 0;
  let unsupportedUnits = 0;

  for (const file of files) {
    const assignments = classify(file, policy).assignments.filter(
      (assignment) => assignment.contentClass !== 'STE-EXEMPT',
    );
    if (assignments.length === 0) continue;

    const unreadable = (message) => {
      diagnostics.push({
        file,
        line: 1,
        column: 1,
        rule: 'LW-STE-FILE-UNREADABLE',
        contentClass: assignments[0].contentClass,
        unit: assignments[0].unit,
        message,
        correction: 'restore-the-file-or-correct-the-classification',
      });
    };

    let source;
    try {
      if (lstatSync(join(rootDir, file)).isSymbolicLink()) {
        unreadable(
          'The path is a symbolic link. The checker reads no file outside the repository.',
        );
        continue;
      }
      source = readFileSync(join(rootDir, file), 'utf8');
    } catch (error) {
      unreadable(
        `The file is classified as controlled prose and could not be read: ${error.message}`,
      );
      continue;
    }

    let touched = false;

    for (const assignment of assignments) {
      let extracted;
      try {
        extracted = unitsFor(assignment, source, file);
      } catch (error) {
        unreadable(
          `The file is classified as controlled prose and could not be parsed: ${error.message}`,
        );
        continue;
      }

      const { units, supported, unread, prose } = extracted;
      unsupportedUnits += unread;
      if (!supported) continue;

      touched = true;
      unitsChecked += units.length;

      const found = runRules(units, {
        policy,
        terminology,
        defaultProse: prose ?? assignment.prose ?? 'mixed',
        allowedRules: rulesForClass(conformance, assignment.contentClass),
      });

      for (const one of found) {
        const { line, column } = positionOf(source, one.offset);
        diagnostics.push({
          file,
          line,
          column,
          rule: one.rule,
          contentClass: assignment.contentClass,
          unit: assignment.unit,
          message: one.message,
          correction: one.correction,
        });
      }
    }

    if (touched) filesChecked += 1;
  }

  const kept = diagnostics.filter(
    (one) =>
      !(exceptions.exceptions ?? []).some((exception) =>
        exceptionAllows(exception, one.file, one.rule),
      ),
  );

  for (const exception of exceptions.exceptions ?? []) {
    if (!allFiles.some((file) => matchesAnyGlob(file, exception.scope?.paths ?? []))) {
      kept.push({
        file: 'docs/language/exceptions.json',
        line: 1,
        column: 1,
        rule: 'LW-STE-EXCEPTION-UNUSED',
        contentClass: null,
        unit: null,
        message: `The exception ${exception.id} matches no file. Remove it.`,
        correction: 'remove-the-exception',
      });
    }
  }

  kept.push(...classificationCoverage(allFiles, policy));

  kept.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  );

  return {
    diagnostics: kept,
    filesChecked,
    unitsChecked,
    unsupportedUnits,
    implementedRules: IMPLEMENTED_RULE_IDS,
  };
};
