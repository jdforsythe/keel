# RFC 0004: reactive: scope onError hook

Status: draft

## Problem
An effect or computed that throws during a commit surfaces as the first error rethrown from `batch`/flush, with no owner attribution. `Boundary` (k.errors: catches throws from render, computed, effect, and event handlers anywhere in its subtree) cannot catch app-level `effect()`/`computed` throws (runtime-dom PLAN D7).

## Proposal
`scope(fn, { onError?: (error: unknown) => void })`. When an effect or computed owned (transitively) by a scope throws during a flush or a read, the error goes to the nearest ancestor scope (walking `parent`) that declared `onError`, instead of being rethrown. The throwing node is marked failed: it does not run again until its owner is disposed. Sibling effects still run. `onError` runs outside tracking, after the flush. A throw inside `onError` propagates as today. With no handler in the ancestry, behavior is unchanged (first error rethrown after the flush).

## Alternatives
- Global `onError`: no ownership attribution.
- `try`/`catch` in every effect: cannot cover computeds read by others.
- Boundary-only hook in runtime-dom: duplicates owner walking outside the engine.

## Spec diff
k.reactive API: `scope(fn, { onError? })`. Conformance gains: "an effect that throws inside a scope with onError delivers the error to that scope's onError and no outer scope's; the throwing effect does not run again; sibling effects still run; without onError the error rethrows from batch".

## Conformance diff
Add `packages/reactive/conformance/scope-onerror.test.ts`. Existing tests unchanged.

## Migration
Additive. Runtime-dom `boundary` can later adopt it to close D7.

## Token impact
About 70 tokens in k.reactive.
