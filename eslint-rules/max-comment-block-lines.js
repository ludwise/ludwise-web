/**
 * Limits how long a comment may run: a `//` block, and a `/* *\/` doc comment.
 *
 * A long run of line comments means one of two things. Either the code is not saying what it
 * does, or a contract is being described where documentation tooling cannot read it.
 * A long doc comment means something else. An essay has grown where a contract belongs.
 * It usually grows by absorbing worked examples a test already asserts.
 * It also absorbs a rationale an architecture decision record (ADR) already owns.
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
        properties: {
          max: { type: 'integer', minimum: 1 },
          maxBlock: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        'This comment block is {{count}} lines; the limit is {{max}}. Make the code carry it — a clearer name, a smaller function, an extracted concept — or move a contract onto its declaration as a /** */ doc comment.',
      docTooLong:
        'This doc comment is {{count}} lines; the limit is {{max}}. State the contract and cite the rest: worked examples belong in the test that asserts them, and a long rationale in an ADR.',
    },
  },

  create(context) {
    const max = context.options[0]?.max ?? 3;
    const maxBlock = context.options[0]?.maxBlock ?? 15;
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
            if (comment.type === 'Block' && startsItsOwnLine(comment)) {
              const lines = comment.loc.end.line - comment.loc.start.line + 1;
              if (lines > maxBlock && !DIRECTIVE.test(comment.value)) {
                context.report({
                  loc: comment.loc,
                  messageId: 'docTooLong',
                  data: { count: String(lines), max: String(maxBlock) },
                });
              }
            }
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
