# RFC 0023: keel check is static only

Status: implemented

## Problem
Pipeline step 4 of `keel check` and the LSP evaluate compiled app modules in-process with full Node access (red-team C1, 0070). The step also skips most components silently (M4), and `keel test` already enforces rendered a11y (E1702/E1703).

## Proposal
`keel check` never evaluates app code. Remove step 4, the `render` option and `unsafe/loadComponent.ts`. Rendered a11y belongs to `@keel/testing` render. E1802 stays as the static TS-step diagnostic for a missing required a11y prop. Steps renumber: formatter becomes step 4.

## Alternatives
Sandbox with vm or a worker: rejected, a second runtime to secure and still partial coverage.

## Spec diff
k.check Pipeline drops "Rendered checks"; incremental text reads steps 1-3.

## Conformance diff
rendered-a11y asserts `check()` never evaluates a module that throws at top level.

## Migration
Callers passing `render: false` drop it.

## Token impact
None.
