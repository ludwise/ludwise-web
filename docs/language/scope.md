# Content classes

Every file in this repository belongs to one of three classes for each kind of
text it holds. The class decides which rules apply. The mapping lives in
[policy.json](policy.json), and the checker reads it rather than a guess.

## The three classes

| Class         | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `STE-STRICT`  | The final text must obey the LUDWISE profile.                            |
| `STE-DERIVED` | The text starts from a controlled baseline and then passes the pipeline. |
| `STE-EXEMPT`  | The content is machine syntax or a value that LUDWISE does not control.  |

## Units

A class attaches to a unit of a file, not always to the whole file. One source
file can hold a strict comment and a derived string at the same time.

| Unit       | Meaning                                    | Checker support |
| ---------- | ------------------------------------------ | --------------- |
| `prose`    | The whole file is controlled prose.        | Markdown only   |
| `comments` | Only the comments in the file are prose.   | Full            |
| `strings`  | Only the human-readable strings are prose. | None            |

The checker counts every unit that it cannot read, and it prints the count. It
never reports such a unit as clean.

## What `STE-STRICT` covers

Architecture documents, README prose, contributor documents, developer
documents, operational documents, deployment procedures and security
procedures. Also code comments, documentation comments and public contract
documents.

Also agent instructions, agent prompts, `AGENTS.md`, `CLAUDE.md`, and every
other internal technical document. Also internal operational messages that a
person reads, and developer-facing explanations that are controlled prose.

Also the descriptions that LUDWISE agents write for an issue, a pull request or
a review comment. No repository check can read those before they are posted, so
`ste check-text` is available for a draft. [checker.md](checker.md) explains it.

## What `STE-DERIVED` covers

Text that a visitor reads. The rules are in
[user-facing-text.md](user-facing-text.md). This repository is the public
website. The class covers the strings in every Astro page, layout and component,
in the one React island, and in `src/lib/http/filter-advice.ts`.

That last file is the only module that holds visitor sentences rather than a
template. Every other visitor string is written where it is rendered.

[content-style.md](../../design/system/guidelines/content-style.md) fixes some
strings exactly. A fixed string is reused word for word, and it is not a
candidate for a rewrite under this profile. It is quoted external text, and the
checker never reads a string literal in any case.

## What `STE-EXEMPT` covers

Prose rules do not apply to machine syntax or to a value that somebody else
controls. The exemptions are declared in [policy.json](policy.json) and each one
has an implementation in the checker. The checker fails if a declared exemption
has no implementation, or if an implementation is not declared.

| Category                     | How it is exempt                                            |
| ---------------------------- | ----------------------------------------------------------- |
| Programming-language syntax  | A fenced block is removed before any rule runs.             |
| Function and method names    | An identifier shape is masked as one word.                  |
| Class and type names         | An identifier shape is masked as one word.                  |
| Variable names and constants | An identifier shape is masked as one word.                  |
| Database and column names    | An identifier shape is masked as one word.                  |
| Environment-variable names   | An identifier shape is masked as one word.                  |
| JSON and YAML keys           | A machine key is never extracted as prose.                  |
| API paths and HTTP methods   | A path shape is masked as one word.                         |
| URLs and URIs                | An address pattern is masked as one word.                   |
| File paths and file names    | A path shape is masked as one word.                         |
| Commands for a shell         | Write it in backticks, which are masked.                    |
| Git branch names             | A path shape is masked as one word.                         |
| Conventional Commit prefix   | The structured prefix is masked for a commit check.         |
| Protocol identifiers         | An identifier shape is masked as one word.                  |
| Machine status values        | Write it in backticks, which are masked.                    |
| Stable event identifiers     | Write it in backticks, which are masked.                    |
| External API values          | Write it in backticks, which are masked.                    |
| Official product names       | The name is listed in [terminology.json](terminology.json). |
| Official company names       | The name is listed in [terminology.json](terminology.json). |
| Exact quoted text            | Put it in a fenced block, or record an exception.           |
| Third-party error messages   | Put it in a fenced block, or record an exception.           |
| Third-party interface text   | Put it in a fenced block, or record an exception.           |
| Code examples                | A fenced block is removed before any rule runs.             |

An exemption is narrow on purpose. A block quote stays under control, because a
quotation mark around a paragraph must not become a way to write uncontrolled
prose. Exact quoted text belongs in a fenced block or in a recorded exception.

Backticks are bounded for the same reason. A code span must stay on one line,
hold 100 characters or fewer, and hold six words or fewer. Anything longer is
read as prose and measured like any other prose. Without that bound, a writer
could put a whole paragraph in backticks and pass every rule.

## Procedural prose and descriptive prose

The profile separates the two, and the limits differ. See
[profile.md](profile.md). The checker treats an ordered list item as a step and
every other unit as description. That rule is deterministic and it is not a
judgment about mood.
