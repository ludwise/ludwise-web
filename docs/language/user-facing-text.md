---
ste-prose: descriptive
---

# Text that a person outside the team reads

This is the `STE-DERIVED` class. A visitor reads the public product text. That
person is not a contributor, and does not read a controlled language for a
living.

## The pipeline <!-- ste-prose: procedural -->

```text
meaning -> ASD-STE100 baseline -> /humanizer -> semantic safety review -> final text
```

1. Decide what the text must say.
2. Write the baseline against the LUDWISE profile.
3. Run the `/humanizer` skill over the baseline.
4. Review the result against the list below.
5. Commit the reviewed text.

The final text is derived from the baseline. It is not held to strict
conformance, because a strict sentence can read as though nobody chose it.

## What the humanizer must never change

The skill removes the marks of machine-written prose. It does not decide what
the text claims. These must survive the step unchanged:

- Meaning
- A numeric value
- A price
- A date
- A time
- A permission
- A security meaning
- A privacy meaning
- A billing meaning
- A legal meaning
- An accessibility meaning
- The meaning of a destructive action
- A recovery instruction
- A technical fact
- Product behavior

A natural sentence never outranks clarity or safety. When the two conflict,
clarity wins and the text stays plain.

## The safety review

The review reads the baseline and the final text side by side. It answers one
question: does the final text still say what the baseline said? A reviewer who
cannot answer it sends the text back.

Wording that changes what LUDWISE claims about itself is a product decision. It
escalates by the rule in `CLAUDE.md`, and it is not settled by whoever has
the file open.

## When the humanizer is not available

Do not substitute a different transformation. Do not let a model improvise a
replacement step. The two allowed outcomes are:

1. Commit the ASD-STE100 baseline as written, and record the pending step.
2. Hold the text until the skill is available.

Silence is not an option. A commit that skipped the step says so in its body.

## What this phase does not do

This phase does not rewrite the visitor-facing copy that already exists. The
checker never reads a string literal, so no deterministic rule covers this class
today. [conformance.md](conformance.md) records that gap in
`LW-STE-DERIVED-PIPELINE`.

The gap matters more here than in the backend. Almost every visitor-visible
string is written in a template, and only `src/lib/http/filter-advice.ts` holds
copy on its own. A phase 2 task that wants an automatic check must first choose
a home for the strings.

[content-style.md](../../design/system/guidelines/content-style.md) already
fixes some strings and prohibits some claims. That document wins where the two
overlap, and this profile never softens it.
