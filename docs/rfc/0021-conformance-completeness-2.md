# RFC 0021: Conformance completeness wave 2

Status: draft

## Problem
The freeze review lists k.component (5 partial), k.ui (6 partial) and k.testing (3 partial) clauses asserted through stand-ins: `getElementById`, a structural axe imitation, contrast arithmetic instead of E1804, hand-built Rule evidence.

## Proposal
Assert each clause with the real parts: `@keel/ui` base elements, `render`/`find`/`fire`/`a11y` from `@keel/testing`, `evaluate` from `@keel/compiler/testing` for compiled output, "no axe violations" as no E1703, E1804 as the `check()` diagnostic on a `<Box fg bg>` fixture plus tokens. Placement: S0003 applies to conformance, and compiler and ui precede check and testing, so these tests live in `packages/testing/conformance/` (`component-*`, `ui-*`); compiler and ui keep their compiled stand-ins. k.testing partials gain full assertions. E1804 had no implementation: `check` gains the rule, reading tokens from the `tokens` artifact.

## Alternatives
Reorder `deps.json`: rejected, cycles.

## Spec diff
None.

## Conformance diff
Added under testing; ui `base-elements-a11y` stand-in replaced.

## Migration
None.

## Token impact
None.
