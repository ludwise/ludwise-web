/**
 * Limits a run of consecutive `//` comments.
 *
 * A long block of line comments is the signal that something is wrong: either
 * the code is not saying what it does, or a contract is being described in a
 * place documentation tooling cannot read. The fix is a clearer name, a smaller
 * function, an extracted concept - or, where the text really is a contract, a
 * `/** *\/` doc comment on the declaration it belongs to.
 *
 * Directive comments (`eslint-…`, `@ts-…`, `prettier-…`) are exempt: they are
 * instructions to tooling, not prose, and their length is not ours to choose.
 */

const DIRECTIVE = /^\s*(eslint|@?ts-|prettier-|globals?\s|istanbul|c8|v8|dprint|biome)/;

/** @type {import('eslint').Rule.RuleModule} */
export const maxCommentBlockLines = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Limit consecutive `//` comment lines; longer explanations belong in a doc comment or in clearer code.',
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        'This comment block is {{count}} lines; the limit is {{max}}. Make the code carry it — a clearer name, a smaller function, an extracted concept — or move a contract onto its declaration as a /** */ doc comment.',
    },
  },

  create(context) {
    const max = context.options[0]?.max ?? 3;
    const source = context.sourceCode ?? context.getSourceCode();

    /** True when nothing but whitespace precedes the comment on its line. */
    const startsItsOwnLine = (comment) =>
      source.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim() === '';

    return {
      Program() {
        let run = [];

        const flush = () => {
          if (run.length > max && !run.some((comment) => DIRECTIVE.test(comment.value))) {
            context.report({
              loc: { start: run[0].loc.start, end: run[run.length - 1].loc.end },
              messageId: 'tooLong',
              data: { count: String(run.length), max: String(max) },
            });
          }
          run = [];
        };

        for (const comment of source.getAllComments()) {
          if (comment.type !== 'Line' || !startsItsOwnLine(comment)) {
            flush();
            continue;
          }
          const previous = run[run.length - 1];
          if (previous !== undefined && comment.loc.start.line === previous.loc.end.line + 1) {
            run.push(comment);
          } else {
            flush();
            run = [comment];
          }
        }

        flush();
      },
    };
  },
};

export default { rules: { 'max-comment-block-lines': maxCommentBlockLines } };
