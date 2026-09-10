---
ste-prose: descriptive
---

# Accessibility program

LUDWISE targets WCAG 2.2 Level A and Level AA for the public web product.
The [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) is the normative
source. The [How to Meet WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/)
is implementation guidance. The [A11Y Project checklist](https://www.a11yproject.com/checklist/)
is a practical review aid. It does not replace WCAG conformance work.

This document owns the repository accessibility program. The design rules remain
in [`design/system/guidelines/accessibility.md`](../design/system/guidelines/accessibility.md).
The release-candidate manual pass remains in [issue #37](https://github.com/ludwise/ludwise-web/issues/37).

## Conformance boundary

A passing automated check does not prove WCAG conformance. Automated tools can
find deterministic defects. They cannot establish every success criterion for
every visitor and every state.

The pull request gate blocks deterministic failures. The release gate also uses
the manual pass in issue #37 for important releases until an equivalent check is
reliable and reviewable.

Do not add a broad axe exclusion. Do not suppress a real failure. A narrow
exception must name the affected element, the applicable criterion, and the
reason. It must also have a focused tracking issue when work remains.

## Verification methods

### Automated verification

Continuous integration runs the following checks when their paths are affected:

- ESLint and `eslint-plugin-jsx-a11y` for source-level defects.
- Vitest architecture and design tests for reusable invariants.
- Playwright with axe on representative routes and both themes.
- Playwright checks for keyboard entry, responsive reflow, and application
  semantics.
- Contrast tests for component boundaries and the focus token in both themes.
- Type checks, build checks, and Simplified Technical English checks.

The existing axe route audits remain blocking. The only current axe exclusion is
the LUDWISE wordmark exception in `tests/e2e/shell.spec.ts`. It is narrow and it
records the WCAG reason in the test. This program does not add another exclusion.

### Manual verification

Issue #37 owns the written release-candidate procedure and the recorded pass.
The pass covers the surfaces that need human judgment, including:

- keyboard-only operation and logical focus order.
- no keyboard trap and no obscured focused control.
- focus visibility during real navigation.
- 200 percent text resize, zoom, reflow, and orientation.
- forced-color and high-contrast behavior.
- reduced-motion behavior where motion exists.
- information that must not depend on color alone.
- touch behavior and target-size exceptions.
- screen-reader structure, control names, state, and announcements.
- form instructions, error recovery, and dynamic status messages.

Run the pass against the frozen release candidate on staging. Record each defect
as a focused fix or a focused issue that names the criterion and surface.

## Design-system invariants

Accessibility rules belong in the smallest reusable layer that can prevent a
repeat defect.

- Text and component contrast use semantic color tokens. The component boundary
  and focus tokens are tested in both themes by
  [`tests/unit/design/boundary-contrast.test.ts`](../tests/unit/design/boundary-contrast.test.ts).
- Focus uses one global `:focus-visible` rule. Components cannot replace or
  remove it. [`tests/architecture/design-system.test.ts`](../tests/architecture/design-system.test.ts)
  blocks local focus overrides.
- Pointer targets use `--target-min` at 40px. Touch targets use
  `--target-min-touch` at 44px. The 24px `--target-min-inline` token is only for
  a control nested in a larger target or another valid criterion exception.
- Reduced motion is global in `src/styles/tokens/motion.css`. The reduced-motion
  media query sets authored duration tokens to zero and clamps animation and
  transition duration.
- Forms use a visible label. Placeholder text is not a label. Error text is
  connected to its control, and invalid controls expose `aria-invalid`.
- `IconButton` requires a `label` prop and maps it to an accessible name. Do not
  make an icon-only control without an accessible name.
- DOM order defines keyboard order. Positive `tabindex` is prohibited.
- Semantic HTML is preferred over ARIA repair. Use ARIA only when native
  semantics cannot express the required state or relationship.

[`tests/architecture/accessibility-program.test.ts`](../tests/architecture/accessibility-program.test.ts)
pins the repository-owned parts of these invariants and the matrix shape.

## Pull request and release gate

A pull request cannot merge when an applicable automated accessibility check
fails. A change that introduces a new surface must update tests or the matrix
when its WCAG applicability changes.

For a presentation change, verify both light and dark themes. For a layout or
interaction change, verify the narrow-width state. Use the manual procedure when
an applicable criterion cannot be established by automation.

An important release also requires the issue #37 manual result until that issue
is replaced by reliable equivalent evidence. A known exception must have a
focused issue. Do not treat an undocumented exception as release evidence.

## New or changed features

When a feature changes the applicability of a success criterion:

1. Read the current W3C criterion and its supporting guidance.
2. Change the matrix status and surface before merge.
3. Add the cheapest reliable automated check where one can establish the rule.
4. Add or update the manual procedure when human judgment is still required.
5. Put a recurring defect rule in the design system or another shared layer.
6. Link a focused issue for any known exception or deferred fix.

Do not build a feature only to make a currently inapplicable criterion apply.
For example, do not add authentication, media, timed content, or a drag control
only because this matrix contains criteria for those features.

## WCAG 2.2 Level A and AA applicability matrix

`Applicable` means the current public product has that surface. `Not current`
means the product does not have the content or interaction that activates the
criterion. `Conditional` means the rule applies when an optional or data-driven
state appears. A `2.2` version marker identifies the six new Level A or AA
criteria added by WCAG 2.2.

| Criterion                                                                                 | Level | Version | Status      | Surface                                            | Method    | Evidence                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----- | ------- | ----------- | -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| [1.1.1](https://www.w3.org/TR/WCAG22/#non-text-content)                                   | A     | Earlier | Applicable  | Images, icons, controls                            | Both      | [axe routes](../tests/e2e/shell.spec.ts), [design rule](../design/system/guidelines/accessibility.md)         |
| [1.2.1](https://www.w3.org/TR/WCAG22/#audio-only-and-video-only-prerecorded)              | A     | Earlier | Not current | No prerecorded audio-only or video-only media      | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.2.2](https://www.w3.org/TR/WCAG22/#captions-prerecorded)                               | A     | Earlier | Not current | No prerecorded synchronized media                  | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.2.3](https://www.w3.org/TR/WCAG22/#audio-description-or-media-alternative-prerecorded) | A     | Earlier | Not current | No prerecorded synchronized media                  | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.2.4](https://www.w3.org/TR/WCAG22/#captions-live)                                      | AA    | Earlier | Not current | No live synchronized media                         | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.2.5](https://www.w3.org/TR/WCAG22/#audio-description-prerecorded)                      | AA    | Earlier | Not current | No prerecorded video                               | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.3.1](https://www.w3.org/TR/WCAG22/#info-and-relationships)                             | A     | Earlier | Applicable  | Landmarks, headings, lists, tables, forms          | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [1.3.2](https://www.w3.org/TR/WCAG22/#meaningful-sequence)                                | A     | Earlier | Applicable  | Page and control DOM order                         | Both      | [focus architecture rule](../tests/architecture/design-system.test.ts), [manual pass](#manual-verification)   |
| [1.3.3](https://www.w3.org/TR/WCAG22/#sensory-characteristics)                            | A     | Earlier | Applicable  | Instructions and state communication               | Manual    | [manual pass](#manual-verification)                                                                           |
| [1.3.4](https://www.w3.org/TR/WCAG22/#orientation)                                        | AA    | Earlier | Applicable  | Responsive pages                                   | Manual    | [manual pass](#manual-verification)                                                                           |
| [1.3.5](https://www.w3.org/TR/WCAG22/#identify-input-purpose)                             | AA    | Earlier | Conditional | Forms that collect data about the visitor          | Both      | [axe routes](../tests/e2e/shell.spec.ts), [feature change rule](#new-or-changed-features)                     |
| [1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color)                                       | A     | Earlier | Applicable  | Price, freshness, selection, errors                | Both      | [design rule](../design/system/guidelines/accessibility.md), [manual pass](#manual-verification)              |
| [1.4.2](https://www.w3.org/TR/WCAG22/#audio-control)                                      | A     | Earlier | Not current | No automatic audio                                 | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)                                   | AA    | Earlier | Applicable  | Text in both themes                                | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [1.4.4](https://www.w3.org/TR/WCAG22/#resize-text)                                        | AA    | Earlier | Applicable  | All text and controls                              | Manual    | [manual pass](#manual-verification)                                                                           |
| [1.4.5](https://www.w3.org/TR/WCAG22/#images-of-text)                                     | AA    | Earlier | Applicable  | Brand and product imagery                          | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [1.4.10](https://www.w3.org/TR/WCAG22/#reflow)                                            | AA    | Earlier | Applicable  | Product and legal routes                           | Both      | [responsive tests](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                           |
| [1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast)                                 | AA    | Earlier | Applicable  | Controls, component boundaries, focus              | Automated | [contrast test](../tests/unit/design/boundary-contrast.test.ts)                                               |
| [1.4.12](https://www.w3.org/TR/WCAG22/#text-spacing)                                      | AA    | Earlier | Applicable  | Text and component layout                          | Manual    | [manual pass](#manual-verification)                                                                           |
| [1.4.13](https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus)                         | AA    | Earlier | Conditional | Tooltip, popover, or other hover content           | Both      | [design rule](../design/system/guidelines/accessibility.md), [manual pass](#manual-verification)              |
| [2.1.1](https://www.w3.org/TR/WCAG22/#keyboard)                                           | A     | Earlier | Applicable  | Navigation, search, controls                       | Both      | [keyboard tests](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                             |
| [2.1.2](https://www.w3.org/TR/WCAG22/#no-keyboard-trap)                                   | A     | Earlier | Applicable  | All interactive UI                                 | Manual    | [manual pass](#manual-verification)                                                                           |
| [2.1.4](https://www.w3.org/TR/WCAG22/#character-key-shortcuts)                            | A     | Earlier | Not current | No single-character shortcuts                      | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [2.2.1](https://www.w3.org/TR/WCAG22/#timing-adjustable)                                  | A     | Earlier | Not current | No visitor time limit                              | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [2.2.2](https://www.w3.org/TR/WCAG22/#pause-stop-hide)                                    | A     | Earlier | Conditional | Loading and animated states                        | Both      | [motion tokens](../src/styles/tokens/motion.css), [manual pass](#manual-verification)                         |
| [2.3.1](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold)                   | A     | Earlier | Applicable  | Authored animation and state change                | Both      | [motion tokens](../src/styles/tokens/motion.css), [manual pass](#manual-verification)                         |
| [2.4.1](https://www.w3.org/TR/WCAG22/#bypass-blocks)                                      | A     | Earlier | Applicable  | Repeated application shell                         | Automated | [skip-link test](../tests/e2e/shell.spec.ts)                                                                  |
| [2.4.2](https://www.w3.org/TR/WCAG22/#page-titled)                                        | A     | Earlier | Applicable  | Every route                                        | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [2.4.3](https://www.w3.org/TR/WCAG22/#focus-order)                                        | A     | Earlier | Applicable  | All interactive UI                                 | Both      | [architecture rule](../tests/architecture/accessibility-program.test.ts), [manual pass](#manual-verification) |
| [2.4.4](https://www.w3.org/TR/WCAG22/#link-purpose-in-context)                            | A     | Earlier | Applicable  | Navigation, cards, footer, legal links             | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [2.4.5](https://www.w3.org/TR/WCAG22/#multiple-ways)                                      | AA    | Earlier | Applicable  | Public page discovery                              | Manual    | [manual pass](#manual-verification)                                                                           |
| [2.4.6](https://www.w3.org/TR/WCAG22/#headings-and-labels)                                | AA    | Earlier | Applicable  | Page headings and form labels                      | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [2.4.7](https://www.w3.org/TR/WCAG22/#focus-visible)                                      | AA    | Earlier | Applicable  | All interactive UI                                 | Both      | [focus architecture rule](../tests/architecture/design-system.test.ts), [manual pass](#manual-verification)   |
| [2.4.11](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum)                        | AA    | 2.2     | Applicable  | Sticky shell and all keyboard controls             | Manual    | [manual pass](#manual-verification)                                                                           |
| [2.5.1](https://www.w3.org/TR/WCAG22/#pointer-gestures)                                   | A     | Earlier | Not current | No multipoint or path gesture                      | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [2.5.2](https://www.w3.org/TR/WCAG22/#pointer-cancellation)                               | A     | Earlier | Applicable  | Pointer controls                                   | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [2.5.3](https://www.w3.org/TR/WCAG22/#label-in-name)                                      | A     | Earlier | Applicable  | Labeled controls                                   | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [2.5.4](https://www.w3.org/TR/WCAG22/#motion-actuation)                                   | A     | Earlier | Not current | No motion-operated control                         | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [2.5.7](https://www.w3.org/TR/WCAG22/#dragging-movements)                                 | AA    | 2.2     | Not current | No drag-only interaction                           | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)                                | AA    | 2.2     | Applicable  | Pointer and touch controls                         | Both      | [architecture rule](../tests/architecture/accessibility-program.test.ts), [manual pass](#manual-verification) |
| [3.1.1](https://www.w3.org/TR/WCAG22/#language-of-page)                                   | A     | Earlier | Applicable  | Every HTML document                                | Automated | [axe routes](../tests/e2e/shell.spec.ts)                                                                      |
| [3.1.2](https://www.w3.org/TR/WCAG22/#language-of-parts)                                  | AA    | Earlier | Conditional | Content that changes natural language              | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [3.2.1](https://www.w3.org/TR/WCAG22/#on-focus)                                           | A     | Earlier | Applicable  | Focusable controls                                 | Manual    | [manual pass](#manual-verification)                                                                           |
| [3.2.2](https://www.w3.org/TR/WCAG22/#on-input)                                           | A     | Earlier | Applicable  | Search, filters, forms                             | Manual    | [manual pass](#manual-verification)                                                                           |
| [3.2.3](https://www.w3.org/TR/WCAG22/#consistent-navigation)                              | AA    | Earlier | Applicable  | Global header and footer                           | Both      | [shell tests](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                |
| [3.2.4](https://www.w3.org/TR/WCAG22/#consistent-identification)                          | AA    | Earlier | Applicable  | Reused controls and actions                        | Both      | [design-system test](../tests/architecture/design-system.test.ts), [manual pass](#manual-verification)        |
| [3.2.6](https://www.w3.org/TR/WCAG22/#consistent-help)                                    | A     | 2.2     | Not current | No repeated help mechanism                         | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [3.3.1](https://www.w3.org/TR/WCAG22/#error-identification)                               | A     | Earlier | Conditional | Forms with validation errors                       | Both      | [design rule](../design/system/guidelines/accessibility.md), [manual pass](#manual-verification)              |
| [3.3.2](https://www.w3.org/TR/WCAG22/#labels-or-instructions)                             | A     | Earlier | Applicable  | Search and form controls                           | Both      | [axe routes](../tests/e2e/shell.spec.ts), [manual pass](#manual-verification)                                 |
| [3.3.3](https://www.w3.org/TR/WCAG22/#error-suggestion)                                   | AA    | Earlier | Conditional | Correctable validation errors                      | Manual    | [manual pass](#manual-verification)                                                                           |
| [3.3.4](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data)              | AA    | Earlier | Not current | No legal, financial, or persistent-data submission | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [3.3.7](https://www.w3.org/TR/WCAG22/#redundant-entry)                                    | A     | 2.2     | Not current | No multi-step data-entry process                   | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [3.3.8](https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum)                  | AA    | 2.2     | Not current | No authentication UI                               | Manual    | [feature change rule](#new-or-changed-features)                                                               |
| [4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value)                                    | A     | Earlier | Applicable  | All controls and custom UI                         | Both      | [axe routes](../tests/e2e/shell.spec.ts), [icon invariant](../src/components/actions/IconButton.astro)        |
| [4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)                                    | AA    | Earlier | Applicable  | Loading, feedback, and status state                | Both      | [shell tests](../tests/e2e/shell.spec.ts), [design rule](../design/system/guidelines/accessibility.md)        |

WCAG 2.2 removed criterion 4.1.1 from the current standard. As a result, it is
not an A/AA row in this matrix.
